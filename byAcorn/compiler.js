import { parse } from 'acorn';
import * as walk from 'acorn-walk';
import { moduleResource } from './execCode';

export const __VIRTUAL_WRAPPER__ = '__VIRTUAL_WRAPPER__';
const __VIRTUAL_IMPORT__ = '__VIRTUAL_IMPORT__';
const __VIRTUAL_EXPORT__ = '__VIRTUAL_EXPORT__';
const __VIRTUAL_DEFAULT__ = '__VIRTUAL_DEFAULT__';
const __VIRTUAL_NAMESPACE__ = '__VIRTUAL_NAMESPACE__';
const __VIRTUAL_IMPORT_META__ = '__VIRTUAL_IMPORT_META__';
const __VIRTUAL_DYNAMIC_IMPORT__ = '__VIRTUAL_DYNAMIC_IMPORT__';

export function transform(opts) {
  const ast = parse(opts.code, { sourceType: 'module' });
  console.log(ast);

  walk.ancestor(ast, {
    ImportDeclaration(node, state) {
      console.log(node, state);
    }
  })

  function generateCode() {}

  return {
    generateCode,
    exports: exportInfos.map((v) => v.name),
    imports: importInfos.map((v) => v.data),
  };
}
