let i = 0;
globalThis.exec = async (code) => {
  const execCode = await VirtualModule.startByCode(code, `${String(i++)}.js`);
  await execCode();
  return new Promise(setTimeout);
};
