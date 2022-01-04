import { ParsedNodeBase, makeParsedNode } from './base';
import { StringStream } from '../StringStream';

export interface ParsedCommentNode extends ParsedNodeBase {
  type: 'comment';
}

export function parseComment(stream: StringStream, top: string) {
  if (!(top === '/')) return;

  // maybe comment
  const lead = stream.peek(2);
  const end = lead === '//' ? ['\n', '\r'] : lead === '/*' ? ['*/'] : null;
  if (!end) return;

  // skip leading and find ending token
  // if ending token is not found, skip to the end of the stream
  const endToken = stream.indexOf(end, 2);

  return makeParsedNode<ParsedCommentNode>(stream, {
    type: 'comment',
    parsedLength: endToken ? endToken.endOffset : stream.remainderLength,
  });
}
