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

// atob 对中文不友好
export function toBase64(input) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result);
    };
    reader.readAsDataURL(new Blob([input]));
  });
}

export function importModule(moduleId, baseUrl) {
  const url = baseUrl ? transformUrl(baseUrl, moduleId) : moduleId;
  if (!moduleStore[url]) {
    console.log(url);
    if (!moduleResource[url]) {
      throw new Error(`Module '${moduleId}' not found`);
    }
    const { code, map, url } = moduleResource[url];
    const module = (moduleStore[url] = {});
    execCode(url, module, code, map);
  }
  return moduleStore[url];
}

export function execCode(url, module, code, map) {
  const sourcemap = `\n//@ sourceMappingURL=${map}`;
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
    (moduleId) => importModule(moduleId, url),
    exportModule,
    getModuleNamespace,
    createImportMeta(url),
    async (moduleId) => {
      if (!moduleStore[moduleId]) {
        await compileAndFetchCode(moduleId, url);
        const { code, map, url } = moduleResource[moduleId];
        const module = (moduleStore[id] = {});
        execCode(url, module, code, map);
      }
      return getModuleNamespace(moduleStore[moduleId]);
    },
  );
}

export function compileAndFetchCode(moduleId, baseUrl) {
  if (moduleResource[moduleId]) {
    return moduleResource[moduleId];
  }
  const url = baseUrl ? transformUrl(baseUrl, moduleId) : moduleId;
  const p = fetch(url)
    .then(async (res) => {
      const code = res.status >= 400 ? '' : await res.text();
      return [code, res.url]; // 可能重定向了
    })
    .then(async ([code, realUrl]) => {
      if (code) {
        const compiler = new Compiler({ code, filename: moduleId });
        const { imports, exports, generateCode } = compiler.transform();
        await Promise.all(
          imports.map(({ moduleId }) => {
            return moduleResource[moduleId]
              ? null
              : compileAndFetchCode(moduleId, url);
          }),
        );
        const output = generateCode();
        output.url = realUrl;
        // output.realUrl = realUrl;
        output.exports = exports;
        output.map = await toBase64(output.map.toString());
        moduleResource[moduleId] = output;
      } else {
        moduleResource[moduleId] = null;
      }
    });
  moduleResource[moduleId] = p;
  return p;
}
