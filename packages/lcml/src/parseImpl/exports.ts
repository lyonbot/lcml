export { ParseError } from '../ParseError';
export { isParsedNode, ParsedNodeBase } from './base';

import type { ParsedArrayNode } from './parseArray';
import type { ParsedCommentNode } from './parseComment';
import type { ParsedExpressionNode } from './parseExpression';
import type { ParsedBooleanNode, ParsedNullishNode, ParsedNumberNode, ParsedLiteralNode } from './parseLiteral';
import type { ParsedObjectPropertyNode, ParsedObjectNode } from './parseObject';
import type { ParsedStringNode, ParsedStringSegmentNode } from './parseString';
import type { ParsedIdentifierNode } from './parseIdentifier';
import type { ParsedValueNode } from './parseValue';

export type ParsedNode =
  | ParsedArrayNode
  | ParsedCommentNode
  | ParsedExpressionNode
  | ParsedBooleanNode
  | ParsedNullishNode
  | ParsedNumberNode
  | ParsedLiteralNode
  | ParsedObjectPropertyNode
  | ParsedObjectNode
  | ParsedStringNode
  | ParsedStringSegmentNode
  | ParsedIdentifierNode
  | ParsedValueNode;

export {
  ParsedArrayNode,
  ParsedCommentNode,
  ParsedExpressionNode,
  ParsedBooleanNode,
  ParsedNullishNode,
  ParsedNumberNode,
  ParsedLiteralNode,
  ParsedObjectPropertyNode,
  ParsedObjectNode,
  ParsedStringNode,
  ParsedStringSegmentNode,
  ParsedIdentifierNode,
  ParsedValueNode,
};
