const runtime = new VirtualModule.Runtime();
const startByUrl = async (entry) => {
  const base = new URL('./base/script/', location.href).href;
  entry = new URL(entry, base).href;
  await runtime.importByUrl(entry);
  return new Promise(setTimeout);
};

describe('Virtual import', () => {
  beforeEach(function () {
    globalThis.orderIndex = 0;
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;
  });

  it('export declaration', async () => {
    await startByUrl('./case/exportDeclaration/m1.js');
  });

  it('circular reference', async () => {
    await startByUrl('./case/circularReference/m1.js');
  });

  it('export namespace', async () => {
    await startByUrl('./case/exportNamespace/m1.js');
  });

  it('export all', async () => {
    await startByUrl('./case/exportAll/m1.js');
  });

  it('import meta', async () => {
    await startByUrl('./case/importMeta/m1.js');
  });

  it('variable check', async () => {
    await startByUrl('./case/variableCheck/m1.js');
  });

  it('dynamic import', async () => {
    await startByUrl('./case/dynamicImport/m1.js');
  });

  it('execution order check', async () => {
    await startByUrl('./case/executionOrder/m1.js');
  });

  it('resource redirect', async () => {
    await startByUrl('./case/resourceRedirect/m1.js');
  });

  it('import check(import)', async () => {
    let isError = false;
    try {
      await startByUrl('./case/importCheck/m1.js');
    } catch {
      isError = true;
    }
    expect(isError).toBe(true);
  });

  it('import check(export)', async () => {
    let isError = false;
    try {
      await startByUrl('./case/importCheck/m2.js');
    } catch {
      isError = true;
    }
    expect(isError).toBe(true);
  });

  it('strict mode check', async () => {
    let isError = false;
    try {
      await startByUrl('./case/strictModeCheck/m1.js');
    } catch {
      isError = true;
    }
    expect(isError).toBe(true);
  });
});
