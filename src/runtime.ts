import { Output, Compiler } from './compiler';
import { isPromise, toBase64, evalWithEnv, transformUrl } from './utils';
import { Module, MemoryModule, createModule, createImportMeta } from './module';

export type ModuleResource = Output & {
  storeId: string;
  realUrl: string;
  exports: Array<string>;
};

export interface RuntimeOptions {
  execCode?: (
    output: ModuleResource,
    provider: ReturnType<Runtime['generateProvider']>,
  ) => void;
}

export class Runtime {
  private options: RuntimeOptions;
  private modules = new WeakMap<MemoryModule, Module>();
  private memoryModules: Record<string, MemoryModule> = {};
  private resources: Record<string, ModuleResource | Promise<void>> = {};

  constructor(options?: RuntimeOptions) {
    this.options = options || {};
  }

  private execCode(output: ModuleResource, memoryModule: MemoryModule) {
    const provider = this.generateProvider(output, memoryModule);

    if (this.options.execCode) {
      this.options.execCode(output, provider);
    } else {
      const sourcemap = `\n//@ sourceMappingURL=${output.map}`;
      const code = `${output.code}\n//${output.storeId}${sourcemap}`;
      evalWithEnv(code, provider);
    }
  }

  private importModule(
    storeId: string,
    requestUrl?: string,
  ): MemoryModule | Promise<MemoryModule> {
    let memoryModule = this.memoryModules[storeId];
    if (!memoryModule) {
      const get = () => {
        const output = this.resources[storeId] as ModuleResource;
        if (!output) {
          throw new Error(`Module '${storeId}' not found`);
        }
        memoryModule = this.memoryModules[storeId] = {};
        this.execCode(output, memoryModule);
        return memoryModule;
      };
      if (requestUrl) {
        const res = this.compileAndFetchCode(storeId, requestUrl);
        if (isPromise(res)) return res.then(() => get());
      }
      return get();
    }
    return memoryModule;
  }

  private getModule(memoryModule: MemoryModule) {
    if (!this.modules.has(memoryModule)) {
      this.modules.set(memoryModule, createModule(memoryModule));
    }
    return this.modules.get(memoryModule);
  }

  private generateProvider(output: ModuleResource, memoryModule: MemoryModule) {
    return {
      [Compiler.keys.__VIRTUAL_IMPORT_META__]: createImportMeta(output.realUrl),

      [Compiler.keys.__VIRTUAL_NAMESPACE__]: (memoryModule: MemoryModule) => {
        return this.getModule(memoryModule);
      },

      [Compiler.keys.__VIRTUAL_IMPORT__]: (moduleId: string) => {
        const storeId = transformUrl(output.storeId, moduleId);
        return this.import(storeId);
      },

      [Compiler.keys.__VIRTUAL_DYNAMIC_IMPORT__]: (moduleId: string) => {
        const storeId = transformUrl(output.storeId, moduleId);
        const requestUrl = transformUrl(output.realUrl, moduleId);
        return this.importByUrl(storeId, requestUrl);
      },

      [Compiler.keys.__VIRTUAL_EXPORT__]: (
        exportObject: Record<string, () => any>,
      ) => {
        Object.keys(exportObject).forEach((key) => {
          Object.defineProperty(memoryModule, key, {
            enumerable: true,
            get: exportObject[key],
            set: () => {
              throw new TypeError('Assignment to constant variable.');
            },
          });
        });
      },
    };
  }

  private async analysisModule(
    code: string,
    storeId: string,
    baseRealUrl: string,
  ) {
    const compiler = new Compiler({
      code,
      storeId,
      runtime: this,
      filename: storeId,
    });

    const { imports, exports, generateCode } = compiler.transform();
    await Promise.all(
      imports.map(({ moduleId }) => {
        const curStoreId = transformUrl(storeId, moduleId);
        const requestUrl = transformUrl(baseRealUrl, moduleId);
        return this.resources[curStoreId]
          ? null
          : this.compileAndFetchCode(curStoreId, requestUrl);
      }),
    );

    const output = await generateCode();
    output.map = await toBase64(output.map);
    (output as ModuleResource).storeId = storeId;
    (output as ModuleResource).realUrl = baseRealUrl;
    (output as ModuleResource).exports = exports;
    return output as ModuleResource;
  }

  private compileAndFetchCode(
    storeId: string,
    url?: string,
  ): void | Promise<void> {
    if (this.resources[storeId]) return;
    if (!url) url = storeId;

    const p = fetch(url)
      .then(async (res) => {
        const code = res.status >= 400 ? '' : await res.text();
        return [code, res.url]; // 可能重定向了
      })
      .then(async ([code, realUrl]) => {
        if (code) {
          const output = await this.analysisModule(code, storeId, realUrl);
          this.resources[storeId] = output;
        } else {
          this.resources[storeId] = null;
        }
      });
    this.resources[storeId] = p;
    return p;
  }

  private import(storeId: string) {
    return this.importModule(storeId) as MemoryModule;
  }

  importByUrl(storeId: string, requestUrl?: string) {
    if (!storeId) throw new Error('Missing url');

    const result = this.importModule(storeId, requestUrl || storeId);
    return Promise.resolve(result).then((memoryModule) => {
      return this.getModule(memoryModule);
    });
  }

  async importByCode(code: string, storeId = 'unknow', metaUrl?: string) {
    if (!code) throw new Error('Missing code');
    if (!storeId) throw new Error('Missing filename');
    if (!metaUrl) metaUrl = storeId;

    const memoryModule = {};
    const output = await this.analysisModule(code, storeId, metaUrl);
    this.execCode(output as ModuleResource, memoryModule);
    return this.getModule(memoryModule);
  }
}
