import { ParsedNodeBase, makeParsedNode } from './base';
import { StringStream } from '../StringStream';

export interface ParsedExpressionNode extends ParsedNodeBase {
  type: 'expression';
  expression: string;
  expressionStart: number;
  expressionEnd: number;
  leftBracket: string;
  rightBracket: string;
}

export function parseExpression(stream: StringStream, top: string): ParsedExpressionNode | void {
  if (top !== '{') return;
  if (stream.peek(2) !== '{{') return;

  // we support {{{ expression }}}
  let bracketLength = 2;
  while (stream.substr(bracketLength, 1) === '{') bracketLength++;

  const leftBracket = stream.substr(0, bracketLength);
  const rightBracket = '}'.repeat(bracketLength);

  const endToken = stream.indexOf(rightBracket, bracketLength);
  if (!endToken) return;

  return makeParsedNode<ParsedExpressionNode>(stream, {
    type: 'expression',
    parsedLength: endToken.endOffset,
    expression: stream.substr(bracketLength, endToken.offset - bracketLength),
    expressionStart: bracketLength + stream.pos,
    expressionEnd: endToken.offset + stream.pos,
    leftBracket,
    rightBracket,
  });
}
