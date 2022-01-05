export const encBase64 = (s: any) => btoa(Array.from(new TextEncoder().encode(JSON.stringify(s)), x => String.fromCharCode(x)).join(''));
export const decBase64 = (s: string) => JSON.parse(new TextDecoder().decode(Uint8Array.from(Array.from(atob(s), x => x.charCodeAt(0)))));
