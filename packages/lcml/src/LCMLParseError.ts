import type { StringStream } from './StringStream';

export class LCMLParseError extends Error {
  position: number;
  stream: StringStream;

  constructor(error: Error, position: number, stream: StringStream) {
    super(error.message);
    this.stack = error.stack;
    this.position = position;
    this.stream = stream;
  }
}
