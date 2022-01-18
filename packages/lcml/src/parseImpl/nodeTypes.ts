import type { ParsedArrayNode } from './parseArray';
import type { ParsedCommentNode } from './parseComment';
import type { ParsedExpressionNode } from './parseExpression';
import type { ParsedBooleanNode, ParsedNullishNode, ParsedNumberNode, ParsedLiteralNode } from './parseLiteral';
import type { ParsedObjectPropertyNode, ParsedObjectNode } from './parseObject';
import type { ParsedStringNode, ParsedStringSegmentNode } from './parseString';
import type { ParsedIdentifierNode } from './parseIdentifier';
import type { ParsedValueNode } from './parseValue';

export interface ParsedNodeTypeLUT {
  'array': ParsedArrayNode;
  'comment': ParsedCommentNode;
  'expression': ParsedExpressionNode;
  'boolean': ParsedBooleanNode;
  'nullish': ParsedNullishNode;
  'number': ParsedNumberNode;
  // "literal": ParsedLiteralNode;
  'object-property': ParsedObjectPropertyNode;
  'object': ParsedObjectNode;
  'string': ParsedStringNode;
  'string-segment': ParsedStringSegmentNode;
  'identifier': ParsedIdentifierNode;
  // "value": ParsedValueNode;
}

type TempCheck1 = { [x in keyof ParsedNodeTypeLUT]: ParsedNodeTypeLUT[x] extends { type: x } ? never : x };
type BadItemsInLUT = TempCheck1[keyof TempCheck1];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _check__noBadItemsInLUT: BadItemsInLUT extends never ? true : false = true;

export type ParsedNode = ParsedNodeTypeLUT[keyof ParsedNodeTypeLUT];

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
