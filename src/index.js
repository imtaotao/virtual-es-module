import { transform } from './compiler';
import { execCode, importModule, compileAndFetchCode } from './exec';

export async function startByUrl(entry) {
  if (!entry) throw new Error('Missing entry');
  await compileAndFetchCode(entry);
  importModule(entry);
}

export async function startByCode(originCode, filename, metaUrl) {
  if (!originCode) throw new Error('Missing code');
  if (!filename) throw new Error('Missing filename');
  if (!metaUrl) metaUrl = filename;

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
  const { code, map } = output;
  const module = {};
  execCode(metaUrl, module, code, map);
}

export function startByScriptTags(typeFlag) {
  if (!typeFlag) throw new Error('Missing typeFlag');

  const getFilename = (i) => {
    const url = new URL(location.href);
    const parts = url.pathname.split('/');
    const last = parts[parts.length - 1];
    if (!last || (!last.includes('.') && last !== 'index')) {
      parts.push(`index(js:${i})`);
    }
    url.pathname = parts.join('/');
    return url.toString();
  };

  const ready = () => {
    const nodes = document.getElementsByTagName('script');
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const type = node.getAttribute('type');
      if (type === typeFlag && !node.loaded) {
        node.loaded = true;
        const url = node.getAttribute('src');
        if (url) {
          startByUrl(url);
        } else {
          startByCode(node.innerHTML, getFilename(i), location.href);
        }
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
