let i = 0;
const exec = async (code) => {
  const execCode = await VirtualModule.startByCode(code, `${String(i++)}.js`);
  return execCode();
};

describe('import', () => {
  it('one', async () => {
    const code = `
      import a from './files/one.js'
      console.log(expect, a)
    `;
    await exec(code);
  });
});
