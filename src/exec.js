import { transform, __VIRTUAL_WRAPPER__ } from './compiler';
import { createImportMeta, createNamespaceModule } from './module';

const namespaceStore = new WeakMap();
export const moduleStore = {};
export const moduleResource = {};

function transformUrl(resolvePath, curPath) {
  const baseUrl = new URL(resolvePath, location.href);
  const realPath = new URL(curPath, baseUrl.href);
  return realPath.href;
}

export function importModule(id) {
  if (!moduleStore[id]) {
    const { code, map, url } = moduleResource[id];
    const module = (moduleStore[id] = {});
    execCode(url, module, code, map);
  }
  return moduleStore[id];
}

export function execCode(url, module, code, map) {
  // console.log(code);
  const content = btoa(JSON.stringify(map));
  const sourcemap = `\n//@ sourceMappingURL=data:application/json;base64,${content}`;
  const exportModule = (exportObject) => {
    Object.keys(exportObject).forEach((key) => {
      Object.defineProperty(module, key, {
        enumerable: true,
        get: exportObject[key],
        set: () => {
          throw new TypeError('Assignment to constant variable.');
        },
      });
    });
  };
  const getModuleNamespace = (module) => {
    if (namespaceStore.has(module)) {
      return namespaceStore.get(module);
    }
    const wrapperModule = createNamespaceModule(module);
    namespaceStore.set(module, wrapperModule);
    return wrapperModule;
  };

  (0, eval)(`${code}${''}`);
  const actuator = globalThis[__VIRTUAL_WRAPPER__];

  actuator(
    importModule,
    exportModule,
    getModuleNamespace,
    createImportMeta(url),
    async (id) => {
      if (!moduleStore[id]) {
        await compileAndFetchCode(id, url);
        const { code, map } = moduleResource[id];
        const module = (moduleStore[id] = {});
        execCode(id, module, code, map);
      }
      return getModuleNamespace(moduleStore[id]);
    },
  );
}

export function compileAndFetchCode(curModule, baseUrl) {
  if (moduleResource[curModule]) {
    return moduleResource[curModule];
  }
  const url = baseUrl ? transformUrl(baseUrl, curModule) : curModule;
  const p = fetch(url)
    .then((res) => res.text())
    .then(async (code) => {
      const { imports, exports, generateCode } = transform({
        code,
        filename: curModule,
      });
      await Promise.all(
        imports.map(({ moduleId }) => compileAndFetchCode(moduleId, curModule)),
      );
      const output = generateCode();
      output.url = url;
      output.exports = exports;
      moduleResource[curModule] = output;
    });
  moduleResource[curModule] = p;
  return p;
}
