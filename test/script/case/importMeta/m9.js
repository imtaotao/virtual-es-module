expect(Object.getPrototypeOf(import.meta)).toBe(null);

expect(import.meta.url).toBe(
  'http://localhost:9876/base/script/case/importMeta/m9.js',
);

expect(Object.getOwnPropertyDescriptor(import.meta, 'url')).toEqual({
  writable: true,
  enumerable: true,
  configurable: true,
  value: 'http://localhost:9876/base/script/case/importMeta/m9.js',
});
