let i = 0;
globalThis.startByCode = async (code) => {
  const execCode = await VirtualModule.startByCode(code, `${String(i++)}.js`);
  await execCode();
  return new Promise(setTimeout);
};

globalThis.startByUrl = async (entry) => {
  const execCode = await VirtualModule.startByUrl(entry);
  await execCode();
  return new Promise(setTimeout);
};
