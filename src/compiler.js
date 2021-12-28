import * as t from '@babel/types';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';
import { moduleResource } from './exec';

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
    const isDefault = t.isImportDefaultSpecifier(n);
    const isNamespace = t.isImportNamespaceSpecifier(n);
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
    moduleId: node.source.value,
  };
}

function importInformationBySource(node) {
  const imports = (node.specifiers || []).map((n) => {
    const isNamespace = t.isExportNamespaceSpecifier(n);
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
    moduleId: node.source.value,
  };
}

function checkImportNames(imports, moduleId) {
  const exports = childModuleExports(moduleId);
  imports.forEach(item => {
    if (item.isNamespace) return;
    const checkName = item.isDefault ? 'default' : item.name;
    if (!exports.includes(checkName)) {
      throw SyntaxError(
        `The module '${moduleId}' does not provide an export named '${checkName}'`,
      )
    }
  })
}

function hasUseEsmVars(scope, node) {
  const hasUse = (scope) =>
    Object.keys(scope.bindings).some((key) => {
      const varItem = scope.bindings[key];
      if (varItem.kind === 'module') {
        if (varItem.referencePaths.some((item) => item.node === node)) {
          return true;
        }
        return varItem.constantViolations.some(({ node }) => node.left === node);
      }
    });
  while (scope) {
    if (hasUse(scope)) return true;
    scope = scope.parent;
  }
  return false;
}

function createImportTransformNode(moduleName, moduleId) {
  const importMethod = t.identifier(__VIRTUAL_IMPORT__);
  const dynamicMethodNode = t.callExpression(importMethod, [t.stringLiteral(moduleId)]);
  const varNode = t.variableDeclarator(
    t.identifier(moduleName),
    dynamicMethodNode,
  );
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
    ...importInfos.map((val) => val.transformNode),
  );
}

function createWrapperFunction(ast) {
  const { body } = ast.program;
  const params = [
    __VIRTUAL_IMPORT__,
    __VIRTUAL_EXPORT__,
    __VIRTUAL_NAMESPACE__,
    __VIRTUAL_IMPORT_META__,
    __VIRTUAL_DYNAMIC_IMPORT__,
  ].map((key) => t.identifier(key));
  const left = t.memberExpression(
    t.identifier('globalThis'),
    t.identifier(__VIRTUAL_WRAPPER__),
  );
  const fnDirectives = t.directive(t.directiveLiteral('use strict'));
  const fnBody = body.map((node) => {
    return t.isExpression(node) ? t.expressionStatement(node) : node;
  });
  const right = t.functionExpression(
    null,
    params,
    t.blockStatement(fnBody, [fnDirectives]),
  );
  ast.program.body = [
    t.expressionStatement(t.assignmentExpression('=', left, right)),
  ];
}

