import { unescapeString } from './escape';
import { StringStream } from './StringStream';

export interface LCMLPathInfo {
  key?: string;
  type?: LCMLValueType;
  children?: LCMLPathInfo[];

  start: number;
  end: number;

  propertyKeyEnd?: number;
  propertyValueStart?: number;
}

/**
 * Parser options
 *
 * @public
 */
export interface LCMLParseOptions {
  /**
   * when a `{{ expression }}` is found, this callback will be triggered
   *
   * you may read and modify `item.expression` (eg. babel transpiling) and the final result will be affected by it.
   * 
   * you may also modify `item.type`
   */
  handleExpression?(item: ExpressionSegmentInfo): void;

  /**
   * in the generated js, a global method `toString(...)` might be called.
   *
   * you may customize the method's name
   *
   * @defaultValue `"toString"`
   */
  globalToStringMethod?: string;
}

export type LCMLValueType = 'unknown' | 'array' | 'number' | 'string' | 'boolean' | 'object';

/**
 * Parser's output
 *
 * @public
 */
export interface LCMLParseResult {
  /** the JavaScript that to be evaluated */
  body: string;
  /** whether there are dynamic expressions */
  isDynamic: boolean;
  /** containing the type and children properties' info of the root node */
  paths?: LCMLPathInfo;
  /** all dynamic expressions */
  expressions: ExpressionSegmentInfo[];
}

export class LCMLParseError extends Error {
  position: number;
  stream: StringStream;

  constructor(error: Error, position: number, stream: StringStream) {
    super(error.message);
    this.stack = error.stack;
    this.position = position;
    this.stream = stream;
  }
}

/**
 * Expression Info extracted from input
 *
 * @public
 */
export interface ExpressionSegmentInfo {
  /** the index of first opening curly brackets */
  readonly start: number;

  /** the index of last closing curly brackets */
  readonly end: number;

  /** the return value's type */
  type: LCMLValueType;

  /** the final JavaScript expression. might differ from the rawExpression */
  expression: string;

  /** the original JavaScript expression */
  readonly rawExpression: string;
}

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

  arrayIndex?: number;
  arrayNotAllowValue?: boolean;
}

const RE_IDENTIFIER = /^[_$a-zA-Z][_$a-zA-Z0-9]*/;

/**
 * @public
 * @param lcml - the LCML expression
 */
