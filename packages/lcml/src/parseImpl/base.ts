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
  hook: null as ((node: ParsedNodeBase) => void) | null | undefined,
};
const ctxOpts = { ...defaultCtxOpts };

export function startParsing(opts: Partial<typeof ctxOpts>) {
  Object.assign(ctxOpts, defaultCtxOpts, opts);
  _isRecovering = null;
}
export function endParsing() {
  Object.assign(ctxOpts, defaultCtxOpts);
  _isRecovering = null;
}

// while recovering,
// array and object's parsing processes are stopped
// and partially parsed result is generated, returned

let _isRecovering: ParseError | null = null;
export const isRecovering = () => _isRecovering;

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

  if (ctxOpts.hook) ctxOpts.hook(answer);
  return answer;
}

/**
 * if current parsing process allows recovering, this set internal `isRecovering` flag to true, call `partialFinalizer()` and returns.
 *
 * otherwise, create a new ParseError and throw it
 */
export function makePanic<T extends ParsedNodeBase>(
  partialFinalizer: () => T,
  ...args: ConstructorParameters<typeof ParseError>
) {
  const error = new ParseError(...args);
  _isRecovering = error;
  return partialFinalizer();
  // throw error;
}
