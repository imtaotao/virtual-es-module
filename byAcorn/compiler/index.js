import { Parser } from 'acorn';
import { ancestor } from 'acorn-walk';
import { createState } from './state';
import { moduleResource } from '../execCode';

export const __VIRTUAL_WRAPPER__ = '__VIRTUAL_WRAPPER__';
const __VIRTUAL_IMPORT__ = '__VIRTUAL_IMPORT__';
const __VIRTUAL_EXPORT__ = '__VIRTUAL_EXPORT__';
const __VIRTUAL_DEFAULT__ = '__VIRTUAL_DEFAULT__';
const __VIRTUAL_NAMESPACE__ = '__VIRTUAL_NAMESPACE__';
const __VIRTUAL_IMPORT_META__ = '__VIRTUAL_IMPORT_META__';
const __VIRTUAL_DYNAMIC_IMPORT__ = '__VIRTUAL_DYNAMIC_IMPORT__';

export function transform(opts) {
  const parser = new Parser({ sourceType: 'module' }, opts.code);
  const ast = parser.parse();
  console.log(ast);
  const state = createState(ast);

  // ancestor(ast, {
  //   ImportDeclaration(node, state, ancestors) {
  //     console.log(node, state);
  //   }, null, state
  // })

  function generateCode() {}

  return {
    generateCode,
    exports: exportInfos.map((v) => v.name),
    imports: importInfos.map((v) => v.data),
  };
}
