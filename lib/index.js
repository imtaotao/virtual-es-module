import { transform } from './compiler';
import { execCode, importModule, compileAndFetchCode } from './exec';

export async function startByUrl(entry) {
  await compileAndFetchCode(entry);
  importModule(entry);
}

export async function startByCode(code) {

}

startByUrl('./m3.js');