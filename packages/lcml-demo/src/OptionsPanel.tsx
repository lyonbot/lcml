import { ParseOptions, ToJSOptions } from 'lcml';
import * as React from 'preact';
import { StateUpdater, useMemo } from 'preact/hooks';

interface Props {
  parseOptions: ParseOptions;
  toJSOptions: ToJSOptions;

  setParseOptions: StateUpdater<ParseOptions>;
  setToJSOptions: StateUpdater<ToJSOptions>;
}

function useFormItems<T extends Record<string, any>>(
  rulesFactory: () => {
    [k in keyof T]?: {
      title?: React.ComponentChildren;
      input: (value: T[k], whole: T) => React.VNode;
    };
  },
  setter: StateUpdater<T>,
) {
  const rules = useMemo(rulesFactory, []);
  const metas = useMemo(
    () =>
      (Object.keys(rules) as (keyof T)[]).map(k => ({
        key: k,
        props: {
          onChange: (ev: any) => {
            const vk = ev.target.type === 'checkbox' ? 'checked' : 'value';
            setter(p => ({ ...p, [k]: ev.target[vk] }));
          },
        },
      })),
    [setter],
  );

  const render = useMemo(
    () =>
      function render(form: T) {
        return metas.map(({ key, props }) => {
          const rule = rules[key]!;
          return (
            <div>
              <label>
                {rule.title || `${key}: `}
                {React.cloneElement(rule.input(form[key], form), props)}
              </label>
            </div>
          );
        });
      },
    [metas],
  );

  return render;
}

export function OptionsPanel(props: Props) {
  const parseOptions = useFormItems<ParseOptions>(
    () => ({
      loose: { input: value => <input type="checkbox" checked={value} /> },
      ignoreUnparsedRemainder: { input: value => <input type="checkbox" checked={value} /> },
      onError: {
        input: value => (
          <select value={value}>
            <option value="throw">throw</option>
            <option value="recover">recover</option>
            <option value="as-string">as-string</option>
          </select>
        ),
      },
    }),
    props.setParseOptions,
  );
  const toJSOptions = useFormItems<ToJSOptions>(
    () => ({
      globalToStringMethod: { input: value => <input type="text" value={value} /> },
      compact: { input: value => <input type="checkbox" checked={value} /> },
    }),
    props.setToJSOptions,
  );

  return (
    <div className="editor-options">
      <div className="named-box" name="parseOptions">
        {parseOptions(props.parseOptions)}
      </div>
      <div className="named-box" name="toJSOptions">
        {toJSOptions(props.toJSOptions)}
      </div>
    </div>
  );
}
