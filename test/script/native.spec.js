describe('Native import', () => {
  it('export declaration', async () => {
    await import('./case/exportDeclaration/m1.js');
  });

  it('circular reference', async () => {
    await import('./case/circularReference/m3.js');
  });

  it('export namespace', async () => {
    await import('./case/exportNamespace/m5.js');
  });
});
