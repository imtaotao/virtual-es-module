// 运行时通过 js 来分析，比原生 esModule 的慢 8 倍左右
import { Runtime } from './runtime';
export { Runtime } from './runtime';

function startByUrl(entry) {
  const runtime = new Runtime();
  return runtime.importByUrl(entry);
}

function startByCode(originCode, filename, metaUrl) {
  const runtime = new Runtime();
  return runtime.importByCode(originCode, filename, metaUrl);
}

async function startByScriptTags(typeFlag) {
  if (!typeFlag) throw new Error('Missing typeFlag');
  const execQueue = [];
  const nodes = document.getElementsByTagName('script');

  const getFilename = (i) => {
    const url = new URL(location.href);
    const parts = url.pathname.split('/');
    const last = parts[parts.length - 1];
    if (!last || (!last.includes('.') && last !== 'index')) {
      const file = `index(js:${i})`;
      if (last === '') {
        parts[parts.length - 1] = file;
      } else {
        parts.push(file);
      }
    }
    url.pathname = parts.join('/');
    return url.toString();
  };

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const type = node.getAttribute('type');
    if (type === typeFlag && !(node as any).loaded) {
      (node as any).loaded = true;
      const url = node.getAttribute('src');
      const exec = url
        ? () => startByUrl(url)
        : () => startByCode(node.innerHTML, getFilename(i), location.href);
      execQueue.push(exec);
    }
  }
  
  for (const exec of execQueue) {
    await exec();
  }
}

if (typeof document !== 'undefined') {
  const typeFlag = 'virtual-module';
  if (document.readyState === 'complete') {
    setTimeout(() => startByScriptTags(typeFlag));
  } else {
    document.addEventListener(
      'DOMContentLoaded',
      () => startByScriptTags(typeFlag),
      false,
    );
  }
}