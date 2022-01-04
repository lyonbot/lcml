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
  rulesFactory: () => { [k in keyof T]?: (value: T[k], whole: T) => React.VNode },
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
          return (
            <div>
              <label>
                {`${key}: `}
                {React.cloneElement(rules[key]!(form[key], form), props)}
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
      treatUnparsedRemainder: value => (
        <select value={value}>
          <option value="ignore">ignore</option>
          <option value="as-error">as-error</option>
        </select>
      ),
      onError: value => (
        <select value={value}>
          <option value="throw">throw</option>
          <option value="recover">recover</option>
          <option value="as-string">as-string</option>
        </select>
      ),
    }),
    props.setParseOptions,
  );
  const toJSOptions = useFormItems<ToJSOptions>(
    () => ({
      globalToStringMethod: value => <input type="text" value={value} />,
      compact: value => <input type="checkbox" checked={value} />,
    }),
    props.setToJSOptions,
  );

  return (
    <div className='editor-options'>
      <div className="named-box" name="parseOptions">
        {parseOptions(props.parseOptions)}
      </div>
      <div className="named-box" name="toJSOptions">
        {toJSOptions(props.toJSOptions)}
      </div>
    </div>
  );
}
