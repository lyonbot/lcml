import { ParsedNodeBase, makeParsedNode, isHaltingParser, commitParseError } from './base';
import { parseComment } from './parseComment';
import { parseExpression, ParsedExpressionNode } from './parseExpression';
import { parseString, ParsedStringNode } from './parseString';
import { StringStream } from '../StringStream';
import { parseValue, ParsedValueNode } from './parseValue';
import { ParsedIdentifierNode, parseIdentifier } from './parseIdentifier';

export interface ParsedObjectPropertyNode extends ParsedNodeBase {
  type: 'object-property';

  key: ParsedStringNode | ParsedExpressionNode | ParsedIdentifierNode;
  value: ParsedValueNode | null;

  hasColon: boolean;
  colonStart?: number;

  hasTrailingComma: boolean;
  trailingCommaStart?: number;
}

export interface ParsedObjectNode extends ParsedNodeBase {
  type: 'object';
  properties: ParsedObjectPropertyNode[];
}

const enum LocalState {
  IDENTIFIER_OR_END,
  COLON,
  VALUE,
  COMMA_OR_END,
}

const errorMessages: Record<LocalState, string> = {
  [LocalState.IDENTIFIER_OR_END]: `expect property identifier or right curly bracket`,
  [LocalState.COLON]: `expect colon`,
  [LocalState.VALUE]: `expect property value`,
  [LocalState.COMMA_OR_END]: `expect comma or right curly bracket`,
};

/**
 * @param stream assume the leading token is identifier
 */
const tryStartPropertyNode = (stream: StringStream, top: string) => {
  const key = parseString(stream, top) || parseExpression(stream, top) || parseIdentifier(stream, top);
  if (!key) return;

  return makeParsedNode<ParsedObjectPropertyNode>(stream, {
    type: 'object-property',
    key,
    parsedLength: key.parsedLength,
    value: null,
    hasTrailingComma: false,
    hasColon: false,
  });
};

export function parseObject(stream: StringStream, top: string): ParsedObjectNode | void {
  if (top !== '{') return;
  if (stream.peek(2) === '{{') return; // weird unfinished string

  const ss = stream.clone(1);

  const properties = [] as ParsedObjectNode['properties'];

  let state = LocalState.IDENTIFIER_OR_END;
  let current!: ParsedObjectPropertyNode;
  let finished = false;

  const finalize = () =>
    makeParsedNode<ParsedObjectNode>(stream, {
      type: 'object',
      parsedLength: ss.pos - stream.pos,
      properties,
    });

  while (!isHaltingParser() && !finished && (ss.skipSpaces(), !ss.eof())) {
    const top = ss.peek();

    const comment = parseComment(ss, top);
    if (comment) {
      ss.precede(comment.parsedLength);
      continue;
    }

    if (state === LocalState.IDENTIFIER_OR_END) {
      if (top === '}') {
        ss.precede(1);
        finished = true;
        break;
      }

      const nextProperty = tryStartPropertyNode(ss, top);
      if (nextProperty) {
        // find one
        current = nextProperty;
        properties.push(current);

        ss.precede(nextProperty.key.parsedLength);
        state = LocalState.COLON;
        continue;
      }
    }

    if (state === LocalState.COLON) {
      if (top === ':') {
        current.hasColon = true;
        current.colonStart = ss.pos;
        current.end = ss.pos + 1;
        current.parsedLength = current.end - current.start;

        ss.precede(1);
        state = LocalState.VALUE;
        continue;
      }
    }

    if (state === LocalState.VALUE) {
      const value = parseValue(ss, top);

      if (value) {
        current.value = value;
        current.end = value.end;
        current.parsedLength = current.end - current.start;

        ss.precede(value.parsedLength);
        state = LocalState.COMMA_OR_END;
        continue;
      }
    }

    if (state === LocalState.COMMA_OR_END) {
      if (top === '}') {
        ss.precede(1);
        finished = true;
        break;
      }

      if (top === ',') {
        current.hasTrailingComma = true;
        current.trailingCommaStart = ss.pos;
        current.end = ss.pos + 1;
        current.parsedLength = current.end - current.start;

        ss.precede(1);
        state = LocalState.IDENTIFIER_OR_END;
        continue;
      }
    }

    // not handled input
    // commit a error and try recovering

    commitParseError(errorMessages[state], ss);
    const recoverTo = ss.indexOf([',', state !== LocalState.COLON ? ':' : '', '}']);
    if (!recoverTo) break;

    if (recoverTo.needle === ':') {
      // if colon found, try to compose a property
      const nextProperty = tryStartPropertyNode(ss, top);
      if (nextProperty) {
        current = nextProperty;
        properties.push(current);
      } else {
        // make a blackhole
        current = {} as ParsedObjectPropertyNode;
      }
      state = LocalState.COLON;
    } else {
      state = LocalState.COMMA_OR_END;
    }

    ss.precede(recoverTo.offset);
  }

  if (!isHaltingParser() && !finished) {
    commitParseError(errorMessages[state], ss);
  }

  return finalize();
}
