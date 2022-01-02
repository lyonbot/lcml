import * as React from 'preact';
import { useEffect, useLayoutEffect, useRef } from 'preact/hooks'
import { EditorState, EditorView, basicSetup } from '@codemirror/basic-setup';
import { indentWithTab } from "@codemirror/commands"
import { keymap } from "@codemirror/view"
import { javascript } from "@codemirror/lang-javascript"
import "./index.css"

export function ResultJS(props: { value: string }) {
  const cmContainer = useRef<HTMLDivElement>(null)
  const cmRef = useRef<EditorView>(null)
  const cm = cmRef.current

  useLayoutEffect(() => {
    const cm = new EditorView({
      parent: cmContainer.current!,
      state: EditorState.create({
        extensions: [
          basicSetup,
          javascript(),
          keymap.of([indentWithTab]),
          EditorState.tabSize.of(2),
          // EditorView.updateListener.of(update => {
          //   if (!update.docChanged) return
          //   setExpr(update.state.doc.toString())
          // })
        ],
        doc: props.value,
      }),
    });
    cmRef.current = cm
  }, [])

  useEffect(() => {
    if (cm) {
      cm.dispatch({
        changes: { from: 0, to: cm.state.doc.length, insert: props.value }
      })
    }
  }, [cm, props.value])

  return <div ref={cmContainer}></div>
}