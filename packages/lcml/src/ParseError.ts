import type { StringStream } from './StringStream';

export class ParseError extends Error {
  stringStream: StringStream;
  position: number;

  constructor(message: string, stream: StringStream, position?: number) {
    position = position ?? stream.pos;
    super(`Cannot parse: ${message} (at :${position})`);

    this.stringStream = stream;
    this.position = position;
  }
}
