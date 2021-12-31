/**
 * Node (path) information, including position, type and children.
 *
 * @public
 */
export interface LCMLNodeInfo {
  key?: string;
  type?: LCMLValueType;
  children?: LCMLNodeInfo[];

  start: number;
  end: number;

  propertyKeyEnd?: number;
  propertyValueStart?: number;

  expression?: ExpressionSegmentInfo;
  propertyKeyExpression?: ExpressionSegmentInfo;
}

/**
 * Parser options
 *
 * @public
 */
export interface LCMLParseOptions {
  /**
   * when a `{{ expression }}` is found, this callback will be triggered
   *
   * you may read and modify `item.expression` (eg. babel transpiling) and the final result will be affected by it.
   *
   * you may also modify `item.type`
   */
  handleExpression?(item: ExpressionSegmentInfo): void;

  /**
   * in the generated js, a global method `toString(...)` might be called.
   *
   * you may customize the method's name
   *
   * @defaultValue `"toString"`
   */
  globalToStringMethod?: string;

  /**
   * when a syntax error occurs, how to process remainder?
   * 
   * - `"no"` - just throw a LCMLParseError (default)
   * - `"recover"` - discard remaining input and return partially-parsed result -- incomplete but valid result
   * - `"as-string"` - discard all parsed result and treat whole input as string -- returns a (maybe dynamic) string
   */
  recoverFromError?: false | 'no' | 'recover' | 'as-string'
}

export type LCMLValueType = 'unknown' | 'array' | 'number' | 'string' | 'boolean' | 'object';

/**
 * Parser's output
 *
 * @public
 */
export interface LCMLParseResult {
  /** the JavaScript that to be evaluated */
  body: string;
  /** whether there are dynamic expressions */
  isDynamic: boolean;
  /** containing the type and children properties' info of the root node */
  rootNodeInfo?: LCMLNodeInfo;
  /** all dynamic expressions */
  expressions: ExpressionSegmentInfo[];
}

/**
 * Expression Info extracted from input
 *
 * @public
 */

export interface ExpressionSegmentInfo {
  /** the index of first opening curly brackets */
  readonly start: number;

  /** the index of last closing curly brackets */
  readonly end: number;

  /** the return value's type */
  type: LCMLValueType;

  /** the final JavaScript expression. might differ from the rawExpression */
  expression: string;

  /** the original JavaScript expression */
  readonly rawExpression: string;
}
