// From `@babel/types`
// https://babeljs.io/docs/en/babel-parser
// 过滤掉 ts, jsx 相关的代码判断，并将判断修正为 estree 的规范

function shallowEqual(actual, expected) {
  const keys = Object.keys(expected);
  for (const key of keys) {
    if (actual[key] !== expected[key]) {
      return false;
    }
  }
  return true;
}

export function isIdentifier(node) {
  if (!node) return false;
  return node.type === 'Identifier';
}

export function isVar(node) {
  return isVariableDeclaration(node, { kind: 'var' });
}

export function isLet(node) {
  return isVariableDeclaration(node) && node.kind !== 'var';
}

export function isBlockScoped(node) {
  return isFunctionDeclaration(node) || isClassDeclaration(node) || isLet(node);
}

export function isForXStatement(node) {
  if (!node) return false;
  const nodeType = node.type;
  return 'ForInStatement' === nodeType || 'ForOfStatement' === nodeType;
}

export function isBlockStatement(node) {
  if (!node) return false;
  return node.type === 'BlockStatement';
}

export function isObjectMethod(node) {
  if (!node) return false;
  if (node.type !== 'Property') return false;
  return isFunction(node.value);
}

export function isFunction(node) {
  if (!node) return false;
  const nodeType = node.type;
  if (
    'FunctionDeclaration' === nodeType ||
    'FunctionExpression' === nodeType ||
    'ArrowFunctionExpression' === nodeType ||
    'MethodDefinition' === nodeType ||
    'ClassPrivateMethod' === nodeType // acorn 支持私有属性后，替换为 estree 的类型
  ) {
    return true;
  }
  if (isObjectMethod(node)) return true;
  return false;
}

export function isPattern(node) {
  if (!node) return false;
  const nodeType = node.type;
  if (
    'AssignmentPattern' === nodeType ||
    'ArrayPattern' === nodeType ||
    'ObjectPattern' === nodeType
  ) {
    return true;
  }
  return false;
}

export function isCatchClause(node) {
  if (!node) return false;
  return node.type === 'CatchClause';
}

export function isScopable(node) {
  if (!node) return false;
  const nodeType = node.type;
  if (
    'BlockStatement' === nodeType ||
    'CatchClause' === nodeType ||
    'DoWhileStatement' === nodeType ||
    'ForInStatement' === nodeType ||
    'ForStatement' === nodeType ||
    'FunctionDeclaration' === nodeType ||
    'FunctionExpression' === nodeType ||
    'Program' === nodeType ||
    'SwitchStatement' === nodeType ||
    'WhileStatement' === nodeType ||
    'ArrowFunctionExpression' === nodeType ||
    'ClassExpression' === nodeType ||
    'ClassDeclaration' === nodeType ||
    'ForOfStatement' === nodeType ||
    'MethodDefinition' === nodeType ||
    'ClassPrivateMethod' === nodeType ||
    'StaticBlock' === nodeType ||
    isObjectMethod(node)
  ) {
    return true;
  }
  return false;
}

export function isProgram(node) {
  if (!node) return false;
  return node.type === 'Program';
}

export function isFunctionParent(node) {
  if (!node) return false;
  const nodeType = node.type;
  if (
    'FunctionDeclaration' === nodeType ||
    'FunctionExpression' === nodeType ||
    'ArrowFunctionExpression' === nodeType ||
    'MethodDefinition' === nodeType ||
    'ClassPrivateMethod' === nodeType ||
    'StaticBlock' === nodeType ||
    isObjectMethod(node)
  ) {
    return true;
  }
  return false;
}

export function isScope(node, parent) {
  if (isBlockStatement(node) && (isFunction(parent) || isCatchClause(parent))) {
    return false;
  }
  if (isPattern(node) && (isFunction(parent) || isCatchClause(parent))) {
    return true;
  }
  return isScopable(node);
}

export function isFunctionDeclaration(node) {
  if (!node) return false;
  return node.type === 'FunctionDeclaration';
}

export function isVariableDeclaration(node, opts) {
  if (!node) return false;
  const nodeType = node.type;
  if (nodeType === 'VariableDeclaration') {
    if (typeof opts === 'undefined') {
      return true;
    } else {
      return shallowEqual(node, opts);
    }
  }
  return false;
}

export function isClassDeclaration(node) {
  if (!node) return false;
  return node.type === 'ClassDeclaration';
}