export function parse(lcml: string, opts: LCMLParseOptions = {}): LCMLParseResult {
  const stream = new StringStream(lcml);
  const toStringMethod = opts.globalToStringMethod || 'toString';

  const expressions = [] as ExpressionSegmentInfo[];
  const body = [] as string[];
  let rootPaths: LCMLPathInfo | undefined = undefined;

  const stack: State[] = [{ type: StateType.OUTMOST_BEGIN, start: 0 }];

  const currPath = [] as LCMLPathInfo[];
  const pushPath = (key: string | number, info: Omit<LCMLPathInfo, 'end'>): void => {
    currPath.push({ key: String(key), end: info.start, ...info });
  };
  const modPath = (info: Omit<LCMLPathInfo, 'start' | 'end'>) => {
    Object.assign(currPath[currPath.length - 1], info);
  };
  const popPath = (info: Omit<LCMLPathInfo, 'start'>) => {
    const p = currPath.pop();
    if (!p) return;

    Object.assign(p, info);

    const parent = currPath[currPath.length - 1];
    if (parent) {
      if (parent.children) parent.children.push(p);
      else parent.children = [p];
    } else {
      rootPaths = p;
    }
  };

  /**
   * check if next leading token is `{{`.
   *
   * if is, make a expression and return the JavaScript part.
   * otherwise `null` is returned.
   */
  const consumeExpression = (): { js: string; type: LCMLValueType } | void => {
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
    return { js: `(${expression.expression})`, type: expression.type };
  };

  /**
   * (assuming the leading token is consumed)
   *
   * @param stop - if provided, consuming will stop at the token (inclusive)
   * @return js parts. the array is NOT empty
   */
  const consumeStrContent = (stop: string) => {
    const parts = [{ content: '' }] as { content: string; isJs?: boolean }[];

    const precedeAndPushStaticString = (len: number) => {
      let raw = stream.str.slice(0, len);
      let unescaped = unescapeString(raw);
      if (!unescaped) return;

      let top = parts[parts.length - 1]!;
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
    };
  };

  /**
   * check if next leading token is quote
   *
   * if is, make a expression and return the JavaScript part.
   * otherwise `null` is returned.
   */
  const consumeStr = () => {
    const ch = stream.peek();
    if (ch !== '"' && ch !== "'") return null;

    stream.precede(1);
    return { ...consumeStrContent(ch), type: 'string' as const };
  };

  const consumeCommentAndSpaces = () => {
    stream.skipSpace();
    while (stream.match(/^\/\*.*?(\*\/|$)/) || stream.match(/^\/\/.*$/m)) {
      stream.skipSpace();
    }
  };

  /**
   * consume number or boolean or null
   */
  const consumeLiteral = (): { js: string; type: LCMLValueType } | void => {
    let m = stream.match(/^(null|undefined)\b/);
    if (m) return { js: m[0]!, type: 'unknown' };

    m = stream.match(/^(true|false)\b/);
    if (m) return { js: m[0]!, type: 'boolean' };

    m = stream.match(/^-?(?:0x[0-9a-f]+|0o[0-7]+|\d+(\.\d*)?(e-?\d+)?)/) || stream.match(/^-?\.\d+(e-?\d+)/);
    if (m) return { js: m[0]!, type: 'number' };
  };

  /**
   * consume any valid value or object. might change `stack`
   */
  const consumeValue = (): { js: string; type: LCMLValueType } | void => {
    const t = consumeStr() || consumeExpression() || consumeLiteral();
    if (t) return t;

    const start = stream.pos;

    if (stream.match('[')) {
      stack.push({ start, type: StateType.IN_ARRAY, arrayIndex: 0 });
      return { js: '[', type: 'array' };
    }

    if (stream.match('{')) {
      stack.push({ start, type: StateType.IN_OBJECT_KEY });
      return { js: '{', type: 'object' };
    }
  };

  // -------------------------

  let lastPushedType: LCMLValueType = 'unknown';
  const maybePushJS = (s: { js: string; type: LCMLValueType } | void) => {
    if (!s) return false;

    lastPushedType = s.type;
    body.push(s.js);
    return true;
  };

  // -------------------------

  while (1) {
    consumeCommentAndSpaces();

    let stackTop: State = stack[stack.length - 1]!;
    let start = stream.pos;

    try {
      if (stream.eof()) {
        // end of expression
        if (stack.length > 1) throw new Error(`Unexpected end`);

        popPath({ end: start });
        break;
      }

      switch (stackTop.type) {
        case StateType.OUTMOST_BEGIN: {
          stackTop.type = StateType.VOID;

          if (maybePushJS(consumeValue())) {
            pushPath('', { start, type: lastPushedType });
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
            body.push('\n}');
            stack.pop();
            continue;
          }

          let key: string = '';

          let tmp = stream.match(RE_IDENTIFIER);
          if (tmp) key = tmp[0];

          if (!key) {
            const s = consumeStr();
            if (s) key = s.isDynamic ? `[${s.js}]` : s.parts[0].content;
          }

          if (!key) {
            const s = consumeExpression();
            if (s) key = `[${s.js}]`;
          }

          if (key) {
            pushPath(key, { start, propertyKeyEnd: stream.pos });
            body.push(key);
            stackTop.type = StateType.IN_OBJECT_COLON;
            continue;
          }

          throw new Error('Expect an identifier or string.');
        }

        case StateType.IN_OBJECT_COLON: {
          // expect a colon

          if (stream.match(':')) {
            body.push(': ');
            modPath({ propertyKeyEnd: start });
            stackTop.type = StateType.IN_OBJECT_VALUE;
            continue;
          }

          throw new Error('Expect a colon');
        }

        case StateType.IN_OBJECT_VALUE: {
          // change state before consuming!
          stackTop.type = StateType.IN_OBJECT_COMMA;

          if (maybePushJS(consumeValue())) {
            modPath({ propertyValueStart: start, type: lastPushedType });
            continue;
          }

          throw new Error('Expect a comma, right square bracket or item');
        }

        case StateType.IN_OBJECT_COMMA: {
          // available:
          // - ","
          // - }

          if (stream.match(',')) {
            body.push(',\n');
            popPath({ end: stream.pos });
            stackTop.type = StateType.IN_OBJECT_KEY;
            continue;
          }

          if (stream.match('}')) {
            // end of object
            body.push('\n}');
            popPath({ end: stream.pos });
            stack.pop();
            continue;
          }

          throw new Error('Expect a comma or right curly bracket');
        }

        case StateType.IN_ARRAY:
          {
            if (!stackTop.arrayNotAllowValue && maybePushJS(consumeValue())) {
              pushPath(stackTop.arrayIndex!, { start, type: lastPushedType });
              stackTop.arrayNotAllowValue = true;
              continue;
            }

            if (stream.match(',')) {
              if (stackTop.arrayNotAllowValue) popPath({ end: start });
              stackTop.arrayNotAllowValue = false;
              stackTop.arrayIndex!++;
              body.push(',\n');
              continue;
            }
            if (stream.match(']')) {
              if (stackTop.arrayNotAllowValue) popPath({ end: start });
              body.push('\n]');
              stack.pop();
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
    // type: rootType,
    paths: rootPaths,
    expressions,
  };
}
