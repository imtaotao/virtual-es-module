import { Compiler } from './compiler/index';
import { createImportMeta, createNamespaceModule } from './module';

const namespaceStore = new WeakMap();
export const moduleStore = {};
export const moduleResource = {};

function transformUrl(resolvePath, curPath) {
  const baseUrl = new URL(resolvePath, location.href);
  const realPath = new URL(curPath, baseUrl.href);
  return realPath.href;
}

export function importModule(moduleId) {
  if (!moduleStore[moduleId]) {
    if (!moduleResource[moduleId]) {
      throw new Error(`Module '${moduleId}' not found`);
    }
    const { code, map, url } = moduleResource[moduleId];
    const module = (moduleStore[moduleId] = {});
    execCode(url, module, code, map);
  }
  return moduleStore[moduleId];
}

export function execCode(url, module, code, map) {
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

  (0, eval)(`${code}\n//${url}${sourcemap}`);
  const actuator = globalThis[Compiler.keys.__VIRTUAL_WRAPPER__];

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
  let url = baseUrl ? transformUrl(baseUrl, curModule) : curModule;
  const p = fetch(url)
    .then((res) => {
      url = res.url; // 可能重定向了
      return res.status >= 400 ? '' : res.text();
    })
    .then(async (code) => {
      if (code) {
        const compiler = new Compiler({ code, filename: curModule });
        const { imports, exports, generateCode } = compiler.transform();
        await Promise.all(
          imports.map(({ moduleId }) => compileAndFetchCode(moduleId, url)),
        );
        const output = generateCode();
        output.url = url;
        output.exports = exports;
        moduleResource[curModule] = output;
      } else {
        moduleResource[curModule] = null;
      }
    });
  moduleResource[curModule] = p;
  return p;
}
