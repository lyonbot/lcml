import { isWhitespaceCharacter } from './string';

export class StringStream {
  raw: string;
  pos: number;
  remainderLength: number;

  constructor(raw: string) {
    this.raw = raw;
    this.pos = 0;
    this.remainderLength = raw.length;
  }

  /**
   * clone the status of this stream
   *
   * @public
   */
  clone(precedeLength?: number) {
    const n = new StringStream(this.raw);
    n.pos = this.pos;
    n.remainderLength = this.remainderLength;
    if (precedeLength) n.precede(precedeLength);

    return n;
  }

  /**
   * peek the next one or more characters
   *
   * @public
   */
  peek(length?: number): string {
    if (length && length > 1) return this.raw.substr(this.pos, length);
    return this.raw[this.pos];
  }

  /**
   * call substr since current pos
   *
   * @public
   */
  substr(sinceOffset: number, length?: number): string {
    if (length === 0) return '';
    return this.raw.substr(this.pos + sinceOffset, length);
  }

  /**
   * tell if the stream reaches the end
   *
   * @public
   */
  eof() {
    return this.pos >= this.raw.length;
  }

  /**
   * update this.pos
   *
   * @public
   */
  precede(length: number) {
    if (length <= 0) return;
    if (length > this.remainderLength) length = this.remainderLength;
    this.pos += length;
    this.remainderLength -= length;
  }

  /**
   * skip spaces since current pos
   *
   * @public
   * @returns space characters' count
   */
  skipSpaces(): number {
    const from = this.pos;
    let np = this.pos;
    while (np < this.raw.length) {
      const top = this.raw[np];
      if (isWhitespaceCharacter(top)) np++;
      else break;
    }

    this.precede(np - this.pos);
    return np - from;
  }

  /**
   * find needle's position since current this.pos
   *
   * @public
   * @param needle - the string to find
   * @param sinceOffset - relative to this.pos
   * @returns first-appearing needle and its offset to this.pos
   */
  indexOf(
    needle: string | string[] | null | undefined,
    sinceOffset?: number,
  ): { needle: string; offset: number; endOffset: number } | undefined {
    if (!needle) return;

    const ns = typeof needle === 'string' ? [needle] : needle.filter(Boolean);
    if (!ns.length) return;

    const pos0 = this.pos;
    for (let pos = pos0 + (sinceOffset || 0); pos < this.raw.length; pos++) {
      for (let j = 0; j < ns.length; j++) {
        const n = ns[j];
        const subStr = n.length === 1 ? this.raw[pos] : this.raw.substr(pos, n.length);
        if (subStr === n)
          return {
            needle: n,
            offset: pos - pos0,
            endOffset: pos + n.length - pos0,
          };
      }
    }
  }

  /**
   * find needle's position with predicate function
   *
   * @public
   * @param sinceOffset - relative to this.pos
   * @returns first-appearing needle and its offset to this.pos
   */
  find(
    predict: (needle: string) => boolean,
    needleLength = 1,
    sinceOffset = 0,
  ): { needle: string; offset: number } | undefined {
    const maxOffset = this.raw.length - needleLength;
    for (let pos = this.pos + (sinceOffset || 0); pos <= maxOffset; pos++) {
      const needle = needleLength === 1 ? this.raw[pos] : this.raw.substr(pos, needleLength);
      if (predict(needle))
        return {
          needle,
          offset: pos - this.pos,
        };
    }
  }
}