export function isExportDeclaration(node) {
  if (!node) return false;
  const nodeType = node.type;
  if (
    'ExportAllDeclaration' === nodeType ||
    'ExportDefaultDeclaration' === nodeType ||
    'ExportNamedDeclaration' === nodeType
  ) {
    return true;
  }
  return false;
}

export function isImportDeclaration(node) {
  if (!node) return false;
  return node.type === 'ImportDeclaration';
}

export function isDeclaration(node) {
  if (!node) return false;
  const nodeType = node.type;
  if (
    'FunctionDeclaration' === nodeType ||
    'VariableDeclaration' === nodeType ||
    'ClassDeclaration' === nodeType ||
    'ExportAllDeclaration' === nodeType ||
    'ExportDefaultDeclaration' === nodeType ||
    'ExportNamedDeclaration' === nodeType ||
    'ImportDeclaration' === nodeType
  ) {
    return true;
  }
  return false;
}

export function isReferenced(node, parent, grandparent) {
  switch (parent.type) {
    // yes: PARENT[NODE]
    // yes: NODE.child
    // no: parent.NODE
    case 'MemberExpression':
    case 'OptionalMemberExpression':
      if (parent.property === node) {
        return !!parent.computed;
      }
      return parent.object === node;

    // no: let NODE = init;
    // yes: let id = NODE;
    case 'VariableDeclarator':
      return parent.init === node;

    // yes: () => NODE
    // no: (NODE) => {}
    case 'ArrowFunctionExpression':
      return parent.body === node;

    // no: class { #NODE; }
    // no: class { get #NODE() {} }
    // no: class { #NODE() {} }
    // no: class { fn() { return this.#NODE; } }
    case 'PrivateName':
      return false;

    // method:
    //  no: class { NODE() {} }
    //  yes: class { [NODE]() {} }
    //  no: class { foo(NODE) {} }
    // property
    //  yes: { [NODE]: "" }
    //  no: { NODE: "" }
    //  depends: { NODE }
    //  depends: { key: NODE }
    case 'MethodDefinition': // ClassMethod
    case 'ClassPrivateMethod':
    case 'Property':
      if (parent.key === node) {
        return !!parent.computed;
      }
      if (isObjectMethod(node)) {
        return false;
      } else {
        // parent.value === node
        return !grandparent || grandparent.type !== 'ObjectPattern';
      }

    // no: class { NODE = value; }
    // yes: class { [NODE] = value; }
    // yes: class { key = NODE; }
    // case 'ClassProperty':
    case 'PropertyDefinition': // acorn 暂时还不支持
      if (parent.key === node) {
        return !!parent.computed;
      }
      return true;
    case 'ClassPrivateProperty':
      return parent.key !== node;

    // no: class NODE {}
    // yes: class Foo extends NODE {}
    case 'ClassDeclaration':
    case 'ClassExpression':
      return parent.superClass === node;

    // yes: left = NODE;
    // no: NODE = right;
    case 'AssignmentExpression':
      return parent.right === node;

    // no: [NODE = foo] = [];
    // yes: [foo = NODE] = [];
    case 'AssignmentPattern':
      return parent.right === node;

    // no: NODE: for (;;) {}
    case 'LabeledStatement':
      return false;

    // no: try {} catch (NODE) {}
    case 'CatchClause':
      return false;

    // no: function foo(...NODE) {}
    case 'RestElement':
      return false;

    case 'BreakStatement':
    case 'ContinueStatement':
      return false;

    // no: function NODE() {}
    // no: function foo(NODE) {}
    case 'FunctionDeclaration':
    case 'FunctionExpression':
      return false;

    // no: export NODE from "foo";
    // no: export * as NODE from "foo";
    case 'ExportAllDeclaration':
      return false;

    // no: export { foo as NODE };
    // yes: export { NODE as foo };
    // no: export { NODE as foo } from "foo";
    case 'ExportSpecifier':
      if (grandparent?.source) {
        return false;
      }
      return parent.local === node;

    // no: import NODE from "foo";
    // no: import * as NODE from "foo";
    // no: import { NODE as foo } from "foo";
    // no: import { foo as NODE } from "foo";
    // no: import NODE from "bar";
    case 'ImportDefaultSpecifier':
    case 'ImportNamespaceSpecifier':
    case 'ImportSpecifier':
      return false;

    // no: import "foo" assert { NODE: "json" }
    case 'ImportAttribute':
      return false;

    // no: [NODE] = [];
    // no: ({ NODE }) = [];
    case 'ObjectPattern':
    case 'ArrayPattern':
      return false;

    // no: new.NODE
    // no: NODE.target
    case 'MetaProperty':
      return false;
  }
  return true;
}
