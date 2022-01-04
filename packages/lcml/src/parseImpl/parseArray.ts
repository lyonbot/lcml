import { ParsedNodeBase, makeParsedNode, isRecovering, makePanic } from './base';
import { parseComment } from './parseComment';
import { StringStream } from '../StringStream';
import { parseValue, ParsedValueNode } from './parseValue';

export interface ParsedArrayNode extends ParsedNodeBase {
  type: 'array';
  length: number;
  items: (ParsedValueNode | null)[];
  itemsLocation: {
    hasValue: boolean;
    valueStart: number;
    valueEnd: number;

    hasTrailingComma?: boolean;
    trailingCommaStart?: number;
  }[];
}

export function parseArray(stream: StringStream, top: string): ParsedArrayNode | void {
  if (top !== '[') return;

  const ss = stream.clone(1);

  const items = [] as ParsedArrayNode['items'];
  const itemsLocation = [] as ParsedArrayNode['itemsLocation'];

  let index = 0;
  let slotEmpty = true;
  let finished = false;

  const finalize = () => {
    let length = itemsLocation.length;
    if (length > 2 && !itemsLocation[length - 1].hasValue) {
      // remove invalid empty slot made by trailing comma
      length--;
      itemsLocation.pop();
    }

    return makeParsedNode<ParsedArrayNode>(stream, {
      type: 'array',
      parsedLength: ss.pos - stream.pos,
      length,
      items: itemsLocation.map((_, i) => items[i] || null),
      itemsLocation,
    });
  };

  while (!isRecovering() && !finished && (ss.skipSpaces(), !ss.eof())) {
    const top = ss.peek();
    if (top === ']') {
      ss.precede(1);
      finished = true;
      break;
    }

    if (top === ',') {
      itemsLocation[index] = {
        ...(itemsLocation[index] || {
          hasValue: false,
          valueStart: ss.pos,
          valueEnd: ss.pos,
        }),
        hasTrailingComma: true,
        trailingCommaStart: ss.pos,
      };

      index++;
      slotEmpty = true;

      ss.precede(1);

      // after updating index,
      // prepare the next item's location info
      // this is useful for empty slot
      itemsLocation[index] = {
        hasValue: false,
        valueStart: ss.pos,
        valueEnd: ss.pos,
      };

      continue;
    }

    const comment = parseComment(ss, top);
    if (comment) {
      ss.precede(comment.parsedLength);
      continue;
    }

    const item = slotEmpty && parseValue(ss, top);
    if (!item) {
      return makePanic(finalize, `expect ${slotEmpty ? 'value, ' : ''}comma or right square bracket`, ss);
    }

    items[index] = item;
    itemsLocation[index] = {
      ...itemsLocation[index],
      hasValue: true,
      valueStart: ss.pos,
      valueEnd: ss.pos + item.parsedLength,
    };

    slotEmpty = false;
    ss.precede(item.parsedLength);
  }

  if (!isRecovering() && !finished) {
    return makePanic(finalize, 'expect right square bracket', ss);
  }

  return finalize();
}
