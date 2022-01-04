import { parseArray } from './parseArray';
import { parseExpression } from './parseExpression';
import { parseLiteral } from './parseLiteral';
import { parseObject } from './parseObject';
import { parseString } from './parseString';
import { StringStream } from '../StringStream';

type NotVoid<T> = T extends void | null | undefined ? never : T;
export type ParsedValueNode = NotVoid<ReturnType<typeof parseValue>>;

export function parseValue(stream: StringStream, top: string) {
  return (
    parseString(stream, top) ||
    parseExpression(stream, top) ||
    parseArray(stream, top) ||
    parseObject(stream, top) ||
    parseLiteral(stream, top)
  );
}
