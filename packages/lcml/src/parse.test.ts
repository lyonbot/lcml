import { parse, ParseOptions } from './parse';
import {
  ParsedArrayNode,
  ParsedStringNode,
  ParsedStringSegmentNode,
  ParsedExpressionNode,
  ParsedObjectNode,
  ParsedNumberNode,
} from './parseImpl/exports';

describe.only('parse', () => {
  const parseAST = (x: string, opts?: ParseOptions) => {
    const ans = parse(x, opts);
    if (ans.error) throw ans.error;
    return ans.ast!;
  };

  it('parse expression', () => {
    const ast = parseAST(' {{ expr }}') as ParsedExpressionNode;

    expect(ast.type).toBe('expression');
    expect(ast.expression).toBe(' expr ');
  });

  it.each<[opts: ParseOptions, willThrow: string | false]>([
    [{ onError: 'return' }, 'remainder'],
    [{ loose: true }, false],
    [{ ignoreUnparsedRemainder: true }, false],
  ])('remainder, %j', (opts, willThrow) => {
    const input = ' {{ expr }}, welcome ! // not-comment';
    const { ast, error, looseModeEnabled } = parse(input, opts);

    if (willThrow) {
      expect(error).toBeTruthy();
      expect(error!.message).toContain(willThrow);
      return;
    }

    expect(ast).toMatchSnapshot('ast');
    expect(looseModeEnabled).toMatchSnapshot('looseModeEnabled');
  });

  it('parse string', () => {
    const ast = parseAST(' /* string */   "test \\{{ test }} {{ test2 }}"') as ParsedStringNode;

    expect(ast.type).toBe('string');
    expect(ast.quote).toBe('"');
    expect(ast.segments).toHaveLength(3);
    expect(ast.isDynamic).toBe(true);

    const [s1, s2, s3] = ast.segments as [ParsedStringSegmentNode, ParsedExpressionNode, ParsedStringSegmentNode];

    expect(s1.type).toBe('string-segment');
    expect(s1.raw).toBe('test \\{{ test }} ');

    expect(s2.type).toBe('expression');
    expect(s2.expression).toBe(' test2 ');

    expect(s3.type).toBe('string-segment');
    expect(s3.raw).toBe('');

    expect(() => parseAST(`"foo`)).toThrowError('end of string');
    expect(() => parseAST(`"foo {{ bar`)).toThrowError('end of string');
  });

  it('parse static string', () => {
    const ast = parseAST(' /* string */   "test \\{{ test }} \\"s {{ tt"') as ParsedStringNode;

    expect(ast.type).toBe('string');
    expect(ast.isDynamic).toBe(false);
    expect(ast.segments.length).toBe(1);
    expect((ast.segments[0] as ParsedStringSegmentNode).raw).toBe(`test \\{{ test }} \\"s {{ tt`);

    expect(parseAST('""')).toMatchSnapshot('empty string');
    expect(parseAST("''")).toMatchSnapshot('empty string');
  });

  it('parse number', () => {
    const goodCases = ['-1.3', '1.4e+4', '.9e-2', '+155.', '0x7F2A'];
    const badCases = ['-1.3.', '1.4e', '0xfg', '3.e10.3'];

    goodCases.forEach(c => {
      let ast: ParsedNumberNode;

      ast = parseAST(c) as ParsedNumberNode;

      expect(ast.type).toBe('number');
      expect(ast.raw).toBe(c);

      ast = parseAST('/* comment */' + c) as ParsedNumberNode;

      expect(ast.type).toBe('number');
      expect(ast.raw).toBe(c);
    });

    badCases.forEach(c => {
      try {
        const ast = parseAST(c);
        expect(ast?.type).not.toBe('number');
      } catch (err) {
        expect((err as Error).message).toContain('invalid input');
      }
    });
  });

  it('parse array', () => {
    const ast = parseAST('["test", {{ expr }}, , /* test */,]') as ParsedArrayNode;

    expect(ast.type).toBe('array');
    expect(ast.length).toBe(4);
    expect(ast.itemsLocation.map(x => !!x.hasValue)).toEqual([true, true, false, false]);
    expect(ast.itemsLocation.map(x => !!x.hasTrailingComma)).toEqual([true, true, true, true]);
    expect(ast.items[0]!.type).toBe('string');
    expect(ast.items[1]!.type).toBe('expression');
    expect(ast.items[2]).toBe(null);
    expect(ast.items[3]).toBe(null);

    expect(parseAST('[]')).toMatchSnapshot('empty array');

    expect(() => parseAST(`[`)).toThrowError('right square bracket');
    expect(() => parseAST(`[1`)).toThrowError('right square bracket');
    expect(() => parseAST(`[1,`)).toThrowError('right square bracket');
    expect(() => parseAST(`[1 2`)).toThrowError('(at :3)');
  });

  it('parse object', () => {
    const ast = parseAST(`
      {
        /*test*/
        "foo" /*test*/ : "test",
        {{ sym }}: [1,2],
        "bar": true
      }
    `);

    expect(ast).toMatchSnapshot();

    expect(parseAST(`{}`)).toMatchSnapshot('empty object');

    expect(() => parseAST(`{ "foo": // test`)).toThrowError('property value');
    expect(() => parseAST(`{ "foo": 123`)).toThrowError('right curly bracket');
  });

  it('onError: recover', () => {
    const input = `  /* test */
    { 
      hello: badTokenHere,
      world: [ 1, 2, bad token, bad again ]
    `;

    const result = parse(input, { onError: 'recover' });

    expect(result.errors.length).toBe(4);
    expect(result.errors[0].message).toContain('expect property value');
    expect(result.errors[1].message).toContain('expect value, comma or right square bracket');
    expect(result.errors[2].message).toContain('expect value, comma or right square bracket');
    expect(result.errors[3].message).toContain('expect comma or right curly bracket');
    expect(result.errors[0].position).toEqual(33);
    expect(result.errors[1].position).toEqual(68);
    expect(result.errors[2].position).toEqual(79);
    expect(result.errors[3].position).toEqual(95);

    const properties = (result.ast! as ParsedObjectNode).properties;
    expect(result.ast!.type).toBe('object');
    expect(properties).toHaveLength(2);
    expect(properties[0].value).toBeNull();
    expect(properties[1].value!.type).toBe('array');
    expect((properties[1].value! as ParsedArrayNode).items).toHaveLength(3);

    expect(result.ast).toMatchSnapshot();
  });
});
