function Module() {}
export function createNamespaceModule(module) {
  const cloned = new Module();
  Object.setPrototypeOf(cloned, null);
  Object.defineProperty(cloned, Symbol.toStringTag, {
    value: 'Module',
    writable: false,
    enumerable: false,
    configurable: false,
  });
  Object.keys(module).forEach((key) => {
    const getter = Object.getOwnPropertyDescriptor(module, key).get;
    Object.defineProperty(cloned, key, {
      enumerable: true,
      configurable: false,
      get: getter,
      set: () => {
        throw TypeError(
          `Cannot assign to read only property '${key}' of object '[object Module]`,
        );
      },
    });
  });
  Object.seal(cloned);
  return cloned;
}

export function createImportMeta(url) {
  const metaObject = Object.create(null);
  const set = (key, value) => {
    Object.defineProperty(metaObject, key, {
      value,
      writable: true,
      enumerable: true,
      configurable: true,
    });
  };
  set('url', url);
  set('__virtual', true);
  return { meta: metaObject };
}
