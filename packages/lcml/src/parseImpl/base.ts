import { ParseError } from '../ParseError';
import type { StringStream } from '../StringStream';

const $$isParsedNode = Symbol();

export interface ParsedNodeBase {
  [$$isParsedNode]: true;
  type: string;
  start: number;
  end: number;
  parsedLength: number;
}

export function isParsedNode(x: any): x is ParsedNodeBase {
  return typeof x === 'object' && x !== null && x[$$isParsedNode] === true;
}

const defaultCtxOpts = {
  recover: false, // if false, when met error, all remainder will be skipped
  onNode: null as ((node: ParsedNodeBase) => void) | null,
  onError: null as ((error: ParseError) => void) | null,
};
const ctxOpts = { ...defaultCtxOpts };

export function startParsing(opts: Partial<typeof ctxOpts>) {
  Object.assign(ctxOpts, defaultCtxOpts, opts);
  _isHalting = null;
}
export function endParsing() {
  Object.assign(ctxOpts, defaultCtxOpts);
  _isHalting = null;
}

// while recovering,
// array and object's parsing processes are stopped
// and partially parsed result is generated, returned

let _isHalting: ParseError | null = null;
export const isHaltingParser = () => _isHalting;

export function makeParsedNode<T extends ParsedNodeBase>(
  sourceStream: StringStream,
  extra: Omit<T, 'start' | 'end' | typeof $$isParsedNode>,
): T {
  const parsedLength = extra.parsedLength;

  const answer = {
    ...extra,
    start: sourceStream.pos,
    end: sourceStream.pos + parsedLength,
  } as T;

  Object.defineProperty(answer, $$isParsedNode, {
    configurable: true,
    enumerable: false,
    value: true,
  });

  if (ctxOpts.onNode) ctxOpts.onNode(answer);
  return answer;
}

/**
 * if current parsing process disallows recovering,
 * this set internal `_isHalting` flag to true
 */
export function commitParseError(...args: ConstructorParameters<typeof ParseError>) {
  const error = new ParseError(...args);
  if (ctxOpts.onError) ctxOpts.onError(error);
  if (!ctxOpts.recover) _isHalting = error;
}
