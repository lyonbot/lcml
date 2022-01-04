import { ParsedExpressionNode, ParsedNode, ParsedValueNode } from './parseImpl/exports';
import { unescapeString } from './string';

/**
 * toJS options
 *
 * @public
 */
export interface ToJSOptions {
  /**
   * In the generated code, you _might_ see `toString(something)` -- LCML implicitly calls a toString method.
   * This happens when user use `{{ expression }}` inside a string literal.
   *
   * If your `toString` has different name, provide it here.
   */
  globalToStringMethod?: string;
  /**
   * process expressions while generating js
   */
  processExpression?: null | ((node: ParsedExpressionNode, parents: ParsedNode[]) => string);
  /**
   * shortcut to set empty indent & lineBreak
   */
  compact?: boolean;
  /**
   * @default "  "
   */
  indent?: string;
  /**
   * this affects array and object
   *
   * @default "\n"
   */
  lineBreak?: string;
}

export function toJS(node: ParsedValueNode, opt: ToJSOptions = {}): string {
  const compact = !!opt.compact;
  const fullOpt: Required<ToJSOptions> = {
    globalToStringMethod: 'toString',
    processExpression: null,
    compact,
    indent: compact ? '' : '  ',
    lineBreak: compact ? ' ' : '\n',
    ...opt,
  };

  return internalToJS(node, '', fullOpt, () => []);
}

function internalToJS(
  node: ParsedValueNode,
  indent = '',
  opt: Required<ToJSOptions>,
  getParents: () => ParsedValueNode[],
): string {
  const nextParents = () => [...getParents(), node];
  const subCall = (node: ParsedValueNode) => internalToJS(node, opt.indent + indent, opt, nextParents);
  const type = node.type;

  switch (type) {
    case 'boolean':
    case 'number':
    case 'nullish':
      return node.raw;

    case 'expression':
      return `(${opt.processExpression ? opt.processExpression(node, getParents()) : node.expression})`;

    case 'string':
      return node.segments
        .map(x => {
          if (x.type === 'expression') return `${opt.globalToStringMethod}(${subCall(x)})`;
          if (!x.raw) return '';
          return JSON.stringify(unescapeString(x.raw));
        })
        .filter(Boolean)
        .join(' + ');

    case 'array':
      if (!node.length) return '[]';
      return ['[', ...node.items.map(x => opt.indent + (x ? subCall(x) : `/* empty */`) + ','), `]`].join(
        opt.lineBreak + indent,
      );

    case 'object':
      if (!node.properties.length) return '{}';
      return [
        '{',
        ...node.properties.map(x => {
          let key = '';

          if (x.key.type === 'identifier') key = x.key.raw;
          else if (x.key.type === 'expression' || x.key.isDynamic) key = '[' + subCall(x.key) + ']';
          else key = toJS(x.key);

          return `${opt.indent}${key}: ${x.value ? subCall(x.value) : 'undefined'},`;
        }),
        `}`,
      ].join(opt.lineBreak + indent);

    /* istanbul ignore next */
    default: {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _: never = type;
      return '';
    }
  }
}
