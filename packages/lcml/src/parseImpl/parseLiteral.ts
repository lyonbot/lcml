import { ParsedNodeBase, makeParsedNode } from './base';
import { StringStream } from '../StringStream';
import { isNonWordCharacter } from '../string';

export interface ParsedNumberNode extends ParsedNodeBase {
  type: 'number';
  raw: string;
  value: number;
}

export interface ParsedBooleanNode extends ParsedNodeBase {
  type: 'boolean';
  raw: string;
  value: boolean;
}

export interface ParsedNullishNode extends ParsedNodeBase {
  type: 'nullish';
  /** @example - `'null' | 'undefined'` */
  raw: string;
}

export type ParsedLiteralNode = ParsedNumberNode | ParsedBooleanNode | ParsedNullishNode;

export function parseLiteral(stream: StringStream, top: string): ParsedLiteralNode | void {
  const matchRaw = (s: string) =>
    top === s[0] && stream.peek(s.length) === s && isNonWordCharacter(stream.substr(s.length, 1)) ? s : false;

  let raw: string | false;

  if ((raw = matchRaw('true') || matchRaw('false'))) {
    return makeParsedNode<ParsedBooleanNode>(stream, {
      type: 'boolean',
      parsedLength: raw.length,
      raw,
      value: raw === 'true',
    });
  }

  if ((raw = matchRaw('null') || matchRaw('undefined'))) {
    return makeParsedNode<ParsedNullishNode>(stream, {
      type: 'nullish',
      parsedLength: raw.length,
      raw,
    });
  }

  if ((raw = matchRaw('Infinity') || matchRaw('NaN'))) {
    return makeParsedNode<ParsedNumberNode>(stream, {
      type: 'number',
      parsedLength: raw.length,
      raw,
      value: raw === 'NaN' ? NaN : Infinity,
    });
  }

  if ((raw = matchRaw('-Infinity') || matchRaw('+Infinity'))) {
    return makeParsedNode<ParsedNumberNode>(stream, {
      type: 'number',
      parsedLength: raw.length,
      raw,
      value: raw[0] === '-' ? -Infinity : Infinity,
    });
  }

  // ----------------------
  if (top === '+' || top === '-' || top === '.' || (top >= '0' && top <= '9')) {
    const remainder = stream.substr(0);
    const tmp =
      /^[+-]?0(?:b[01]+|o[0-7]+|x[0-9a-fA-F]+)(?![\w.])/.exec(remainder) || // hex and octal
      /^[+-]?(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?(?![\w.])/.exec(remainder); // regular number

    if (tmp) {
      raw = tmp[0];
      return makeParsedNode<ParsedNumberNode>(stream, {
        type: 'number',
        parsedLength: raw.length,
        raw,
        value: parseFloat(raw),
      });
    }
  }
}
