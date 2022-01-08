expect(Object.getPrototypeOf(import.meta)).toBe(null);

expect(Object.getOwnPropertyDescriptor(import.meta, 'url')).toEqual({
  writable: true,
  enumerable: true,
  configurable: true,
  value: 'http://localhost:9876/base/script/case/importMeta/m1.js',
});
