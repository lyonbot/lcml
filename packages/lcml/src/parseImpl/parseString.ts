import { ParsedNodeBase, makeParsedNode, commitParseError } from './base';
import { parseExpression, ParsedExpressionNode } from './parseExpression';
import { StringStream } from '../StringStream';

export interface ParsedStringSegmentNode extends ParsedNodeBase {
  type: 'string-segment';
  raw: string;
}

export interface ParsedStringNode extends ParsedNodeBase {
  type: 'string';
  /**
   * this array must has length 1,3,5...
   * - odd (0,2,4) items are `string-segment` (containing raw string with possible escape sequences)
   * - even (1,3) items are `expression`
   */
  segments: (ParsedExpressionNode | ParsedStringSegmentNode)[];
  quote: string;
  isDynamic: boolean;
}

export function parseString(stream: StringStream, top: string): ParsedStringNode | void {
  if (!(top === '"' || top === "'")) return;

  return internalParseStringContent(stream, top);
}

/**
 * assuming the leading quote is consumed.
 * parse remainder as string content
 *
 * @param quote - optional. if empty string, will parse until EOF
 */
export function internalParseStringContent(stream: StringStream, quote: string): ParsedStringNode | void {
  const needles = ['\\', quote, '{'];
  const segments: ParsedStringNode['segments'] = [];

  const ss = stream.clone(quote.length);

  const finalize = () =>
    makeParsedNode<ParsedStringNode>(stream, {
      type: 'string',
      parsedLength: ss.pos - stream.pos,
      segments,
      quote,
      isDynamic: segments.length > 1,
    });

  let indexOfSince = 0;

  const pushStringSegmentAndPrecede = (len: number) => {
    segments.push(
      makeParsedNode<ParsedStringSegmentNode>(ss, {
        type: 'string-segment',
        parsedLength: len,
        raw: ss.substr(0, len),
      }),
    );

    indexOfSince = 0;
    ss.precede(len);
  };

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const tk = ss.indexOf(needles, indexOfSince);

    if (!tk) {
      pushStringSegmentAndPrecede(ss.remainderLength);
      if (!quote) {
        // no quote char, normally parse to the EOF
        return finalize();
      } else {
        // expect a quote but not found, throw an error
        commitParseError('expect end of string', stream, stream.raw.length);
        break
      }
    }

    if (tk.needle === '\\') {
      // escaped char, skip its next sibling char
      indexOfSince = tk.endOffset + 1;
      continue;
    }

    if (tk.needle === quote) {
      // find the end of the string
      pushStringSegmentAndPrecede(tk.offset);
      ss.precede(quote.length); // precede quote
      break;
    }

    if (tk.needle === '{') {
      // find the beginning of expression
      const expr = parseExpression(ss.clone(tk.offset), '{');
      if (!expr) {
        indexOfSince = tk.endOffset;
        continue;
      }

      pushStringSegmentAndPrecede(tk.offset);
      segments.push(expr);
      ss.precede(expr.parsedLength);

      continue;
    }
  }

  // successfully get segments
  return finalize();
}
