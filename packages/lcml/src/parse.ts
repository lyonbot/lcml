import { parseComment } from './parseImpl/parseComment';
import { parseValue } from './parseImpl/parseValue';
import { ParseError } from './ParseError';
import { StringStream } from './StringStream';
import { endParsing, isRecovering, startParsing } from './parseImpl/base';
import { ParsedExpressionNode } from './parseImpl/exports';
import { internalParseStringContent } from './parseImpl/parseString';

/**
 * parser options
 *
 * @public
 */
export interface ParseOptions {
  /**
   * when input is empty, what shall be returned?
   *
   * @default "as-undefined"
   */
  treatEmptyInput?: 'as-undefined' | 'as-empty-string';

  /**
   * after parsing something, if there is still characters left unparsed, shall we just ignore them, or treat as error
   *
   * @default "error"
   */
  treatUnparsedRemainder?: 'as-error' | 'ignore';

  /**
   * when error occurs
   *
   * - `"throw"` (default) - a ParseError will be thrown
   * - `"recover"` - error and partial-parsed result will be return together without throwing
   * - `"as-string"` - discard all parsed structures and treat whole input as a string with expressions
   *
   * @default "throw"
   */
  onError?: 'throw' | 'recover' | 'as-string';
}

export type ParseResult = ReturnType<typeof parse>;

/**
 * skip leading comments and parse the value
 *
 * @public
 */
export function parse(str: string, opts: ParseOptions = {}) {
  const expressions = [] as ParsedExpressionNode[];

  try {
    startParsing({
      hook: node => {
        if (node.type === 'expression') expressions.push(node as ParsedExpressionNode);
      },
    });

    let stream = new StringStream(str);

    // skip leading comments

    while ((stream.skipSpaces(), !stream.eof())) {
      const top = stream.peek();

      const t = parseComment(stream, top);
      if (!t) break;
      stream.precede(t.parsedLength);
    }

    // start consuming value

    const actualStart = stream.pos;

    let error: ParseError | null = null;

    if (stream.eof()) {
      // see opts.emptyInput
      const placeholder = opts.treatEmptyInput === 'as-empty-string' ? '""' : 'undefined';
      stream = new StringStream(new Array(actualStart).fill(' ').join('') + placeholder);
      stream.precede(actualStart);
    }

    const top = stream.peek();
    let ast = parseValue(stream, top);

    if (!ast) {
      stream.precede(actualStart);
      ast = internalParseStringContent(stream, '')!; // empty input is processed above
    }

    // successfully parsed something
    stream.precede(ast.parsedLength);
    stream.skipSpaces();

    error = isRecovering();

    // do extra check here: is EOF reached?
    if (!error && !stream.eof()) {
      if (ast.type === 'expression') {
        // special case. see README.md
        const stream = new StringStream(str);
        stream.precede(actualStart);
        ast = internalParseStringContent(stream, '');
      } else if (opts.treatUnparsedRemainder !== 'ignore') {
        // by default, treat unparsed part as error
        error = new ParseError('unexpected remainder', stream);
      }
    }

    if (error && (opts.onError || 'throw') === 'throw') {
      throw error;
    }

    if (error && opts.onError === 'as-string') {
      // discard all parsed structures
      // treat whole input as string
      const stream = new StringStream(str);
      stream.precede(actualStart);
      ast = internalParseStringContent(stream, '');
    }

    return {
      ast,
      expressions,
      actualStart,
      end: actualStart + (ast ? ast.parsedLength : 0),
      error,
    };
  } finally {
    endParsing();
  }
}
