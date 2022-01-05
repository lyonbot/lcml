import { parseComment } from './parseImpl/parseComment';
import { parseValue } from './parseImpl/parseValue';
import { ParseError } from './ParseError';
import { StringStream } from './StringStream';
import { endParsing, isHaltingParser, startParsing } from './parseImpl/base';
import { ParsedExpressionNode } from './parseImpl/exports';
import { internalParseStringContent } from './parseImpl/parseString';

/**
 * parser options
 *
 * @public
 */
export interface ParseOptions {
  /**
   * treat invalid inputs as string. see README
   */
  loose?: boolean;

  /**
   * when input is empty, what shall be returned?
   *
   * @default "as-undefined"
   */
  treatEmptyInput?: 'as-undefined' | 'as-empty-string';

  /**
   * after parsing something, if there is still characters left unparsed, shall we just ignore them, or treat as error
   */
  ignoreUnparsedRemainder?: boolean;

  /**
   * when error occurs
   *
   * - `"throw"` (default) - a ParseError will be thrown
   * - `"return"` - stop parsing. the ParseError will be returned along with partially-parsed ast
   * - `"recover"` - try to continue parsing. mulitple `ParseError`s will be returned along with partially-parsed ast 
   * - `"as-string"` - discard all parsed structures and treat whole input as a string with expressions
   *
   * @default "throw"
   */
  onError?: 'throw' | 'return' | 'recover' | 'as-string';
}

export type ParseResult = ReturnType<typeof parse>;

/**
 * skip leading comments and parse the value
 *
 * @public
 */
export function parse(str: string, opts: ParseOptions = {}) {
  const expressions = [] as ParsedExpressionNode[];
  const errors = [] as ParseError[];

  try {
    const addError = (error: ParseError): void => {
      errors.push(error);
    };

    startParsing({
      recover: opts.onError === 'recover',
      onNode: node => {
        if (node.type === 'expression') expressions.push(node as ParsedExpressionNode);
      },
      onError: addError,
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

    let isInputEmpty = false;

    if (stream.eof()) {
      // after removing comments
      // nothing left
      // we shall make a fake LCML input

      const placeholder = opts.treatEmptyInput === 'as-empty-string' ? '""' : 'undefined';
      stream = new StringStream(new Array(actualStart).fill(' ').join('') + placeholder);
      stream.precede(actualStart);
      isInputEmpty = true; //later fix the location info
    }

    const top = stream.peek();
    let ast = parseValue(stream, top);

    if (ast) {
      // successfully parsed something

      if (isInputEmpty) {
        // input LCML is fake!
        ast.parsedLength = 0;
        ast.end = ast.start;
      }

      stream.precede(ast.parsedLength);
      stream.skipSpaces();
    } else {
      // nothing parsed, we shall throw a error
      addError(new ParseError('invalid input', stream));
    }

    // see README the "Loose Mode" part's Note
    const firstType = ast && ast.type;
    const mayLoose = !!opts.loose && firstType !== 'string' && firstType !== 'array' && firstType !== 'object';

    // do extra check here: is EOF reached?
    // by default, treat unparsed part as error
    // but they can also be ignored
    if (!errors.length && !stream.eof() && (mayLoose || !opts.ignoreUnparsedRemainder)) {
      // special note: when loose mode works,
      // always make a error to trigger following as-string logic
      addError(new ParseError('unexpected remainder', stream));
    }

    // now convert
    const asString = !!errors.length && (mayLoose || opts.onError === 'as-string');
    if (asString) {
      // discard all parsed structures
      // treat whole input as string
      const stream = new StringStream(str);
      stream.precede(actualStart);
      ast = internalParseStringContent(stream, '');

      if (mayLoose) errors.splice(0); // remove all errors
    }

    // finally throw error if needed
    if (errors.length && (opts.onError || 'throw') === 'throw') {
      throw errors[0]!;
    }

    return {
      ast,
      expressions,
      actualStart,
      end: actualStart + (ast ? ast.parsedLength : 0),
      error: errors[0] as ParseError | null,
      errors,
      looseModeEnabled: asString && mayLoose,
    };
  } finally {
    endParsing();
  }
}
