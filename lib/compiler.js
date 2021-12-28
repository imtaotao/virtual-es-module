import * as t from '@babel/types';
import { parse }from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';

const __VIRTUAL_IMPORT__ = '__VIRTUAL_IMPORT__';
const __VIRTUAL_EXPORT__ = '__VIRTUAL_EXPORT__';
const __VIRTUAL_DEFAULT__ = '__VIRTUAL_DEFAULT__';
const __VIRTUAL_NAMESPACE__ = '__VIRTUAL_NAMESPACE__';
const __VIRTUAL_DYNAMIC_IMPORT__ = '__VIRTUAL_DYNAMIC_IMPORT__';
export const __VIRTUAL_WRAPPER__ = '__VIRTUAL_WRAPPER__';

function importInformation(node) {
  const imports = node.specifiers.map((n) => {
    const isDefault = t.isImportDefaultSpecifier(n);
    const isNamespace = t.isImportNamespaceSpecifier(n);
    const isSpecial = isDefault || isNamespace;
    const alias = isSpecial ? null : n.local.name;
    // https://doc.esdoc.org/github.com/mason-lang/esast/function/index.html#static-function-identifier
    const name = isSpecial
      ? n.local.name
      : n.imported.name;
    return {
      name,
      isDefault,
      isNamespace,
      alias: alias === name ? null : alias,
    };
  });
  return {
    imports,
    moduleName: node.source.value,
  };
}

function hasUseEsmVars(path, compare) {
  let scope = path.context.scope;
  const hasUse = (scope) => Object.keys(scope.bindings).some(key => {
    const { kind, referencePaths, constantViolations} = scope.bindings[key];
    if (kind === 'module') {
      if (compare) return compare(referencePaths);
      if (referencePaths.some((item) => item.node === path.node)) {
        return true;
      }
      return constantViolations.some(({ node }) => node.left === path.node);
    }
  })
  while(scope) {
    if (hasUse(scope)) return true;
    scope = scope.parent;
  }
  return false;
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
    ...importInfos.map(val => val.transformNode),
  );
}

function createWrapperFunction(ast) {
  const { body } = ast.program;
  const params = [
    __VIRTUAL_IMPORT__,
    __VIRTUAL_EXPORT__,
    __VIRTUAL_NAMESPACE__,
    __VIRTUAL_DYNAMIC_IMPORT__,
  ].map(key => t.identifier(key));
  const left = t.memberExpression(
    t.identifier('globalThis'),
    t.identifier(__VIRTUAL_WRAPPER__),
  );
  const fnDirectives = t.directive(t.directiveLiteral('use strict'));
  const fnBody = body.map(node => {
    return t.isExpression(node) ? t.expressionStatement(node) : node
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
  let moduleId = 0;
  const importInfos = [];
  const exportInfos = [];
  const exportSpecifiers = new Set();
  const identifierChanges = new Set();
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
  }

  const importReplaceNode = (name) => {
    const { i, data } = refModule(name) || {};
    if (data) {
      const item = data.imports[i];
      if (item.isNamespace) {
        return t.callExpression(
          t.identifier(__VIRTUAL_NAMESPACE__),
          [t.identifier(data.transformModuleName)],
        )
      } else {
        const propName = item.isDefault ? 'default' : item.name; 
        return t.memberExpression(
          t.identifier(data.transformModuleName),
          t.identifier(propName),
        );
      }
    }
  }

  // 收集信息
  traverse(ast, {
    ImportDeclaration(path) {
      const { node } = path;
      const data = importInformation(node);
      const transformModuleName = `_m${moduleId++}_`;
      const dynamicMethodNode = t.callExpression(
        t.identifier(__VIRTUAL_IMPORT__),
        [t.stringLiteral(node.source.value)],
      );
      const varNode = t.variableDeclarator(
        t.identifier(transformModuleName),
        dynamicMethodNode,
      )
      const transformNode = t.variableDeclaration('const', [varNode]);
      data.transformModuleName = transformModuleName;
      importInfos.push({
        data,
        transformNode,
        remove: () => path.remove(),
      });
    },

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

    Identifier(path) {
      const { node, parent } = path;
      if (t.isExportSpecifier(parent)) return;
      if (!hasUseEsmVars(path)) return;
      const change = () => {
        const replaceNode = importReplaceNode(node.name);
        replaceNode && path.replaceWith(replaceNode);
      }
      identifierChanges.add(change);
    },

    ExportDeclaration(path) {
      const { node } = path;
      const { declaration } = node;
      if (!declaration) return; // 可能是注释
      const isDefault = t.isExportDefaultDeclaration(node);
      const nodes = t.isVariableDeclaration(declaration)
        ? declaration.declarations
        : [declaration];
      
      nodes.forEach(node => {
        let name, refNode;
        if (isDefault) {
          name = 'default';
          refNode = t.identifier(__VIRTUAL_DEFAULT__);
        } else {
          name = node.name ? node.name : node.id.name;
          refNode = t.identifier(name);
        }
        exportInfos.push({ name, refNode });
      })

      if (isDefault) {
        const varName = t.identifier(__VIRTUAL_DEFAULT__);
        const varNode = t.variableDeclarator(varName, declaration);
        path.replaceWith(t.variableDeclaration('const', [varNode]));
      } else if (t.isIdentifier(declaration)) {
        path.remove();
      } else {
        path.replaceWith(declaration);
      }
    },

    ExportSpecifier(path) {
      const { local, exported } = path.node;
      const refNode = hasUseEsmVars(path, (refs) => refs.some(p => p.node === local))
        ? importReplaceNode(local.name)
        : t.identifier(local.name);
      exportSpecifiers.add(path.parentPath);
      exportInfos.push({ refNode, name: exported.name });
    },
  })

  // 删除原生的 es module 代码（顺序很重要）
  identifierChanges.forEach(fn => fn());
  exportSpecifiers.forEach(path => path.remove());
  importInfos.forEach(({ remove }) => remove());

  // 生成转换后的代码
  createVirtualModuleApi(ast, importInfos, exportInfos);
  createWrapperFunction(ast);

  const output = generate(
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
  return {
    output,
    imports: importInfos.map(v => v.data),
  };
}
