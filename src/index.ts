// 运行时通过 js 来分析，比原生 esModule 的慢 8 倍左右
import { Runtime } from './runtime';

export { Runtime } from './runtime';
export const version = __VERSION__;

if (__BROWSER__ && typeof document !== 'undefined') {
  const runtime = new Runtime();
  const typeTag = 'virtual-module';

  function filename(i) {
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
  }

  async function startByScriptTags() {
    const nodes = document.getElementsByTagName('script');

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const type = node.getAttribute('type');
      if (type === typeTag && !(node as any).loaded) {
        (node as any).loaded = true;
        const url = node.getAttribute('src');
        const exec = url
          ? () => runtime.importByUrl(url)
          : () =>
              runtime.importByCode(node.innerHTML, filename(i), location.href);
        await exec();
      }
    }
  }

  if (document.readyState === 'complete') {
    setTimeout(() => startByScriptTags());
  } else {
    document.addEventListener(
      'DOMContentLoaded',
      () => startByScriptTags(),
      false,
    );
  }
}
