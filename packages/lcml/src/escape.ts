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
  return str.replace(/\\(u([a-fA-F0-9]{4})|[^u])/g, (_, ch: string, unicode?: string) => {
    if (unicode) return String.fromCharCode(parseInt(unicode, 16));
    if (ch in escapeSequence) return escapeSequence[ch as keyof typeof escapeSequence];
    return ch;
  });
}
