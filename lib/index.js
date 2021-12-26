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
    filename: node.source.value,
    isNamespace: Boolean(imports.find((val) => val.isNamespace)),
  };
}

function hasUseEsmVars(path) {
  let scope = path.context.scope;
  const hasUse = (scope) => {
    console.log(scope.bindings, path);
    for (const key of Object.keys(scope.bindings)) {
      const varItem = scope.bindings[key];
      const refs = varItem.referencePaths;
      if (varItem.kind !== 'module') {
        return refs.find((item) => item === path) ? 1 : 0;
      } else if (t.isExportDeclaration(varItem.path.container)) {
        return refs.find((item) => item === path) ? 2 : 0;
      }
    }
  }
  while(scope) {
    const res = hasUse(scope);
    if (res > 0) return res;
    scope = scope.parent;
  }
  return 0;
}

function createExportExpression(declaration, isDefault = false) {
  const name = t.isIdentifier(declaration)
    ? declaration.name
    : declaration.id.name;
  const left = t.memberExpression(
    t.identifier('_export'),
    t.identifier(isDefault ? 'default' : name),
  );
  const right = t.identifier(name);
  return t.assignmentExpression('=', left, right);
}

function transform(code) {
  let moduleId = 0;
  const esmInfos = [];
  const ast = parse(code, { sourceType: 'module' });
  
  const refModule = (refName) => {
    for (const { data } of esmInfos) {
      for (let i = 0; i < data.imports.length; i++) {
        const { name, alias } = data.imports[i];
        if (refName === alias || refName === name) {
          return { i, data };
        }
      }
    }
  }

  traverse(ast, {
    // 转换 import 语法
    ImportDeclaration(path) {
      const node = path.node;
      const data = importInformation(node);
      const transformModuleName = `_m${moduleId++}_`;
      const dynamicMethodNode = t.callExpression(
        t.identifier('_import'),
        [t.stringLiteral(node.source.value)],
      );
      const varNode = t.variableDeclarator(
        t.identifier(transformModuleName),
        dynamicMethodNode,
      )
      const exprNode = t.variableDeclaration('const', [varNode]);
      path.replaceWith(exprNode);
      data.transformModuleName = transformModuleName;
      esmInfos.push({ node, data });
    },

    // 引用替换
    Identifier(path) {
      const { node, parent } = path;
      if (t.isExportSpecifier(parent)) return;
      const useType = hasUseEsmVars(path);
      if (useType === 0) {
        // 不用做事情
      } else if (useType === 1) {
        const { i, data } = refModule(node.name) || {};
        console.log(node, useType);
        const item = data.imports[i];
        if (item.isNamespace) {
          path.replaceWith(t.identifier(data.transformModuleName));
        } else {
          const propName = item.isDefault ? 'default' : item.name; 
          const expression = t.memberExpression(
            t.identifier(data.transformModuleName),
            t.identifier(propName),
          );
          path.replaceWith(t.expressionStatement(expression));
        }
      } else if (useType === 2) {
        console.log(node);
        // const propName = item.isDefault ? 'default' : item.name; 
        // const expression = t.memberExpression(
        //   t.identifier(data.transformModuleName),
        //   t.identifier(propName),
        // );
        // path.replaceWith(t.expressionStatement(expression));
      }
    },

    // 转换 export
    ExportDeclaration(path) {
      const { node } = path;
      const { declaration } = node;
      if (!declaration) return; // 可能是注释
      const isDefault = t.isExportDefaultDeclaration(node);

      if (t.isVariableDeclaration(declaration)) {
        const exportNodes = declaration.declarations.map(varNode => 
          createExportExpression(varNode));
        path.replaceWithMultiple([declaration, ...exportNodes]);
      } else if (t.isClassDeclaration(declaration)) {
        path.replaceWithMultiple([
          declaration,
          createExportExpression(declaration, isDefault),
        ]);
      } else if (t.isIdentifier(declaration)) {
        path.replaceWith(createExportExpression(declaration, isDefault));
      } else {
        console.log(node);
      }
    },

    ExportSpecifier(path) {
      console.log(path.node);
    },
  })

  const output = generate(ast, { filename, sourceFileName: filename}, { [filename]: code });
  console.log(esmInfos);
  console.log(output.code);
  console.log(ast);
}

// 测试
const filename = './m3.js';
getCode(filename).then(transform);