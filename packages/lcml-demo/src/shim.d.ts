declare module '*.md' {
  const str: string;
  export default str;
}

declare module 'lodash.debounce' {
  export default function debounce<T>(x: T, opt?: number): T;
}
