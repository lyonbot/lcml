# LCML

[![npm](https://img.shields.io/npm/v/lcml)](https://www.npmjs.com/package/lcml) ![npm bundle size](https://img.shields.io/bundlephobia/minzip/lcml) ![npm type definitions](https://img.shields.io/npm/types/lcml) ![dependencies](https://img.shields.io/badge/dependencies-0-green)

**LCML is JSON with expressions** -- or in other word, **type-safe mustache for JSON**.

You can use `{{ expression }}` in LCML to notate **dynamic values**.

LCML is a DSL that compiles to JavaScript. Its syntax is extended from JSON. LCML stands for Low-Code Markup Langunage.

[ [👯 Try it Now](https://lyonbot.github.io/lcml/) | [💻 GitHub](https://github.com/lyonbot/lcml) | [📓 LCML Syntax](https://github.com/lyonbot/lcml/tree/main/packages/lcml#lcml-syntax) | [📓 Integrating LCML](https://github.com/lyonbot/lcml/tree/main/packages/lcml#integrating-lcml) ]

| Highlights |     |
|------------|-----|
| ⭕ easy to learn | How to write LCML? <br/> 1. write JSON<br /> 2. replace some values / objects / arrays with `{{ expression }}`
| 💪 error-tolerant | better than JSON, we can handle corrputed and incompleted LCML / corrupted JSON. <br/> we also provide **loose mode** to make LCML friendly to newbies
| 👨‍🎓 type-safe | LCML-parser outputs AST and tells you the data's type structure. <br/> so you can validate the type before actually evaluating it.
| 🎼 output JavaScript | we compile LCML into JavaScript. <br /> meanwhile, you can process `{{ expression }}` with custom hook.
| 🌲 completed AST | with `parse()` you can get the *abstract syntax tree* to read the type information, do source-mapping, locate declarations and more.


## Have a Glimpse

| Written in LCML           | Output JavaScript               | Inferred Type Information |
| ------------------------- | ------------------------------- | ------------------------- |
| `3.14159`                 | `3.14159`                       | number                    |
| `[1, 2, {{ dice() }}]`               | `[1, 2, dice()]`                     | array with 2 numbers + 1 expression      |
| `"hello {{ user.name }}"` | `"hello" + toString(user.name)` | string                    |
| `{{ foo.bar }}`           | `foo.bar`                       | expression                   |

Here is a longer LCML example:

```js
// this whole text is written in LCML
// first of all, you can write comments!
// then you can write {{ expression }} everywhere
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
  [[( lib.sym )]] string
```

## LCML Syntax

LCML syntax is based on JSON syntax, with `{{ expression }}` and comments supported.

### Comments

We support `/* block comment */` and `// line-comment`

### Expressions

You can use `{{ expression }}` in many places:

- in string
- as array item
- as property value
- as property key
- as the whole LCML

## Loose Mode

When `{ loose: true }` is passed to `parse()` or `compile()`, these LCML will be treated as strings:

| LCML | Default Mode | Loose Mode (`loose: true`) |
|------|--------------|------------|
| `{{ user.name }}, Welcome` | Error: unexpected remainder | treated as dynamic string `"{{ user.name }}, Welcome"` |
| `Hello, {{ user.name }}` | Error: invalid input (at "H") | treated as dynamic string `"Hello, {{ user.name }}"` |
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
