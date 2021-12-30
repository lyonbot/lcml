import { unescapeString } from './escape';
import { LCMLParseOptions, LCMLParseResult, ExpressionSegmentInfo, LCMLNodeInfo, LCMLValueType } from './types';
import { LCMLParseError } from './LCMLParseError';
import { StringStream } from './StringStream';

const spaces = (n: number) => (n <= 0 ? '' : Array.from({ length: n }, () => ' ').join(''));

const enum StateType {
  OUTMOST_BEGIN,
  VOID,
  IN_ARRAY,
  IN_OBJECT_KEY,
  IN_OBJECT_COLON,
  IN_OBJECT_VALUE,
  IN_OBJECT_COMMA,
}

interface State {
  type: StateType;
  start: number;

  onPop(self: State): void;
  newLine: string; // eg: "\n    "
  size?: number;
  arrItemLoaded?: boolean;
}

interface ConsumingResult {
  js: string;
  type: LCMLValueType;
  expression?: ExpressionSegmentInfo;
}

interface ConsumingStringResult extends ConsumingResult {
  parts: { content: string; isJs?: boolean }[];
  isDynamic: boolean;
}

const RE_IDENTIFIER = /^[_$a-zA-Z][_$a-zA-Z0-9]*/;

/**
 * @public
 * @param lcml - the LCML expression
 */
