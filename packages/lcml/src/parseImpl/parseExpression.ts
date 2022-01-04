import { ParsedNodeBase, makeParsedNode } from './base';
import { StringStream } from '../StringStream';

export interface ParsedExpressionNode extends ParsedNodeBase {
  type: 'expression';
  expression: string;
  expressionStart: number;
  expressionEnd: number;
}

export function parseExpression(stream: StringStream, top: string): ParsedExpressionNode | void {
  if (top !== '{') return;
  if (stream.peek(2) !== '{{') return;

  const endToken = stream.indexOf('}}', 2);
  if (!endToken) return;

  return makeParsedNode<ParsedExpressionNode>(stream, {
    type: 'expression',
    parsedLength: endToken.endOffset,
    expression: stream.substr(2, endToken.offset - 2),
    expressionStart: 2 + stream.pos,
    expressionEnd: endToken.offset + stream.pos,
  });
}
