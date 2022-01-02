const escapeSequence = {
  b: '\b',
  f: '\f',
  n: '\n',
  r: '\r',
  t: '\t',
  v: '\v',
};

export const RE_IDENTIFIER = /^[_$a-zA-Z][_$a-zA-Z0-9]*$/;

/**
 * convert escaped characters (eg. `\t`) into actual characters
 *
 * @param str - the string containing escaping characters
 * @returns processed result
 */
export function unescapeString(str: string) {
  return str.replace(/\\(u([a-fA-F0-9]{4})|[^u])/g, (_, ch: string, unicode?: string) => {
    if (unicode) return String.fromCharCode(parseInt(unicode, 16));
    if (ch in escapeSequence) return escapeSequence[ch as keyof typeof escapeSequence];
    return ch;
  });
}

export function isIdentifier(str: string) {
  return RE_IDENTIFIER.test(str);
}
