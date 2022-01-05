import * as React from 'preact';
import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'preact/hooks';
import { toJS, parse, ParseOptions, ParseError, ParsedNodeBase, ToJSOptions } from 'lcml';
import { Line } from '@codemirror/text';
import { EditorState, EditorView, basicSetup } from '@codemirror/basic-setup';
import { indentWithTab } from '@codemirror/commands';
import { Decoration, DecorationSet, keymap } from '@codemirror/view';
import { StateField, StateEffect, EditorSelection, SelectionRange } from '@codemirror/state';
import { ActiveNode, NodePresent } from './NodePresent';
import './index.css';
import { ResultJS } from './ResultJS';

import 'github-markdown-css/github-markdown-light.css';
import readme from 'lcml/README.md';
import { marked } from 'marked';
import debounce from 'lodash.debounce';
import { OptionsPanel } from './OptionsPanel';

const highlightSpan = Decoration.mark({ class: 'cm-highlightPart' });

const readmeNode = <article class="markdown-body" dangerouslySetInnerHTML={{ __html: marked(readme) }}></article>;

const setHighlightSpan = StateEffect.define<SelectionRange | { remove: true }>();
const highlightSpanField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decorations, tr) {
    decorations = decorations.map(tr.changes);
    for (const e of tr.effects) {
      if (e.is(setHighlightSpan)) {
        decorations = decorations.update({ filter: () => false });
        if (!('remove' in e.value)) {
          decorations = decorations.update({ add: [highlightSpan.range(e.value.from, e.value.to)] });
        }
      }
    }
    return decorations;
  },
  provide: f => EditorView.decorations.from(f),
});

const encBase64 = (s: any) =>
  btoa(Array.from(new TextEncoder().encode(JSON.stringify(s)), x => String.fromCharCode(x)).join(''));

const decBase64 = (s: string) =>
  JSON.parse(new TextDecoder().decode(Uint8Array.from(Array.from(atob(s), x => x.charCodeAt(0)))));

const examples: [string, string][] = [
  ['Object', `/* comments are supported */\n\n{\n  foo: "hello {{ user.name }}",\n  bar: {{ some.obj }}\n}`],
  ['Array', `[ 1, "string", {{ user }} ]`],
  ['Whole Expression', `{{ ctx.getRequest() }}`],
];

let initialExpr = examples[0][1];
let defaultParseOptions: ParseOptions = {
  onError: 'recover',
  loose: false,
  ignoreUnparsedRemainder: false,
};
let defaultToJSOptions: ToJSOptions = {
  compact: false,
  globalToStringMethod: 'toString',
};

try {
  const dec = decBase64(location.hash.slice(1));
  initialExpr = dec.expression;
  defaultParseOptions = { ...defaultParseOptions, ...dec.parseOptions };
  defaultToJSOptions = { ...defaultToJSOptions, ...dec.toJSOptions };
} catch {} // eslint-disable-line no-empty

