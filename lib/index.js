import { transform } from './compiler';
import { execCode, importModule, compilerAndFetchCode } from './exec';

export async function startByUrl(entry) {
  await compilerAndFetchCode(entry);
  importModule(entry);
}

export async function startByCode(code) {

}

startByUrl('./m3.js');