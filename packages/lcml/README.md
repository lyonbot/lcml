# LCML -- JSON with expressions

[![npm](https://img.shields.io/npm/v/lcml)](https://www.npmjs.com/package/lcml)
![npm bundle size](https://img.shields.io/bundlephobia/min/lcml) ![npm type definitions](https://img.shields.io/npm/types/lcml) ![dependencies](https://img.shields.io/badge/dependencies-0-green)

Low-Code Markup Language (DSL) presents values with Dynamic Expressions. It is a superset of human readable JSON.

[ [👯 Try it Now](https://lyonbot.github.io/lcml/) | [💻 GitHub](https://github.com/lyonbot/lcml) | [📓 LCML Syntax](https://github.com/lyonbot/lcml/tree/main/packages/lcml#lcml-syntax) | [📓 Integrating LCML](https://github.com/lyonbot/lcml/tree/main/packages/lcml#integrating-lcml) ]

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

## LCML Syntax

LCML syntax is based on JSON syntax, with `{{ expression }}` and comments supported.

You can use `{{ expression }}`:

- in string
- as array item
- as property value
- as property key
- as the whole LCML

### Loose Mode

When `{ loose: true }` is passed to parse, these invalid LCML will become valid strings:

| LCML | Default Mode | Loose Mode (`loose: true`) |
|------|--------------|------------|
| `{{ user.name }}, Welcome` | Error: unexpected remainder | treated as string `"{{ user.name }}, Welcome"` |
| `Hello, {{ user.name }}` | Error: invalid input (at "H") | treated as string `"Hello, {{ user.name }}"` |
| `/* corrupted */ {{ user` | Error: expect end of expression | treated as string `"{{ user"` |

Loose Mode Rules:

1. leading comments are ignored, then the remainder **might** be treated as *string*

2. if the beginning of LCML input looks like a **string, array or object**, 
 the loose mode will NOT work!

3. `{ ignoreUnparsedRemainder: true }` will not work, unless loose mode is suppressed (see rule #2)

4. due to rule #2, corrupted input like *`{ hello: `* will cause a Error, not *string*. 

   - (dangerous) to treat it as string, set `{ onError: 'as-string' }` -- this can be confusing! the parser still outputs a *string* but it is NOT Loose Mode's credit!

5. if Loose Mode actually has functioned, parser will return `{ looseModeEnabled: true }`

Some rarely-used notices related to the rule #4, FYI:

- if `{ onError: 'as-string' }` is set, to tell whether it has functioned, you shall check `!!parseResult.error && parseResult.ast.type === 'string' && !parseResult.ast.quote` instead of `parseResult.looseModeEnabled`

## Integrating LCML

```ts
import { compile, CompileOptions } from 'lcml';
// compile = parse + toJS

const options: CompileOptions = {

  // loose: false,
  // onError: 'throw' | 'recover' | 'as-string',
  // ignoreUnparsedRemainder: false,
  // treatEmptyInput: 'as-undefined',
  
  // compact: false,
  // processExpression: (node, parents) => { return node.expression },
  // globalToStringMethod: "toString",
  
};

const result = compile('"Hello, {{ user.name }}"', options);

console.log(result.body);
// => 'Hello, ' + toString(user.name)

console.log(result.ast);
// => { type: "string", start: 0, end: 24 }

console.log(result.expressions);
// => [
//      {
//         start: 8,
//         end: 23,
//         expression: " user.name ",
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
  return 'Hello, ' + toString(user.name);
}
```

You can set option `globalToStringMethod` in order to use other name instead of `toString`.

### Process Embedded Expressions

As presented above, option `processExpression` can be a callback function receiving `node` and its `parents`,
returns a JavaScript expression.

You can read `node.expression`, transpile it and return new expression.
For example, use Babel to transpile the fashion ESNext syntax like pipeline operator.

The generated JavaScript code will be affected. 

Beware: in the received `node.expression`, leading and trailing spaces are NOT trimmed.

```js
processExpression: (node, parents) => {
    return node.expression;
}
```
