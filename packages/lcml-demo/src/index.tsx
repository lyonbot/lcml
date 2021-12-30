import * as React from 'preact';
import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'preact/hooks'
import { LCMLNodeInfo, parse } from 'lcml';
import { Line } from '@codemirror/text';
import { EditorState, EditorView, basicSetup } from '@codemirror/basic-setup';
import { indentWithTab } from "@codemirror/commands"
import { Decoration, DecorationSet, keymap } from "@codemirror/view"
import { StateField, StateEffect, EditorSelection } from "@codemirror/state"
import { ActiveNode, NodePresent } from './NodePresent';
import "./index.css"
import { ResultJS } from './ResultJS';

const highlightSpan = Decoration.mark({ class: 'cm-highlightPart' })

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

let initialExpr: string
try { initialExpr = decBase64(location.hash.slice(1)) } catch { } // eslint-disable-line no-empty
initialExpr ||= `{\n  foo: "hello {{ world }}",\n  bar: {{ some.obj }}\n}`

const App = () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [, forceUpdate] = useReducer((x, _: void) => x + 1, 0)
  const [expr, setExpr] = useState(initialExpr)
  const [highlightNode, setHighlightNode] = useState<LCMLNodeInfo | null>(null)
  const unsetHighlightNode = useCallback(() => setHighlightNode(null), [])

  const cmContainer = useRef<HTMLDivElement>(null)
  const cmRef = useRef<EditorView>(null)
  const cm = cmRef.current
  useLayoutEffect(() => {
    const cm = new EditorView({
      parent: cmContainer.current,
      state: EditorState.create({
        extensions: [
          basicSetup,
          keymap.of([
            indentWithTab,
            {
              key: 'Ctrl-/',
              mac: 'Meta-/',
              run(view) {
                view.dispatch(view.state.changeByRange(range => {
                  const line = view.state.doc.lineAt(range.head)
                  const leading = /^(\s*)\/\//.exec(line.text)

                  return {
                    range,
                    changes: leading
                      ? { from: line.from + leading[1].length, to: line.from + leading[0].length, insert: '' }
                      : { from: line.from, insert: '//' }
                  }
                }))
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

    history.replaceState({}, null, `#${encBase64(expr)}`)
  }, [cm, expr])

  useEffect(() => {
    if (!cm) return

    const effects: StateEffect<unknown>[] = [
      setHighlightSpan.of(highlightNode ? { from: highlightNode.start, to: highlightNode.end } : { remove: true })
    ]
    cm.dispatch({ effects })
  }, [cm, highlightNode])

  const focusHighlightNode = useCallback((node: LCMLNodeInfo) => {
    cm.dispatch({
      selection: EditorSelection.range(node.start, node.end),
      scrollIntoView: true,
    })
    cm.focus()
  }, [cm])

  const parseResult = useMemo(() => {
    try {
      const since = performance.now()
      const result = parse(expr)
      const duration = performance.now() - since

      return { result, duration }
    } catch (error) {
      return { error }
    }
  }, [expr])

  return <div className="app">
    <div className="editor">
      <h2>Input LCML Here:</h2>
      <div ref={cmContainer}></div>

      <h2>Result JavaScript:</h2>
      <ResultJS value={parseResult.result?.body || ''} />
    </div>

    <div className="output">
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
  </div>
}

React.render(<App />, document.querySelector('#app'))
