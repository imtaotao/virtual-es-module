describe('import', () => {
  it('export declaration', async () => {
    await startByUrl('./files/m1.js');
  });

  it('circular reference', async () => {
    await startByUrl('./files/m3.js');
  })
});
