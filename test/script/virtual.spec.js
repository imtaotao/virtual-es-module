const startByUrl = async (entry) => {
  const execCode = await VirtualModule.startByUrl(entry);
  await execCode();
  return new Promise(setTimeout);
};

describe('Virtual import', () => {
  it('export declaration', async () => {
    await startByUrl('./case/exportDeclaration/m1.js');
  });

  it('circular reference', async () => {
    await startByUrl('./case/circularReference/m3.js');
  });

  it('export namespace', async () => {
    await startByUrl('./case/exportNamespace/m5.js');
  });
});
