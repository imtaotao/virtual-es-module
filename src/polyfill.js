if (!globalThis.Buffer) {
  globalThis.Buffer = {
    isBuffer: () => false,
  }
}

if (!globalThis.process) {
  globalThis.process = {};
}