export function transform(opts) {
  let moduleCount = 0;
  const importInfos = [];
  const exportInfos = [];
  const deferQueue = {
    importChecks: new Set(),
    importRemoves: new Set(),
    identifierRefs: new Set(),
    exportNamespaces: new Set(),
  }
  const ast = parse(opts.code, { sourceType: 'module' });

  const refModule = (refName) => {
    for (const { data } of importInfos) {
      for (let i = 0; i < data.imports.length; i++) {
        const { name, alias } = data.imports[i];
        if (refName === alias || refName === name) {
          return { i, data };
        }
      }
    }
  };

  // 替换为 `__mo__.x`;
  const importReplaceNode = (name) => {
    const { i, data } = refModule(name) || {};
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

  // 收集信息
  // https://262.ecma-international.org/7.0/#prod-ImportedBinding
  traverse(ast, {
    // 静态 import
    ImportDeclaration(path) {
      const { node } = path;
      const moduleId = node.source.value;
      const data = importInformation(node);
      const moduleName = `__m${moduleCount++}__`;
      const transformNode = createImportTransformNode(moduleName, moduleId);
      data.moduleName = moduleName;
      importInfos.push({ data, transformNode });
      deferQueue.importRemoves.add(() => path.remove());
      deferQueue.importChecks.add(() => checkImportNames(data.imports, moduleId));
    },

    // 动态 import
    CallExpression(path) {
      const { node } = path;
      if (t.isImport(node.callee)) {
        const replaceNode = t.callExpression(
          t.identifier(__VIRTUAL_DYNAMIC_IMPORT__),
          node.arguments,
        );
        path.replaceWith(replaceNode);
      }
    },

    // import.meta
    MetaProperty(path) {
      const { node } = path;
      const replaceNode = t.memberExpression(
        t.identifier(__VIRTUAL_IMPORT_META__),
        node.property,
      );
      path.replaceWith(replaceNode);
    },

    // 引用替换
    Identifier(path) {
      const { node, parent, context } = path;
      if (t.isExportSpecifier(parent)) return;
      if (!hasUseEsmVars(context.scope, node)) return;
      const change = () => {
        const replaceNode = importReplaceNode(node.name);
        replaceNode && path.replaceWith(replaceNode);
      };
      deferQueue.identifierRefs.add(change);
    },

    // export 声明
    ExportDeclaration(path) {
      const { node, context } = path;
      const { specifiers, declaration } = node;

      if (declaration) {
        const isDefault = t.isExportDefaultDeclaration(node);
        const nodes = t.isVariableDeclaration(declaration)
          ? declaration.declarations
          : [declaration];

        nodes.forEach((node) => {
          let name, refNode;
          if (isDefault) {
            name = 'default';
            refNode = t.identifier(__VIRTUAL_DEFAULT__);
          } else {
            name = node.name ? node.name : node.id.name;
            refNode = t.identifier(name);
          }
          exportInfos.push({ name, refNode });
        });

        if (isDefault) {
          const varName = t.identifier(__VIRTUAL_DEFAULT__);
          const varNode = t.variableDeclarator(varName, declaration);
          path.replaceWith(t.variableDeclaration('const', [varNode]));
        } else if (t.isIdentifier(declaration)) {
          path.remove();
        } else {
          path.replaceWith(declaration);
        }
      } else if (specifiers) {
        const { source } = node;
        if (source) {
          const moduleId =  source.value
          const moduleName = `__m${moduleCount++}__`;
          const data = importInformationBySource(node);
          const transformNode = createImportTransformNode(moduleName, moduleId);
          data.moduleName = moduleName;
          importInfos.push({ data, transformNode });
          deferQueue.importChecks.add(() => checkImportNames(data.imports, moduleId));
          specifiers.forEach((n) => {
            let refName;
            if (t.isExportNamespaceSpecifier(n)) {
              refName = n.exported.name;
            } else {
              refName = n.local.name;
            }
            const refNode = importReplaceNode(refName);
            exportInfos.push({ refNode, name: n.exported.name });
          });
        } else {
          specifiers.forEach((n) => {
            const refNode = hasUseEsmVars(context.scope, n.local)
              ? importReplaceNode(n.local.name)
              : t.identifier(n.local.name);
            exportInfos.push({ refNode, name: n.exported.name });
          });
        }
        path.remove();
      } else if (t.isExportAllDeclaration(node)) {
        const moduleId = node.source.value;
        const moduleName = `__m${moduleCount++}__`;
        const data = importInformationBySource(node);
        const transformNode = createImportTransformNode(moduleName, moduleId);
        data.moduleName = moduleName;
        importInfos.push({ data, transformNode });
        path.remove();

        deferQueue.exportNamespaces.add({
          moduleId,
          fn: (names) => {
            names.forEach((name) => {
              const refNode = t.memberExpression(
                t.identifier(moduleName),
                t.identifier(name),
              );
              exportInfos.push({ refNode, name });
            });
          },
        });
      }
    },
  });

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
    deferQueue.importRemoves.forEach((fn) => fn());

    // 生成转换后的代码
    createVirtualModuleApi(ast, importInfos, exportInfos);
    createWrapperFunction(ast);

    return generate(
      ast,
      {
        sourceMaps: true,
        filename: opts.filename,
        sourceFileName: opts.filename,
      },
      {
        [opts.filename]: opts.code,
      },
    );
  }

  return {
    generateCode,
    exports: exportInfos.map((v) => v.name),
    imports: importInfos.map((v) => v.data),
  };
}
