const escapeSequence = {
  b: '\b',
  f: '\f',
  n: '\n',
  r: '\r',
  t: '\t',
  v: '\v',
};

/**
 * convert escaped characters (eg. `\t`) into actual characters
 *
 * @param str - the string containing escaping characters
 * @returns processed result
 */
export function unescapeString(str: string) {
  return str.replace(
    /\\(u([a-fA-F0-9]{4})|x([a-fA-F0-9]{2})|[^ux])/g,
    (_, ch: string, unicode?: string, unicode2?: string) => {
      const u = unicode || unicode2;
      if (u) return String.fromCharCode(parseInt(u, 16));
      if (ch in escapeSequence) return escapeSequence[ch as keyof typeof escapeSequence];
      return ch;
    },
  );
}

const makeInRangeFunction = (ranges: string, inverse?: boolean) => {
  const parts = [] as string[];
  for (let i = 0; i < ranges.length; i++) {
    const cc = ranges.charCodeAt(i);
    if (ranges[i + 1] === '-') {
      const ub = ranges.charCodeAt(i + 2);
      parts.push(`(c >= ${cc} && c <= ${ub})`);
      i += 2;
    } else {
      parts.push(`c==${cc}`);
    }
  }

  return new Function('c', `c=c.charCodeAt(0);return ${inverse ? '!' : ''}(${parts.join('||')})`) as (
    c: string,
  ) => boolean;
};

export const isNonWordCharacter = (c: string) => {
  if (c === '_' || isDigit(c) || isLetter(c)) return false;
  return true;
};

export const isWhitespaceCharacter = makeInRangeFunction(' \t\r\n\v\f');
export const isDigit = makeInRangeFunction('0-9');
export const isLetter = makeInRangeFunction('a-zA-Z');

/** not-strictly  */
export const isWordChar = makeInRangeFunction(`-\`"' \t\r\n\v\f(){}<>,#!?:;.=&@%^+*~/|\\`, true);
