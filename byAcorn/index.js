import { transform } from './compiler/index';
import { execCode, importModule, compileAndFetchCode } from './execCode';

export async function startByUrl(entry) {
  if (!entry) throw new Error('Missing entry');
  await compileAndFetchCode(entry);
  return () => importModule(entry);
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
    imports.map(({ moduleId }) => compileAndFetchCode(moduleId, metaUrl)),
  );
  const output = generateCode();
  output.url = metaUrl;
  output.exports = exports;
  const { code, map } = output;
  const module = {};
  return () => execCode(metaUrl, module, code, map);
}

export async function startByScriptTags(typeFlag) {
  if (!typeFlag) throw new Error('Missing typeFlag');
  const execQueue = [];
  const nodes = document.getElementsByTagName('script');

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

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const type = node.getAttribute('type');
    if (type === typeFlag && !node.loaded) {
      node.loaded = true;
      const url = node.getAttribute('src');
      const exec = url
        ? await startByUrl(url)
        : await startByCode(node.innerHTML, getFilename(i), location.href);
      execQueue.push(exec);
    }
  }
  execQueue.forEach((exec) => exec());
}

// 如果是在浏览器环境中，则直接执行代码
// if (typeof document !== 'undefined') {
//   const typeFlag = 'virtual-module';
//   if (document.readyState === 'complete') {
//     setTimeout(() => startByScriptTags(typeFlag));
//   } else {
//     document.addEventListener(
//       'DOMContentLoaded',
//       () => startByScriptTags(typeFlag),
//       false,
//     );
//   }
// }
startByUrl('./m3.js');
