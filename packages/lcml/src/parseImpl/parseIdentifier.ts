import { ParsedNodeBase, makeParsedNode } from './base';
import { StringStream } from '../StringStream';
import { isDigit, isWordChar } from '../string';

export interface ParsedIdentifierNode extends ParsedNodeBase {
  type: 'identifier';
  raw: string;
}

export function parseIdentifier(stream: StringStream, top: string): ParsedIdentifierNode | void {
  if (isDigit(top) || !isWordChar(top)) return;

  const ss = stream.clone(1);
  const end = ss.find(n => !isWordChar(n));
  ss.precede(end ? end.offset : ss.remainderLength);

  const parsedLength = ss.pos - stream.pos;
  return makeParsedNode<ParsedIdentifierNode>(stream, {
    type: 'identifier',
    parsedLength: parsedLength,
    raw: stream.substr(0, parsedLength),
  });
}
