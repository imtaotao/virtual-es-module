import * as t from '@babel/types';
import { parse }from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';

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

function hasUseEsmVars(path) {
  let scope = path.context.scope;
  const hasUse = (scope) => Object.keys(scope.bindings).some(key => {
    const varItem = scope.bindings[key];
    const refs = varItem.referencePaths;
    if (varItem.kind === 'module') {
      return refs.find((item) => item === path)
    }
  })
  while(scope) {
    if (hasUse(scope)) return true;
    scope = scope.parent;
  }
  return false;
}

function createVirtualModule(ast, importInfos, exportInfos) {
  const exportNodes = exportInfos.map(({ nodes, isDefault }) => {
    const f = (node) => {
      const name = node.name ? node.name : node.id.name;
      return t.objectProperty(
        t.identifier(isDefault ? 'default' : name),
        t.arrowFunctionExpression([], t.identifier(name)),
      );
    }
    return Array.isArray(nodes) ? nodes.map(f) : f(nodes);
  });
  const exportCallExpression = t.callExpression(
    t.identifier('__VIRTUAL_EXPORT__'),
    [t.objectExpression(exportNodes.flat())],
  );
  ast.program.body.unshift(
    exportCallExpression,
    ...importInfos.map(val => val.transfromNode),
  );
}

function transform(code) {
  let moduleId = 0;
  const importInfos = [];
  const exportInfos = [];
  const identifierChanges = [];
  const ast = parse(code, { sourceType: 'module' });
  
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

  // 收集信息
  traverse(ast, {
    ImportDeclaration(path) {
      const node = path.node;
      const data = importInformation(node);
      const transformModuleName = `_m${moduleId++}_`;
      const dynamicMethodNode = t.callExpression(
        t.identifier('__VIRTUAL_IMPORT__'),
        [t.stringLiteral(node.source.value)],
      );
      const varNode = t.variableDeclarator(
        t.identifier(transformModuleName),
        dynamicMethodNode,
      )
      const transfromNode = t.variableDeclaration('const', [varNode]);
      data.transformModuleName = transformModuleName;
      importInfos.push({
        data,
        transfromNode,
        remove: () => path.remove(),
      });
    },

    Identifier(path) {
      const { node, parent } = path;
      if (t.isExportSpecifier(parent)) return;
      const change = () => {
        if (!hasUseEsmVars(path)) return;
        const { i, data } = refModule(node.name) || {};
        if (data) {
          const item = data.imports[i];
          if (item.isNamespace) {
            path.replaceWith(
              t.callExpression(
                t.identifier('__VIRTUAL_NAMESPACE__'),
                [t.identifier(data.transformModuleName)],
              )
            );
          } else {
            const propName = item.isDefault ? 'default' : item.name; 
            const expression = t.memberExpression(
              t.identifier(data.transformModuleName),
              t.identifier(propName),
            );
            path.replaceWith(t.expressionStatement(expression));
          }
        }
      }
      identifierChanges.push(change);
    },

    ExportDeclaration(path) {
      const { node } = path;
      const { declaration } = node;
      if (!declaration) return; // 可能是注释
      exportInfos.push({
        isDefault: t.isExportDefaultDeclaration(node),
        nodes: t.isVariableDeclaration(declaration)
          ? declaration.declarations
          : declaration,
      });
      path.replaceWith(declaration);
    },

    ExportSpecifier(path) {
      console.log(path.node);
    },
  })

  // 删除原生的 esmodule 代码
  identifierChanges.forEach(fn => fn());
  importInfos.forEach(({ remove }) => remove());
  // 生成转换后的代码
  createVirtualModule(ast, importInfos, exportInfos);

  const output = generate(
    ast,
    { filename, sourceFileName: filename},
    { [filename]: code },
  );
  return output.code;
}

// 测试
const filename = './m3.js';
getCode(filename).then(code => {
  const res = transform(code);
  console.log(res);
});
