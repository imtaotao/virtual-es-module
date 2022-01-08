const startByUrl = async (entry) => {
  const base = new URL('./base/script/', location.href).href;
  entry = new URL(entry, base).href;
  const execCode = await VirtualModule.startByUrl(entry);
  await execCode();
  return new Promise(setTimeout);
};

describe('Virtual import', () => {
  it('export declaration', async () => {
    await startByUrl('./case/exportDeclaration/m1.js');
  });

  it('circular reference', async () => {
    await startByUrl('./case/circularReference/m1.js');
  });

  it('export namespace', async () => {
    await startByUrl('./case/exportNamespace/m1.js');
  });

  it('import meta', async () => {
    await startByUrl('./case/importMeta/m1.js');
  });
});
