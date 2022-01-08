describe('Native import', () => {
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
});
