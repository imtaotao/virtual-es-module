import { Parser } from 'acorn';
import { ancestor } from 'acorn-walk';
import { generate } from 'escodegen';
import { createState } from './state';
import { moduleResource } from '../execCode';
import {
  isIdentifier,
  isVariableDeclaration,
  isExportAllDeclaration,
  isImportDefaultSpecifier,
  isImportNamespaceSpecifier,
  isExportNamespaceSpecifier,
  isExportDefaultDeclaration,
} from './types';

export const __VIRTUAL_WRAPPER__ = '__VIRTUAL_WRAPPER__';
const __VIRTUAL_IMPORT__ = '__VIRTUAL_IMPORT__';
const __VIRTUAL_EXPORT__ = '__VIRTUAL_EXPORT__';
const __VIRTUAL_DEFAULT__ = '__VIRTUAL_DEFAULT__';
const __VIRTUAL_NAMESPACE__ = '__VIRTUAL_NAMESPACE__';
const __VIRTUAL_IMPORT_META__ = '__VIRTUAL_IMPORT_META__';
const __VIRTUAL_DYNAMIC_IMPORT__ = '__VIRTUAL_DYNAMIC_IMPORT__';

function childModuleExports(moduleId) {
  return moduleResource[moduleId].exports;
}

function importInformation(node) {
  const imports = node.specifiers.map((n) => {
    const isDefault = isImportDefaultSpecifier(n);
    const isNamespace = isImportNamespaceSpecifier(n);
    const isSpecial = isDefault || isNamespace;
    const alias = isSpecial ? null : n.local.name;
    // https://doc.esdoc.org/github.com/mason-lang/esast/function/index.html#static-function-identifier
    const name = isSpecial ? n.local.name : n.imported.name;
    return {
      name,
      isDefault,
      isNamespace,
      alias: alias === name ? null : alias,
    };
  });
  return {
    imports,
    isExport: false,
    moduleId: node.source.value,
  };
}

function importInformationBySource(node) {
  const imports = (node.specifiers || []).map((n) => {
    const isNamespace = isExportNamespaceSpecifier(n);
    const alias = isNamespace ? null : n.exported.name;
    const name = isNamespace ? n.exported.name : n.local.name;
    return {
      name,
      isNamespace,
      alias: alias === name ? null : alias,
    };
  });
  return {
    imports,
    isExport: true,
    moduleId: node.source.value,
  };
}

function checkImportNames(imports, moduleId) {
  const exports = childModuleExports(moduleId);
  imports.forEach((item) => {
    if (item.isNamespace) return;
    const checkName = item.isDefault ? 'default' : item.name;
    if (!exports.includes(checkName)) {
      throw SyntaxError(
        `The module '${moduleId}' does not provide an export named '${checkName}'`,
      );
    }
  });
}

function hasUseEsmVars(scope, node) {
  const hasUse = (scope) =>
    Object.keys(scope.bindings).some((key) => {
      const varItem = scope.bindings[key];
      if (varItem.kind === 'module') {
        if (varItem.references.some((n) => n === node)) {
          return true;
        }
        return varItem.constantViolations.some((n) => n.left === node);
      }
    });
  while (scope) {
    if (hasUse(scope)) return true;
    scope = scope.parent;
  }
  return false;
}

function createImportTransformNode(moduleName, moduleId) {
  const varName = t.identifier(moduleName);
  const varExpr = t.callExpression(t.identifier(__VIRTUAL_IMPORT__), [
    t.stringLiteral(moduleId),
  ]);
  const varNode = t.variableDeclarator(varName, varExpr);
  return t.variableDeclaration('const', [varNode]);
}

function createVirtualModuleApi(ast, importInfos, exportInfos) {
  const exportNodes = exportInfos.map(({ name, refNode }) => {
    return t.objectProperty(
      t.identifier(name),
      t.arrowFunctionExpression([], refNode),
    );
  });
  const exportCallExpression = t.callExpression(
    t.identifier(__VIRTUAL_EXPORT__),
    [t.objectExpression(exportNodes)],
  );
  ast.program.body.unshift(
    exportCallExpression,
    ...new Set(importInfos.map((val) => val.transformNode)),
  );
}

export function transform(opts) {
  const parser = new Parser({ sourceType: 'module' }, opts.code);
  const ast = parser.parse();
  const state = createState(ast);

  const findIndxInData = (refName, data) => {
    for (let i = 0; i < data.imports.length; i++) {
      const { name, alias } = data.imports[i];
      if (refName === alias || refName === name) {
        return { i, data };
      }
    }
  };

  const refModule = (refName) => {
    for (const { data, isExport } of importInfos) {
      if (!isExport) {
        const res = findIndxInData(refName, data);
        if (res) return res;
      }
    }
  };

  const findImportInfo = (moduleId) => {
    for (const info of importInfos) {
      if (info.data.moduleId === moduleId) {
        return [info.data.moduleName, info.transformNode];
      }
    }
    return [];
  };

  // 替换为 `__mo__.x`;
  const importReplaceNode = (nameOrInfo) => {
    const { i, data } =
      typeof nameOrInfo === 'string' ? refModule(nameOrInfo) : nameOrInfo;
    if (data) {
      const item = data.imports[i];
      if (item.isNamespace) {
        return t.callExpression(t.identifier(__VIRTUAL_NAMESPACE__), [
          t.identifier(data.moduleName),
        ]);
      } else {
        const propName = item.isDefault ? 'default' : item.name;
        return t.memberExpression(
          t.identifier(data.moduleName),
          t.identifier(propName),
        );
      }
    }
  };

  // 收集信息以及更改 ast
  // https://262.ecma-international.org/7.0/#prod-ImportedBinding
  ancestor(
    ast,
    {
      ImportDeclaration(node, state, ancestors) {
        const moduleId = node.source.value;
        const data = importInformation(node);
        let [moduleName, transformNode] = findImportInfo(moduleId);
        if (!moduleName) {
          moduleName = `__m${moduleCount++}__`;
          transformNode = createImportTransformNode(moduleName, moduleId);
        }

        console.log(data);
        data.moduleName = moduleName;
        importInfos.push({ data, transformNode });
        deferQueue.importRemoves.add(() => {
          state.remove(node, ancestors);
        });
        deferQueue.importChecks.add(() =>
          checkImportNames(data.imports, moduleId),
        );
      },
    },
    null,
    state,
  );

  function generateCode() {}

  return {
    generateCode,
    exports: exportInfos.map((v) => v.name),
    imports: importInfos.map((v) => v.data),
  };
}
