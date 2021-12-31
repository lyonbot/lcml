# LCML -- JSON with expressions

[![npm](https://img.shields.io/npm/v/lcml)](https://www.npmjs.com/package/lcml)
![npm bundle size](https://img.shields.io/bundlephobia/min/lcml) ![npm type definitions](https://img.shields.io/npm/types/lcml) ![dependencies](https://img.shields.io/badge/dependencies-0-green)

Low-Code Markup Language (DSL) presents values with Dynamic Expressions. It is a superset of human readable JSON.

| Written in LCML           | Output JavaScript               | Inferred Type Information |
| ------------------------- | ------------------------------- | ------------------------- |
| `{{ foo.bar }}`           | `foo.bar`                       | unknown                   |
| `3.14159`                 | `3.14159`                       | number                    |
| `[1, 2, 3]`               | `[1, 2, 3]`                     | array with 3 numbers      |
| `"hello {{ user.name }}"` | `"hello" + toString(user.name)` | string                    |

- The `{{ expression }}` can be in string, array, object (as key or value).
- Comments are supported.

More complex examples:

```js
// written in LCML syntax
// human-readable JSON with {{ expression }} inside:
{
  name: "John {{ lib.genLastName() }}",  // in string
  info: {{ lib.genInfo() }},  // as property value
  tags: ["aa", 123, false, {{ location.href }}],

  {{ lib.sym }}: "wow",  // as property key
}
```

Compiled with default options:

```js
// output valid JavaScript code
{
  name: "John" + toString(lib.genLastName()),  // wrapped by "toString"
  info: lib.genInfo(),
  tags: ["aa", 123, false, location.href],

  [lib.sym]: "wow",
}
```

And every part's type information is inferred:

```
[] object
  [name] string
  [info] unknown
  [tags] array
    [0] string
    [1] number
    [2] boolean
    [3] unknown
  [[( lib.sym )]] string       // note: dynamic key might inaccurate
```

- The `toString` wrapper can be configured and renamed.
- Can transform / transpile the expressions before generating the JavaScript code.
- Type information is inferred and recorded.

## Integrating

```js
import { parse } from 'lcml';

const options = {
  // handleExpression: (item) => {},
  // globalToStringMethod: "toString",
  // recoverFromError: 'no' | 'recover' | 'as-string',
};
const result = parse('Hello, {{ user.name }}', options);

console.log(result.body);
// => 'Hello, ' + toString(user.name)

console.log(result.rootNodeInfo);
// => { start: 0, end: 22, type: "string" }

console.log(result.expressions);
// => [
//      {
//         start: 7,
//         end: 22,
//         type: "unknown",
//         expression: " user.name ",
//         rawExpression: " user.name "
//      }
//    ]
```

### Global `toString` Method

In the generated code, you _might_ see `toString(something)`.

This happens when user use `{{ expression }}` inside a string literal.

Therefore, to ensure the generated JavaScript runnable, you shall compose your function like this:

```js
function composedGetter() {
  // declare the toString method
  const toString = x => (typeof x === 'string' ? x : JSON.stringify(x));

  // provide other variables that user might reference
  const user = getUserInfo();
  const state = getState();

  // return (/* put the generated code here! */);
  return ('Hello, ' + toString(user.name));
}
```

You can set option `globalToStringMethod` in order to use other name instead of `toString`.

### Process Embedded Expressions

As presented above, option `handleExpression` can be a callback function receiving an `item`.

You can set `item.type` to other typename like `"object"`, `"string"`. This will affect the inferred type information.

You can modify `item.expression` and the generated JavaScript code will be affected. For example, use Babel to transpile the original Expression in order to support fashion ESNext syntax.

Beware: in the received `item.expression`, leading and trailing spaces are NOT trimmed.
