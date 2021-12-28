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
  const { imports, output } = transform({ filename, code: originCode });
  moduleResource[filename] = output;
  await Promise.all(
    imports.map(({ moduleName }) => compileAndFetchCode(moduleName, filename)),
  );
  const { code, map } = output;
  const module = (moduleStore[filename] = {});
  execCode(filename, module, code, map);
}

// 如果是在浏览器环境中，则直接执行代码
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const nodes = document.querySelectorAll('script');
    for (const node of nodes) {
      const type = node.getAttribute('type');
      if (type === 'virtual-module') {
        const url = node.getAttribute('src');
        url ? startByUrl(url) : startByCode(node.innerHTML, location.href);
      }
    }
  });
}
