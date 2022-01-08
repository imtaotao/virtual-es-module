import { Compiler } from './compiler/index';
import { createImportMeta, createNamespaceModule } from './module';

const namespaceStore = new WeakMap();
export const moduleStore = {};
export const moduleResource = {};

export function transformUrl(resolvePath, curPath) {
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

export function importModule(storeId, moduleId) {
  if (!moduleStore[storeId]) {
    if (!moduleResource[storeId]) {
      throw new Error(`Module '${moduleId}' not found`);
    }
    const output = moduleResource[storeId];
    const module = (moduleStore[storeId] = {});
    execCode(output, module);
  }
  return moduleStore[storeId];
}

export function execCode(output, module) {
  const sourcemap = `\n//@ sourceMappingURL=${output.map}`;
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

  (0, eval)(`${output.code}\n//${output.storeId}${sourcemap}`);
  const actuator = globalThis[Compiler.keys.__VIRTUAL_WRAPPER__];

  actuator(
    (moduleId) => {
      const storeId = transformUrl(output.storeId, moduleId);
      return importModule(storeId, moduleId);
    },
    exportModule,
    getModuleNamespace,
    createImportMeta(output.realUrl),
    async (moduleId) => {
      const storeId = transformUrl(output.storeId, moduleId);
      if (!moduleStore[storeId]) {
        const requestUrl = transformUrl(output.realUrl, moduleId);
        await compileAndFetchCode(storeId, requestUrl);
        const curOutput = moduleResource[storeId];
        const module = (moduleStore[url] = {});
        execCode(curOutput, module);
      }
      return getModuleNamespace(moduleStore[storeId]);
    },
  );
}

export function compileAndFetchCode(storeId, url) {
  if (moduleResource[storeId]) {
    return moduleResource[storeId];
  }
  const p = fetch(url)
    .then(async (res) => {
      const code = res.status >= 400 ? '' : await res.text();
      return [code, res.url]; // 可能重定向了
    })
    .then(async ([code, realUrl]) => {
      if (code) {
        const compiler = new Compiler({ code, filename: storeId });
        const { imports, exports, generateCode } = compiler.transform();
        await Promise.all(
          imports.map(({ moduleId }) => {
            const curStoreId = transformUrl(storeId, moduleId);
            const requestUrl = transformUrl(realUrl, moduleId);
            return moduleResource[curStoreId]
              ? null
              : compileAndFetchCode(curStoreId, requestUrl);
          }),
        );

        const output = generateCode();
        output.storeId = storeId;
        output.realUrl = realUrl;
        output.exports = exports;
        output.map = await toBase64(output.map.toString());
        moduleResource[storeId] = output;
      } else {
        moduleResource[storeId] = null;
      }
    });
  moduleResource[storeId] = p;
  return p;
}
