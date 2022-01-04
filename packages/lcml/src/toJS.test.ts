import { parse } from './parse';
import { toJS, ToJSOptions } from './toJS';
import { ParsedExpressionNode } from './parseImpl/parseExpression';

describe('toJS', () => {
  const fn1 = jest.fn<string, [ParsedExpressionNode]>(node => node.expression);
  const cases: [ToJSOptions, (() => void)?][] = [
    [{ compact: true }],
    [{}],
    [{ globalToStringMethod: 'myToString' }],
    [
      { processExpression: fn1 },
      () => {
        expect(fn1).toBeCalledTimes(3);
        expect(fn1.mock.calls[0][0].expression).toEqual(' expr ');
        expect(fn1.mock.calls[1][0].expression).toEqual(' test ');
        expect(fn1.mock.calls[2][0].expression).toEqual(' sym ');
      },
    ],
  ];

  test.each(cases)('should work: %o', opt => {
    const source = `{ 
      "foo {{ expr }}": 1, 
      "bar": [{{ test }}, false,,],
      {{ sym }}: [2, 3, 4]
    }`;
    const ast = parse(source, { onError: 'recover' }).ast!;
    const js = toJS(ast, opt);

    expect(js).toMatchSnapshot();
  });
});
