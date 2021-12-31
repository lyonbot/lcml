import * as React from 'preact';
import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'preact/hooks'
import { LCMLNodeInfo, LCMLParseOptions, parse } from 'lcml';
import { Line } from '@codemirror/text';
import { EditorState, EditorView, basicSetup } from '@codemirror/basic-setup';
import { indentWithTab } from "@codemirror/commands"
import { Decoration, DecorationSet, keymap } from "@codemirror/view"
import { StateField, StateEffect, EditorSelection } from "@codemirror/state"
import { ActiveNode, NodePresent } from './NodePresent';
import "./index.css"
import { ResultJS } from './ResultJS';

import "github-markdown-css/github-markdown-light.css"
import readme from 'lcml/README.md';
import { marked } from 'marked';

const highlightSpan = Decoration.mark({ class: 'cm-highlightPart' })

const readmeNode = <article class="markdown-body" dangerouslySetInnerHTML={{ __html: marked(readme) }}></article>

const setHighlightSpan = StateEffect.define<{ from: number, to: number } | { remove: true }>()
const highlightSpanField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none
  },
  update(decorations, tr) {
    decorations = decorations.map(tr.changes)
    for (const e of tr.effects) {
      if (e.is(setHighlightSpan)) {
        decorations = decorations.update({ filter: () => false })
        if (!('remove' in e.value)) {
          decorations = decorations.update({ add: [highlightSpan.range(e.value.from, e.value.to)] })
        }
      }
    }
    return decorations
  },
  provide: f => EditorView.decorations.from(f)
})

const encBase64 = (s: string) => btoa(Array.from(new TextEncoder().encode(s), x => String.fromCharCode(x)).join(''))
const decBase64 = (s: string) => new TextDecoder().decode(Uint8Array.from(Array.from(atob(s), x => x.charCodeAt(0))))

const examples: [string, string][] = [
  ['Object', `/* comments are supported */\n\n{\n  foo: "hello {{ user.name }}",\n  bar: {{ some.obj }}\n}`],
  ['Array', `[ 1, "string", {{ user }} ]`],
  ['Whole Expression', `{{ ctx.getRequest() }}`],
]

let initialExpr: string
try { initialExpr = decBase64(location.hash.slice(1)) } catch { } // eslint-disable-line no-empty
initialExpr ||= examples[0]![0]

const fixedHeightEditor = EditorView.theme({
  "&": { minHeight: "200px" },
  ".cm-scroller": { overflow: "auto" }
})

const App = () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [, forceUpdate] = useReducer((x, _: void) => x + 1, 0)
  const [expr, setExpr] = useState(initialExpr)
  const [recoverFromError, setRecoverFromError] = useState<LCMLParseOptions['recoverFromError'] & string>('no')
  const [highlightNode, setHighlightNode] = useState<LCMLNodeInfo | null>(null)
  const unsetHighlightNode = useCallback(() => setHighlightNode(null), [])

  const cmContainer = useRef<HTMLDivElement>(null)
  const cmRef = useRef<EditorView>(null)
  const cm = cmRef.current
  useLayoutEffect(() => {
    const cm = new EditorView({
      parent: cmContainer.current!,
      state: EditorState.create({
        extensions: [
          basicSetup,
          fixedHeightEditor,
          keymap.of([
            indentWithTab,
            {
              key: 'Ctrl-/',
              mac: 'Meta-/',
              run(view) {
                const linesSet = new Set<Line>()

                view.state.selection.ranges.forEach(range => {
                  let { from, to } = range;
                  if (from > to) [to, from] = [from, to];

                  let line: Line;
                  do {
                    line = view.state.doc.lineAt(from)
                    from = line.to + 1
                    linesSet.add(line)
                  } while (from <= to)
                })

                const lines = Array.from(linesSet)
                const strip = lines.every(x => x.text.startsWith('// '))

                view.dispatch({
                  changes: lines.map(
                    strip
                      ? line => ({ from: line.from, to: line.from + 3, insert: '' })
                      : line => ({ from: line.from, insert: '// ' })
                  )
                })

                return true
              }
            }
          ]),
          highlightSpanField,
          EditorState.tabSize.of(2),
          EditorView.updateListener.of(update => {
            if (!update.docChanged) return
            setExpr(update.state.doc.toString())
          })
        ],
        doc: expr,
      }),
    });
    cmRef.current = cm

    forceUpdate()
  }, [])

  useEffect(() => {
    if (!cm) return

    const currText = cm.state.doc.toString()
    if (currText !== expr) {
      cm.dispatch({
        changes: { from: 0, to: currText.length, insert: expr }
      })
    }

    history.replaceState({}, "", `#${encBase64(expr)}`)
  }, [cm, expr])

  useEffect(() => {
    if (!cm) return

    const effects: StateEffect<unknown>[] = [
      setHighlightSpan.of(highlightNode ? { from: highlightNode.start, to: highlightNode.end } : { remove: true })
    ]
    cm.dispatch({ effects })
  }, [cm, highlightNode])

  const focusHighlightNode = useCallback((node: LCMLNodeInfo) => {
    if (!cm) return

    cm.dispatch({
      selection: EditorSelection.range(node.start, node.end),
      scrollIntoView: true,
    })
    cm.focus()
  }, [cm])

  const exampleButtons = useMemo(() => <div className="exampleButtons">
    Examples:
    {examples.map(([n, e]) => <button onClick={() => setExpr(e)}>{n}</button>)}
  </div>, [])

  const parseResult = useMemo(() => {
    const since = performance.now()
    try {
      const result = parse(expr, { recoverFromError })
      const duration = performance.now() - since

      return { result, duration }
    } catch (error) {
      const duration = performance.now() - since
      console.error(error)
      return { error, duration }
    }
  }, [expr, recoverFromError])

  return <div className="app">
    <div className="editor">
      <h2>Input LCML Here:</h2>
      {exampleButtons}
      <p>
        recoverFromError: <select
          value={recoverFromError}
          onChange={e => setRecoverFromError(e.currentTarget.value as any)}>
          <option value="no">no</option>
          <option value="recover">recover</option>
          <option value="as-string">as-string</option>
        </select>
      </p>
      <div ref={cmContainer}></div>

      <h2>Result JavaScript:</h2>
      <ResultJS value={parseResult.result?.body ? `return ${parseResult.result.body}` : ''} />
    </div>

    <div className="output">
      <div className="messageBar">
        Parsed in {parseResult.duration} ms
      </div>

      {('error' in parseResult) && <div className="messageBar isError">
        {(parseResult.error as Error).message}
      </div>}
      <pre>{JSON.stringify(parseResult, null, 2)}</pre>
    </div>

    <div className="nodeTreeView">
      <ActiveNode.Provider value={highlightNode}>
        {parseResult.result?.rootNodeInfo && <NodePresent
          node={parseResult.result.rootNodeInfo}
          onMouseMove={setHighlightNode}
          onClick={focusHighlightNode}
          onMouseLeave={unsetHighlightNode}
        />}
      </ActiveNode.Provider>
    </div>

    <div className="sidebar">
      {readmeNode}
    </div>
  </div>
}

React.render(<App />, document.querySelector('#app')!)
