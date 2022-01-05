import { EditorView } from '@codemirror/basic-setup';
import { Decoration, DecorationSet } from '@codemirror/view';
import { StateField, StateEffect, SelectionRange } from '@codemirror/state';

const highlightSpan = Decoration.mark({ class: 'cm-highlightPart' });
export const setHighlightSpan = StateEffect.define<SelectionRange | { remove: true; }>();
export const highlightSpanField = StateField.define<DecorationSet>({
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
