import { parse, ParseOptions, ParseResult } from './parse';
import { toJS, ToJSOptions } from './toJS';

export interface CompileOptions extends ParseOptions, ToJSOptions {
  /* */
}

export interface CompileResult extends ParseResult {
  body: string;
}

export function compile(input: string, options: CompileOptions = {}): CompileResult {
  const parsed = parse(input, options);
  const body = parsed.ast ? toJS(parsed.ast, options) : 'undefined';

  return { ...parsed, body };
}