const App = () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [, forceUpdate] = useReducer((x, _: void) => x + 1, 0);
  const [expr, setExpr] = useState(initialExpr);
  const [parseOptions, setParseOptions] = useState(defaultParseOptions);
  const [toJSOptions, setToJSOptions] = useState(defaultToJSOptions);

  const [highlightNode, setHighlightNode] = useState<ParsedNodeBase | null>(null);
  const unsetHighlightNode = useCallback(() => setHighlightNode(null), []);

  const cmContainer = useRef<HTMLDivElement>(null);
  const cmRef = useRef<EditorView>(null);
  const cm = cmRef.current;
  const [cmHasFocus, setCmHasFocus] = useState(false);
  useLayoutEffect(() => {
    const setExprDebounced = debounce(setExpr, 100);

    const cm = new EditorView({
      parent: cmContainer.current!,
      state: EditorState.create({
        extensions: [
          basicSetup,
          keymap.of([
            indentWithTab,
            {
              key: 'Ctrl-/',
              mac: 'Meta-/',
              run(view) {
                const linesSet = new Set<Line>();

                view.state.selection.ranges.forEach(range => {
                  let { from, to } = range;
                  if (from > to) [to, from] = [from, to];

                  let line: Line;
                  do {
                    line = view.state.doc.lineAt(from);
                    from = line.to + 1;
                    linesSet.add(line);
                  } while (from <= to);
                });

                const lines = Array.from(linesSet);
                const strip = lines.every(x => x.text.startsWith('// '));

                view.dispatch({
                  changes: lines.map(
                    strip
                      ? line => ({ from: line.from, to: line.from + 3, insert: '' })
                      : line => ({ from: line.from, insert: '// ' }),
                  ),
                });

                return true;
              },
            },
          ]),
          highlightSpanField,
          EditorState.tabSize.of(2),
          EditorView.updateListener.of(update => {
            if (!update.docChanged) return;
            setExprDebounced(update.state.doc.toString());
          }),
          EditorView.domEventHandlers({
            focus: () => setCmHasFocus(true),
            blur: () => setCmHasFocus(false),
          }),
        ],
        doc: expr,
      }),
    });
    cmRef.current = cm;

    forceUpdate();
  }, []);

  useEffect(() => {
    if (!cm || cmHasFocus) return;

    const currText = cm.state.doc.toString();
    if (currText !== expr) {
      cm.dispatch({
        changes: { from: 0, to: currText.length, insert: expr },
      });
    }
  }, [cm, cmHasFocus, expr]);

  useEffect(() => {
    if (!cm) return;

    const range = !!highlightNode && EditorSelection.range(highlightNode.start, highlightNode.end);
    const effects: StateEffect<unknown>[] = [setHighlightSpan.of(range || { remove: true })];

    cm.dispatch({ effects });

    const needScrolling = range && cm.visibleRanges.every(vr => vr.from > range.from || vr.to < range.to);
    if (needScrolling) cm.scrollPosIntoView(range.from);
  }, [cm, highlightNode]);

  const focusHighlightNode = useCallback(
    (node: ParsedNodeBase) => {
      if (!cm) return;

      cm.dispatch({
        selection: EditorSelection.range(node.start, node.end),
        scrollIntoView: true,
      });
      cm.focus();
    },
    [cm],
  );

  const exampleButtons = useMemo(
    () => (
      <div className="exampleButtons">
        Examples:
        {examples.map(([n, e]) => (
          <button onClick={() => setExpr(e)}>{n}</button>
        ))}
      </div>
    ),
    [],
  );

  const result = useMemo(() => {
    let since = performance.now();
    try {
      const parseOutput = parse(expr, parseOptions);
      const parseDuration = performance.now() - since;

      since = performance.now();
      const body = parseOutput.ast ? toJS(parseOutput.ast, toJSOptions) : 'undefined';
      const toJSDuration = performance.now() - since;

      return {
        parseOutput,
        parseDuration,
        body,
        toJSDuration,
        duration: parseDuration + toJSDuration,
        errors: parseOutput.errors,
      };
    } catch (error) {
      const duration = performance.now() - since;
      console.error(error);
      return { errors: [error], duration };
    }
  }, [expr, parseOptions, toJSOptions]);

  useEffect(() => {
    history.replaceState(
      {},
      '',
      `#${encBase64({
        expression: expr,
        parseOptions,
        toJSOptions,
      })}`,
    );
  }, [expr, parseOptions, toJSOptions]);

  const rootNode = result.parseOutput?.ast;

  return (
    <div className="app">
      <div className="editor">
        <h2>Input LCML Here:</h2>
        {exampleButtons}
        <OptionsPanel
          parseOptions={parseOptions}
          toJSOptions={toJSOptions}
          setParseOptions={setParseOptions}
          setToJSOptions={setToJSOptions}
        />
        <div ref={cmContainer}></div>

        <h2>Result JavaScript:</h2>
        <ResultJS value={result.body ? `return ${result.body}` : ''} />
      </div>

      <div className="output">
        <div className="messageBar">
          Finished in {result.duration.toFixed(2)} ms
          {'parseDuration' in result && `, parse ${result.parseDuration!.toFixed(2)} ms`}
          {'toJSDuration' in result && `, toJS ${result.toJSDuration!.toFixed(2)} ms`}
        </div>

        {result.errors.map(error => (
          <div className="messageBar isError">
            {(error as Error).message}
            {error instanceof ParseError && (
              <button
                type="button"
                onClick={() => {
                  cm!.focus();

                  const pos = EditorSelection.cursor(error.position);
                  cm!.dispatch({ selection: pos });
                }}
              >
                Goto Position
              </button>
            )}
          </div>
        ))}
        <pre>{JSON.stringify(result, null, 2)}</pre>
      </div>

      <div className="nodeTreeView">
        <ActiveNode.Provider value={highlightNode}>
          {rootNode ? (
            <NodePresent
              node={rootNode}
              onMouseMove={setHighlightNode}
              onClick={focusHighlightNode}
              onMouseLeave={unsetHighlightNode}
            />
          ) : (
            <div />
          )}
        </ActiveNode.Provider>
      </div>

      <div className="sidebar">{readmeNode}</div>
    </div>
  );
};

React.render(<App />, document.querySelector('#app')!);
