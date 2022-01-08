describe('Native import', () => {
  beforeEach(function () {
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;
  });

  it('export declaration', async () => {
    await import('./case/exportDeclaration/m1.js');
  });

  it('circular reference', async () => {
    await import('./case/circularReference/m1.js');
  });

  it('export namespace', async () => {
    await import('./case/exportNamespace/m1.js');
  });

  it('import meta', async () => {
    await import('./case/importMeta/m1.js');
  });

  it('import check(import)', async () => {
    let isError = false;
    try {
      await import('./case/importCheck/m1.js');
    } catch {
      isError = true;
    }
    expect(isError).toBe(true);
  });

  it('import check(export)', async () => {
    let isError = false;
    try {
      await import('./case/importCheck/m2.js');
    } catch {
      isError = true;
    }
    expect(isError).toBe(true);
  });

  it('resource redirect', async () => {
    await import('./case/resourceRedirect/m1.js');
  });
});