export function parse(lcml: string, opts: LCMLParseOptions = {}): LCMLParseResult {
  const stream = new StringStream(lcml);
  const toStringMethod = opts.globalToStringMethod || 'toString';

  const stateStack: State[] = [
    {
      type: StateType.OUTMOST_BEGIN,
      start: 0,
      newLine: '',
      onPop: () => void 0,
    },
  ];
  const pushState = (s: State) => stateStack.push(s);
  const popState = () => {
    const s = stateStack.pop();
    if (!s) return;
    s.onPop(s);
  };

  const expressions = [] as ExpressionSegmentInfo[];
  const body = [] as string[];
  let rootNodeInfo: LCMLNodeInfo | undefined = undefined;

  // -------------------------
  //#region Node Information

  const nodeStack = [] as LCMLNodeInfo[];

  const pushNode = (key: string | number, info: Omit<LCMLNodeInfo, 'end'>): void => {
    nodeStack.push({ key: String(key), end: info.start, ...info });
  };
  const modNode = (info: Omit<LCMLNodeInfo, 'start' | 'end'>) => {
    Object.assign(nodeStack[nodeStack.length - 1], info);
  };
  const popNode = (info: Omit<LCMLNodeInfo, 'start'>) => {
    const p = nodeStack.pop();
    if (!p) return;

    Object.assign(p, info);

    const parent = nodeStack[nodeStack.length - 1];
    if (parent) {
      if (parent.children) parent.children.push(p);
      else parent.children = [p];
    } else {
      rootNodeInfo = p;
      rootNodeInfo = p;
    }
  };
  //#endregion

  // -------------------------
  //#region Consuming the stream (but not immediately change result's body)

  const consumeCommentAndSpaces = (): void => {
    stream.skipSpace();
    while (stream.match(/^\/\*.*?(\*\/|$)/) || stream.match(/^\/\/.*$/m)) {
      stream.skipSpace();
    }
  };

  /**
   * check if next leading token is `{{`.
   *
   * if is, make a expression and return the JavaScript part.
   * otherwise `null` is returned.
   */
  const consumeExpression = (): ConsumingResult | void => {
    const start = stream.pos;

    if (!stream.match('{{')) return;
    const ending = stream.str.indexOf('}}');
    if (ending === -1) throw new Error('Unfinished expression. Expect }}');

    const str = stream.str.slice(0, ending);
    stream.precede(ending + 2);

    const expression: ExpressionSegmentInfo = {
      start,
      end: ending + 2,
      type: 'unknown',
      expression: str,
      rawExpression: str,
    };

    // call custom callback
    if (opts.handleExpression) opts.handleExpression(expression);

    expressions.push(expression);
    return { js: `(${expression.expression})`, type: expression.type, expression };
  };

  /**
   * (assuming the leading token is consumed)
   *
   * @param stop - if provided, consuming will stop at the token (inclusive)
   * @return js parts. the array is NOT empty
   */
  const consumeStrContent = (stop: string): ConsumingStringResult | void => {
    const parts = [{ content: '' }] as ConsumingStringResult['parts'];

    const precedeAndPushStaticString = (len: number) => {
      const raw = stream.str.slice(0, len);
      const unescaped = unescapeString(raw);
      if (!unescaped) return;

      const top = parts[parts.length - 1]!;
      if (!top.isJs) top.content += unescaped;
      else parts.push({ content: unescaped });

      stream.precede(raw.length);
    };

    while (!stream.eof()) {
      const str = stream.str;
      const nInfo = stream.indexOf([stop, '{{'], '\\');

      if (!nInfo) {
        // unexpected end of string
        precedeAndPushStaticString(str.length);
        if (stop) throw new Error(`String ending quote is required. Expect ${stop}`);
        break;
      }

      // find a token. add content before the token into static string
      precedeAndPushStaticString(nInfo.pos);

      if (nInfo.needle === stop) {
        // found ending token
        stream.precede(stop.length);
        break;
      }

      if (nInfo.needle === '{{') {
        // found exprBegin token
        const varName = consumeExpression()!.js; // implicit consuming
        parts.push({ content: `${toStringMethod}(${varName})`, isJs: true });
        continue;
      }
    }

    if (parts.length > 1 && !parts[0]!.content) parts.shift();

    return {
      parts,
      isDynamic: !!(parts.length > 1 || parts[0].isJs),
      js: parts.map(x => (x.isJs ? x.content : JSON.stringify(x.content))).join('+'),
      type: 'string',
    };
  };

  /**
   * check if next leading token is quote
   *
   * if is, make a expression and return the JavaScript part.
   * otherwise `null` is returned.
   */
  const consumeString = (): ConsumingStringResult | void => {
    const ch = stream.peek();
    if (ch !== '"' && ch !== "'") return;

    stream.precede(1);
    return consumeStrContent(ch);
  };

  /**
   * consume number or boolean or null
   */
  const consumeLiteral = (): ConsumingResult | void => {
    let m = stream.match(/^(null|undefined)\b/);
    if (m) return { js: m[0]!, type: 'unknown' };

    m = stream.match(/^(true|false)\b/);
    if (m) return { js: m[0]!, type: 'boolean' };

    m = stream.match(/^-?(?:0x[0-9a-f]+|0o[0-7]+|\d+(\.\d*)?(e-?\d+)?)/) || stream.match(/^-?\.\d+(e-?\d+)/);
    if (m) return { js: m[0]!, type: 'number' };
  };

  /**
   * consume any valid value or **the beginning of** object/array. might change `stack`
   */
  const consumeValue = (): ConsumingResult | void => {
    const t = consumeString() || consumeExpression() || consumeLiteral();
    if (t) return t;

    const start = stream.pos;

    if (stream.match('[')) {
      pushState({
        start,
        type: StateType.IN_ARRAY,
        newLine: `\n${spaces(stateStack.length)}`,
        size: 0,
        arrItemLoaded: false,
        onPop(self) {
          body.push((self.size ? `\n${spaces(stateStack.length - 1)}` : '') + ']');
        },
      });
      return { js: '[', type: 'array' };
    }

    if (stream.match('{')) {
      pushState({
        start,
        type: StateType.IN_OBJECT_KEY,
        newLine: `\n${spaces(stateStack.length)}`,
        size: 0,
        onPop(self) {
          body.push((self.size ? `\n${spaces(stateStack.length - 1)}` : '') + '}');
        },
      });
      return { js: '{', type: 'object' };
    }
  };

  //#endregion

  // -------------------------
  // #region Push the ConsumingResult into result's body
  let lastPushed!: ConsumingResult;
  const maybePushJS = (s: ConsumingResult | void) => {
    if (!s) return false;

    lastPushed = s;
    body.push(s.js);
    return true;
  };
  // #endregion

  // -------------------------
  let prevStart = -1;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const startBeforeSpace = stream.pos;

    consumeCommentAndSpaces();

    const state: State = stateStack[stateStack.length - 1]!;
    const start = stream.pos;

    try {
      if (prevStart === start) throw new Error('Parser has internal error. Dead locked');
      prevStart = start;

      if (stream.eof()) {
        // end of expression
        if (stateStack.length > 1) throw new Error(`Unexpected end`);

        popNode({ end: startBeforeSpace });
        break;
      }

      switch (state.type) {
        case StateType.OUTMOST_BEGIN: {
          state.type = StateType.VOID;

          if (maybePushJS(consumeValue())) {
            pushNode('', { start, type: lastPushed.type, expression: lastPushed.expression });
            continue;
          }

          throw new Error('Expect a value');
        }

        case StateType.VOID: {
          throw new Error('Value is finished');
        }

        case StateType.IN_OBJECT_KEY: {
          // available:
          // - key
          // - "key"
          // - "{{ expr }}"
          // - {{ expr }}
          // - }

          if (stream.match('}')) {
            // end of object
            popState();
            continue;
          }

          let key = '';
          let keyExpression: ExpressionSegmentInfo | undefined;

          const tmp = stream.match(RE_IDENTIFIER);
          if (tmp) key = tmp[0];

          if (!key) {
            const s = consumeString();
            if (s) key = s.isDynamic ? `[${s.js}]` : s.parts[0].content;
          }

          if (!key) {
            const s = consumeExpression();
            if (s) {
              key = `[${s.js}]`;
              keyExpression = s.expression;
            }
          }

          if (key) {
            pushNode(key, { start, propertyKeyEnd: stream.pos, propertyKeyExpression: keyExpression });
            body.push(state.newLine + key);
            state.type = StateType.IN_OBJECT_COLON;
            state.size!++;
            continue;
          }

          throw new Error('Expect an identifier or string.');
        }

        case StateType.IN_OBJECT_COLON: {
          // expect a colon

          if (stream.match(':')) {
            body.push(': ');
            modNode({ propertyKeyEnd: start });
            state.type = StateType.IN_OBJECT_VALUE;
            continue;
          }

          throw new Error('Expect a colon');
        }

        case StateType.IN_OBJECT_VALUE: {
          // change state before consuming!
          state.type = StateType.IN_OBJECT_COMMA;

          if (maybePushJS(consumeValue())) {
            modNode({ propertyValueStart: start, type: lastPushed.type, expression: lastPushed.expression });
            continue;
          }

          throw new Error('Expect a comma, right square bracket or item');
        }

        case StateType.IN_OBJECT_COMMA: {
          // available:
          // - ","
          // - }

          if (stream.match(',')) {
            body.push(',');
            popNode({ end: startBeforeSpace });
            state.type = StateType.IN_OBJECT_KEY;
            continue;
          }

          if (stream.match('}')) {
            // end of object
            popNode({ end: startBeforeSpace });
            popState();
            continue;
          }

          throw new Error('Expect a comma or right curly bracket');
        }

        case StateType.IN_ARRAY:
          {
            const cValue = !state.arrItemLoaded && consumeValue();
            if (cValue) {
              body.push(state.newLine);
              maybePushJS(cValue);
              pushNode(state.size!, { start, type: lastPushed.type, expression: lastPushed.expression });
              state.arrItemLoaded = true;
              continue;
            }

            if (stream.match(',')) {
              if (state.arrItemLoaded) popNode({ end: startBeforeSpace });
              else body.push(state.newLine); // add empty line!
              state.arrItemLoaded = false;
              state.size!++;
              body.push(',');
              continue;
            }
            if (stream.match(']')) {
              if (state.arrItemLoaded) popNode({ end: startBeforeSpace });
              popState();
              continue;
            }

            throw new Error('Expect a comma, right square bracket or item');
          }

          throw new Error('Unhandled internal status');
      }
    } catch (err) {
      if (err instanceof Error) throw new LCMLParseError(err, start, stream);
      else throw err;
    }
  }

  return {
    body: body.join(''),
    isDynamic: expressions.length > 0,
    rootNodeInfo,
    expressions,
  };
}
