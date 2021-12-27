import { createNamespaceModule } from './module';
import { transform, __VIRTUAL_WRAPPER__ } from './compiler';

const moduleStore = {};
const moduleResource = {};
const namespaceStore = new WeakMap();

function transformUrl(resolvePath, curPath) {
  const baseUrl = new URL(resolvePath, location.href);
  const realPath = new URL(curPath, baseUrl.href);
  return realPath.href;
}

export function importModule(moduleName) {
  if (!moduleStore[moduleName]) {
    const { code, map } = moduleResource[moduleName];
    const module = moduleStore[moduleName] = {};
    moduleStore[moduleName] = module;
    execCode(module, code, map);
  }
  return moduleStore[moduleName];
}

export function execCode(module, code, map) {
  const content = btoa(JSON.stringify(map));
  const sourcemap = `\n//@ sourceMappingURL=data:application/json;base64,${content}`;
  const exportModule = (exportObject) => {
    Object.keys(exportObject).forEach(key => {
      Object.defineProperty(module, key, {
        enumerable: true,
        get: exportObject[key],
        set: () => { 
          throw new TypeError('Assignment to constant variable.');
        },
      })
    })
  };

  (0, eval)(`${code}${sourcemap}`);
  const actuator = globalThis[__VIRTUAL_WRAPPER__];
  actuator(importModule, exportModule, (module) => {
    if (!namespaceStore.has(module)) {
      namespaceStore.set(module, createNamespaceModule(module));
    }
    return namespaceStore.get(module)
  });
}

export function compilerAndFetchCode(curModule, baseUrl) {
  if (moduleResource[curModule]) {
    return moduleResource[curModule];
  }
  const url = baseUrl
    ? transformUrl(baseUrl, curModule)
    : curModule;
  const p = fetch(url)
    .then(res => res.text())
    .then(async code => {
      const { imports, output } = transform({ code, filename: curModule });
      moduleResource[curModule] = output;
      return Promise.all(
        imports.map(({ moduleName }) => compilerAndFetchCode(moduleName, curModule))
      )
  });
  moduleResource[curModule] = p;
  return p;
}
