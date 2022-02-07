export function isPromise(obj: any): obj is Promise<any> {
  return obj && typeof obj === 'object' && typeof obj.then === 'function';
}

export function transformUrl(resolvePath: string, curPath: string) {
  const baseUrl = new URL(resolvePath, location.href);
  const realPath = new URL(curPath, baseUrl.href);
  return realPath.href;
}

export function toBase64(input: string) {
  return new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(new Blob([input]));
    reader.onload = () => resolve(reader.result as string);
  });
}

const SOURCEMAP_REG = /[@#] sourceMappingURL=/g;
export function haveSourcemap(code: string) {
  return SOURCEMAP_REG.test(code);
}

export function evalWithEnv(
  code: string,
  params: Record<string, any>,
  context?: any,
) {
  const keys = Object.keys(params);
  const nativeWindow = (0, eval)('window;');
  const randomValKey = '__exec_temporary__';
  const values = keys.map((k) => `window.${randomValKey}.${k}`);
  const contextKey = '__exec_temporary_context__';

  try {
    nativeWindow[randomValKey] = params;
    nativeWindow[contextKey] = context;
    const evalInfo = [
      `;(function(${keys.join(',')}){"use strict";`,
      `\n}).call(window.${contextKey},${values.join(',')});`,
    ];
    (0, eval)(evalInfo[0] + code + evalInfo[1]);
  } catch (e) {
    throw e;
  } finally {
    delete nativeWindow[randomValKey];
    delete nativeWindow[contextKey];
  }
}
