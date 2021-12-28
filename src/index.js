import { transform } from './compiler';
import {
  execCode,
  importModule,
  moduleStore,
  moduleResource,
  compileAndFetchCode,
} from './exec';

export async function startByUrl(entry) {
  if (!entry) throw new Error('Missing entry');
  await compileAndFetchCode(entry);
  importModule(entry);
}

export async function startByCode(originCode, filename) {
  if (!originCode) throw new Error('Missing code');
  if (!filename) throw new Error('Missing filename');
  const { imports, exports, generateCode } = transform({
    filename,
    code: originCode,
  });
  await Promise.all(
    imports.map(({ moduleId }) => compileAndFetchCode(moduleId, filename)),
  );
  const output = generateCode();
  output.url = filename;
  output.exports = exports;
  moduleResource[filename] = output;
  const { code, map } = output;
  const module = (moduleStore[filename] = {});
  execCode(filename, module, code, map);
}

export function startByScriptTags(typeFlag) {
  if (!typeFlag) throw new Error('Missing typeFlag');
  const ready = () => {
    const nodes = document.getElementsByTagName('script');
    for (const node of nodes) {
      const type = node.getAttribute('type');
      if (type === typeFlag && !node.loaded) {
        node.loaded = true;
        const url = node.getAttribute('src');
        url ? startByUrl(url) : startByCode(node.innerHTML, location.href);
      }
    }
  };
  document.readyState === 'complete'
    ? setTimeout(ready)
    : document.addEventListener('DOMContentLoaded', ready, false);
}

// 如果是在浏览器环境中，则直接执行代码
if (typeof document !== 'undefined') {
  startByScriptTags('virtual-module');
}
