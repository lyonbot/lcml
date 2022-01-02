import { unescapeString } from './string';

/**
 * @public
 */
export class StringStream {
  /** original whole string */
  raw: string;

  /** remaining characters to be processed */
  str: string;

  /** how many characters are consumed */
  pos: number;

  constructor(str: string | StringStream) {
    if (typeof str === 'string') {
      this.raw = str;
      this.str = str;
      this.pos = 0;
    } else {
      this.raw = str.raw;
      this.str = str.str;
      this.pos = str.pos;
    }
  }

  precede(length: number) {
    const taken = this.str.slice(0, length);
    this.str = this.str.slice(taken.length);
    this.pos += taken.length;
    return taken;
  }

  goto(chPos: number) {
    this.pos = chPos;
    this.str = this.raw.slice(chPos);
  }

  match(pattern: RegExp | string): RegExpMatchArray | null;
  match<T>(pattern: RegExp | string, preprocess: (result: RegExpMatchArray) => T | void): T | null;
  match(pattern: RegExp | string, preprocess?: (result: RegExpMatchArray) => any) {
    let matched: null | any[] = null;

    if (typeof pattern === 'string') {
      if (this.str.slice(0, pattern.length) === pattern) {
        matched = [pattern];
      }
    } else {
      const mat = this.str.match(pattern);
      if (mat && mat.index === 0 && mat[0].length > 0) {
        matched = mat;
      }
    }

    let ans: any = matched;
    if (matched && preprocess) ans = preprocess(matched);

    if (ans == null) return null;
    this.precede(matched![0].length);
    return ans;
  }

  /**
   * Match a text until the first bracket pair is closed
   *
   * ```txt
   * 5 ^ (1 * (2 + 3)) test
   * T   T           T
   * |   |           `-- first bracket pair ends. Stop here (inclusive)
   * |   `-- first bracket pair starts
   * `-- start here
   * ```
   *
   * @param brackets - bracket map `{ "(": ")", "[": "]" }`
   * @param escapeChars - the (back)slash
   */
  balanceMatch(brackets: Record<string, string>, escapeChars = '\\') {
    const stack = [] as string[];
    let i = 0;
    for (; i < this.str.length; i++) {
      const ch = this.str.charAt(i);
      if (escapeChars.includes(ch)) {
        i++;
      } else if (ch === stack[stack.length - 1]) {
        stack.pop();
        if (stack.length === 0) break;
      } else if (ch in brackets) {
        stack.push(brackets[ch]);
      }
    }
    if (stack.length !== 0 || i >= this.str.length) {
      return null; // reach the end but json not end
    }
    const value = this.str.slice(0, i + 1);
    this.goto(this.pos + i + 1);
    return value;
  }

  /**
   * find nearest `needle` and the `escapeChar` must NOT prepend to it.
   */
  indexOf(needles: string[], escapeChar = '\\') {
    needles = needles.filter(Boolean);

    let ans: null | { needle: string; pos: number } = null;
    for (let i = 0; i < needles.length; i++) {
      const needle = needles[i];
      let pos = -1;
      while ((pos = this.str.indexOf(needle, pos + 1)) !== -1) {
        if (this.str[pos - 1] !== escapeChar && (!ans || ans.pos > pos)) {
          ans = { pos, needle };
        }
      }
    }

    return ans;
  }

  /**
   * Match a quoted string.
   *
   * If the first character is not `"` or `'`, this will return null
   *
   * By default, the escaped chars will be transformed and the actual content of string is returned
   */
  stringMatch({ precede = true, raw = false } = {}) {
    const quote = this.str[0];
    if (quote !== '"' && quote !== "'") return null;
    let i = 1;
    let end = -1; // <=0 no matched end
    while (++i < this.str.length) {
      const ch = this.str[i];
      if (ch === '\\') {
        i++;
      }
      if (ch === quote) {
        end = i;
        break;
      }
    }

    if (end <= 0) return null;

    const ans = this.str.slice(0, end + 1);
    if (precede) this.precede(end + 1);
    return raw ? ans : unescapeString(ans.slice(1, -1));
  }

  eof() {
    return !this.str;
  }

  /**
   * get the next character without preceding
   *
   * @public
   */
  peek() {
    return this.str[0];
  }

  skipSpace() {
    const mat = this.str.match(/^\s+/);
    if (mat) this.precede(mat[0].length);
  }
}
