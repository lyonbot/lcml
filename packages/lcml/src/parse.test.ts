import { parse } from './parse';
import { ParsedNumberNode } from './parseImpl/parseLiteral';
import { ParsedArrayNode } from './parseImpl/parseArray';
import { ParsedStringNode, ParsedStringSegmentNode } from './parseImpl/parseString';
import { ParsedExpressionNode } from './parseImpl/parseExpression';

describe.only('parse', () => {
  const parseAST = (x: string) => {
    const ans = parse(x);
    if (ans.error) throw ans.error;
    return ans.ast!;
  };

  it('parse expression', () => {
    const ast = parseAST(' {{ expr }}') as ParsedExpressionNode;

    expect(ast.type).toBe('expression');
    expect(ast.expression).toBe(' expr ');
  });

  it('parse expression-leading string', () => {
    const ast = parseAST(' {{ expr }}, welcome ! // not-comment') as ParsedStringNode;

    expect(ast.type).toBe('string');
    expect(ast).toMatchSnapshot();
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
});
