import { parse } from './LCMLParser';

describe('LCMLParser', () => {
  it('works', () => {
    // const ans = parse('{ a: 123, "{{foo}}\\"bar": {{ 345 + bar }},  {{ sym }}: {{ val }}  }');
    const ans = parse(`// written in LCML syntax
    // human-readable JSON with {{ expression }} inside:
    {
      name: "John {{ lib.genLastName() }}",  // in string
      info: {{ lib.genInfo() }},  // as property value
      tags: ["aa", 123, false, {{ location.href }}],
    
      {{ lib.sym }}: "wow",  // as property key
    }`)
    console.log(JSON.stringify(ans, null, 2))

    expect(ans).toBeTruthy()
  });
});
