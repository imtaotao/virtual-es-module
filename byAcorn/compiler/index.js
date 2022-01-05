import { Parser } from 'acorn';
import { ancestor } from 'acorn-walk';
import { generate } from 'escodegen';
import { createState } from './state';
import { moduleResource } from '../execCode';
import {
  isIdentifier,
  isVariableDeclaration,
  isExportSpecifier,
  isExportAllDeclaration,
  isExportNamespaceSpecifier,
  isExportDefaultDeclaration,
  isImportDefaultSpecifier,
  isImportNamespaceSpecifier,
} from './types';
import {
  literal,
  identifier,
  callExpression,
  objectProperty,
  blockStatement,
  objectExpression,
  memberExpression,
  variableDeclarator,
  variableDeclaration,
  expressionStatement,
  functionDeclaration,
  arrowFunctionExpression,
} from './generated';

export const __VIRTUAL_WRAPPER__ = '__VIRTUAL_WRAPPER__';
const __VIRTUAL_IMPORT__ = '__VIRTUAL_IMPORT__';
const __VIRTUAL_EXPORT__ = '__VIRTUAL_EXPORT__';
const __VIRTUAL_DEFAULT__ = '__VIRTUAL_DEFAULT__';
const __VIRTUAL_NAMESPACE__ = '__VIRTUAL_NAMESPACE__';
const __VIRTUAL_IMPORT_META__ = '__VIRTUAL_IMPORT_META__';
const __VIRTUAL_DYNAMIC_IMPORT__ = '__VIRTUAL_DYNAMIC_IMPORT__';

function parseWrapper(parser, filename) {
  try {
    return parser.parse();
  } catch (e) {
    e.message += `(${filename})`;
    throw e;
  }
}

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

function createImportTransformNode(moduleName, moduleId) {
  const varName = identifier(moduleName);
  const varExpr = callExpression(identifier(__VIRTUAL_IMPORT__), [
    literal(moduleId),
  ]);
  const varNode = variableDeclarator(varName, varExpr);
  return variableDeclaration('const', [varNode]);
}

function createVirtualModuleApi(ast, importInfos, exportInfos) {
  const exportNodes = exportInfos.map(({ name, refNode }) => {
    return objectProperty(
      identifier(name),
      arrowFunctionExpression([], refNode),
    );
  });
  const exportCallExpression = callExpression(identifier(__VIRTUAL_EXPORT__), [
    objectExpression(exportNodes),
  ]);
  ast.body.unshift(
    exportCallExpression,
    ...new Set(importInfos.map((val) => val.transformNode)),
  );
}

function createWrapperFunction(ast) {
  const params = [
    __VIRTUAL_IMPORT__,
    __VIRTUAL_EXPORT__,
    __VIRTUAL_NAMESPACE__,
    __VIRTUAL_IMPORT_META__,
    __VIRTUAL_DYNAMIC_IMPORT__,
  ].map((key) => identifier(key));
  const id = identifier(__VIRTUAL_WRAPPER__);
  const directive = expressionStatement(literal('use strict'), 'use strict');
  ast.body = [
    functionDeclaration(id, params, blockStatement([directive, ...ast.body])),
  ];
}

