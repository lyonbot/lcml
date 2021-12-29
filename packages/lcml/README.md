# LCML -- JSON with expressions

Low-Code Markup Language (DSL) presents values with Dynamic Expressions. It is a superset of human readable JSON.

| Written in LCML | Output JavaScript | Inferred Type Information |
|----|--|--|
| `{{ foo.bar }}` | `foo.bar` | unknown |
| `3.14159` | `3.14159` | number |
| `[1, 2, 3]` | `[1, 2, 3]` | array with 3 numbers |
| `"hello {{ user.name }}"` | `"hello" + toString(user.name)` | string |

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

And we know every part's type information:

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
