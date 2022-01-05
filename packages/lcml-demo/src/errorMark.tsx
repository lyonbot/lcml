import { EditorView } from '@codemirror/basic-setup';
import { Decoration, DecorationSet, WidgetType } from '@codemirror/view';
import { StateField, StateEffect, SelectionRange } from '@codemirror/state';

class ErrorMarkWidget extends WidgetType {
  constructor(readonly message: string) {
    super();
  }

  eq(other: ErrorMarkWidget) {
    return other.message == this.message;
  }

  toDOM() {
    let wrap = document.createElement('span');
    wrap.className = 'cm-errorMark';
    wrap.title = this.message;
    return wrap;
  }

  ignoreEvent() {
    return false;
  }
}

export const setErrorMarks = StateEffect.define<[number, string][]>();
export const errorMarksField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decorations, tr) {
    decorations = decorations.map(tr.changes);

    for (const e of tr.effects) {
      if (e.is(setErrorMarks)) {
        decorations = decorations.update({
          filter: () => false,
          add: e.value.map(([pos, message]) =>
            Decoration.widget({
              widget: new ErrorMarkWidget(message),
              side: -1,
            }).range(pos),
          ),
        });
      }
    }

    return decorations;
  },
  provide: f => EditorView.decorations.from(f),
});