export function transform(opts) {
  let moduleCount = 0;
  const importInfos = [];
  const exportInfos = [];
  const deferQueue = {
    removes: new Set(),
    replaces: new Set(),
    importChecks: new Set(),
    identifierRefs: new Set(),
    exportNamespaces: new Set(),
  };
  const parser = new Parser(
    { sourceType: 'module', ecmaVersion: 'latest' },
    opts.code,
  );
  const ast = parseWrapper(parser, opts.filename);
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

  const hasUseEsmVars = (scope, node) => {
    const hasUse = () =>
      Object.keys(scope.bindings).some((key) => {
        const { kind, references, constantViolations } = scope.bindings[key];
        if (kind === 'module') {
          return references.has(node) || constantViolations.has(node);
        }
      });
    while (scope) {
      if (hasUse()) return true;
      scope = scope.parent;
    }
    return false;
  };

  const importReplaceNode = (nameOrInfo) => {
    const { i, data } =
      typeof nameOrInfo === 'string' ? refModule(nameOrInfo) : nameOrInfo;
    if (data) {
      const item = data.imports[i];
      if (item.isNamespace) {
        return callExpression(identifier(__VIRTUAL_NAMESPACE__), [
          identifier(data.moduleName),
        ]);
      } else {
        const propName = item.isDefault ? 'default' : item.name;
        return memberExpression(
          identifier(data.moduleName),
          identifier(propName),
        );
      }
    }
  };

  const Identifier = (node, state, ancestors) => {
    const parent = ancestors[ancestors.length - 2];
    if (isExportSpecifier(parent)) return;
    const scope = state.getScopeByAncestors(ancestors);

    if (hasUseEsmVars(scope, node)) {
      ancestors = [...ancestors];
      deferQueue.identifierRefs.add(() => {
        const replacement = importReplaceNode(node.name);
        if (replacement) {
          state.replaceWith(replacement, ancestors);
        }
      });
    }
  };

  const ExportDeclaration = (node, state, ancestors) => {
    ancestors = [...ancestors];
    const { specifiers, declaration } = node;
    const scope = state.getScopeByAncestors(ancestors);

    if (declaration) {
      const isDefault = isExportDefaultDeclaration(node);
      const nodes = isVariableDeclaration(declaration)
        ? declaration.declarations
        : [declaration];

      nodes.forEach((node) => {
        let name, refNode;
        if (isDefault) {
          name = 'default';
          refNode = identifier(__VIRTUAL_DEFAULT__);
        } else {
          name = node.name ? node.name : node.id.name;
          refNode = identifier(name);
        }
        exportInfos.push({ name, refNode });
      });

      if (isDefault) {
        deferQueue.replaces.add(() => {
          const varName = identifier(__VIRTUAL_DEFAULT__);
          // declaration 可能已经被替换过了，需要重新从 node 上取
          const varNode = variableDeclarator(varName, node.declaration);
          state.replaceWith(variableDeclaration('const', [varNode]), ancestors);
        });
      } else if (isIdentifier(declaration)) {
        deferQueue.removes.add(() => state.remove(ancestors));
      } else {
        deferQueue.replaces.add(() => {
          state.replaceWith(node.declaration, ancestors);
        });
      }
    } else if (specifiers) {
      const { source } = node;
      if (source) {
        const moduleId = source.value;
        const data = importInformationBySource(node);
        let [moduleName, transformNode] = findImportInfo(moduleId);
        if (!moduleName) {
          moduleName = `__m${moduleCount++}__`;
          transformNode = createImportTransformNode(moduleName, moduleId);
        }
        data.moduleName = moduleName;
        importInfos.push({ data, transformNode });
        deferQueue.importChecks.add(() =>
          checkImportNames(data.imports, moduleId),
        );
        specifiers.forEach((n) => {
          let refName;
          if (isExportNamespaceSpecifier(n)) {
            refName = n.exported.name;
          } else {
            refName = n.local.name;
          }
          const useInfo = findIndxInData(refName, data);
          const refNode = importReplaceNode(useInfo);
          exportInfos.push({ refNode, name: n.exported.name });
        });
      } else {
        specifiers.forEach((n) => {
          const refNode = hasUseEsmVars(scope, n.local)
            ? importReplaceNode(n.local.name)
            : identifier(n.local.name);
          exportInfos.push({ refNode, name: n.exported.name });
        });
      }
      deferQueue.removes.add(() => state.remove(ancestors));
    } else if (isExportAllDeclaration(node)) {
      const moduleId = node.source.value;
      const data = importInformationBySource(node);
      let [moduleName, transformNode] = findImportInfo(moduleId);
      if (!moduleName) {
        moduleName = `__m${moduleCount++}__`;
        transformNode = createImportTransformNode(moduleName, moduleId);
      }
      data.moduleName = moduleName;
      importInfos.push({ data, transformNode });
      deferQueue.removes.add(() => state.remove(ancestors));

      deferQueue.exportNamespaces.add({
        moduleId,
        fn: (names) => {
          names.forEach((name) => {
            const refNode = memberExpression(
              identifier(moduleName),
              identifier(name),
            );
            exportInfos.push({ refNode, name });
          });
        },
      });
    }
  };

  // 收集信息以及更改 ast
  // https://262.ecma-international.org/7.0/#prod-ImportedBinding
  ancestor(
    ast,
    {
      // 引用替换
      Identifier: Identifier,
      // `let x = 1` 和 `x = 2;` `acorn` 给单独区分出来了
      VariablePattern: Identifier,

      // export 声明
      ExportAllDeclaration: ExportDeclaration,
      ExportNamedDeclaration: ExportDeclaration,
      ExportDefaultDeclaration: ExportDeclaration,

      // import 声明
      ImportDeclaration(node, state, ancestors) {
        ancestors = [...ancestors];
        const moduleId = node.source.value;
        const data = importInformation(node);
        let [moduleName, transformNode] = findImportInfo(moduleId);
        if (!moduleName) {
          moduleName = `__m${moduleCount++}__`;
          transformNode = createImportTransformNode(moduleName, moduleId);
        }
        data.moduleName = moduleName;
        importInfos.push({ data, transformNode });
        deferQueue.removes.add(() => state.remove(ancestors));
        deferQueue.importChecks.add(() =>
          checkImportNames(data.imports, moduleId),
        );
      },

      // 动态 import
      ImportExpression(node, state, ancestors) {
        const replacement = callExpression(
          identifier(__VIRTUAL_DYNAMIC_IMPORT__),
          [node.source],
        );
        state.replaceWith(replacement, ancestors);
      },

      // import.meta
      MetaProperty(node, state, ancestors) {
        if (node.meta.name === 'import') {
          const replacement = memberExpression(
            identifier(__VIRTUAL_IMPORT_META__),
            node.property,
          );
          state.replaceWith(replacement, ancestors);
        }
      },
    },
    null,
    state,
  );

  function generateCode() {
    const nameCounts = {};
    deferQueue.exportNamespaces.forEach(({ moduleId }) => {
      childModuleExports(moduleId).forEach((name) => {
        if (!nameCounts[name]) {
          nameCounts[name] = 1;
        } else {
          nameCounts[name]++;
        }
      });
    });

    deferQueue.exportNamespaces.forEach(({ fn, moduleId }) => {
      // `export namespace` 变量的去重
      const exports = childModuleExports(moduleId).filter((name) => {
        if (name === 'default') return false;
        if (nameCounts[name] > 1) return false;
        return exportInfos.every((val) => val.name !== name);
      });
      fn(exports);
    });

    deferQueue.importChecks.forEach((fn) => fn());
    deferQueue.identifierRefs.forEach((fn) => fn());
    deferQueue.replaces.forEach((fn) => fn());
    deferQueue.removes.forEach((fn) => fn());

    // 生成转换后的代码
    createVirtualModuleApi(ast, importInfos, exportInfos);
    createWrapperFunction(ast);

    const output = generate(ast, {
      sourceMap: opts.code,
      sourceMapWithCode: true,
      file: opts.filename,
    });
    return output;
  }

  return {
    generateCode,
    exports: exportInfos.map((v) => v.name),
    imports: importInfos.map((v) => v.data),
  };
}
