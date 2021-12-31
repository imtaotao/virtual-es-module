// From `@babel/traverse`
import { base } from 'acorn-walk';
import {
  isVar,
  isScope,
  isProgram,
  isPattern,
  isIdentifier,
  isReferenced,
  isBlockScoped,
  isDeclaration,
  isBlockParent,
  isForXStatement,
  isFunctionParent,
  isLabeledStatement,
  isClassDeclaration,
  isImportDeclaration,
  isExportDeclaration,
  isFunctionExpression,
  isVariableDeclaration,
  isFunctionDeclaration,
} from './types';

// type Kind =
//  | "var" /* var declarator */
//  | "let" /* let declarator, class declaration id, catch clause parameters */
//  | "const" /* const declarator */
//  | "module" /* import specifiers */
//  | "hoisted" /* function declaration id */
//  | "param" /* function declaration parameters */
//  | "local" /* function expression id, class expression id */
//  | "unknown"; /* export specifiers */
class Scope {
  constructor(node, parent, state) {
    this.node = node;
    this.state = state;
    this.parent = parent;
    this.references = {};
    this.labels = new Map();
    this.constantViolations = new Set();
  }

  get isTopLevel() {
    return isProgram(this.node);
  }

  registerLabel(node) {
    this.labels.set(node.label.name, node);
  }

  registerBinding(kind, name, node) {
    if (!kind) throw new ReferenceError('no `kind`');
    const binding = this.references[name];
    if (binding) {
      // 遍历的时候会有重复塞入
      if (binding.node === node) return;
      if (kind !== 'param') {
        throw new Error(`Duplicate declaration "${name}"`);
      }
    } else {
      this.references[name] = { kind, node };
    }
  }

  // @babel/types/src/retrievers/getBindingIdentifiers.ts
  registerDeclaration(node) {
    if (isLabeledStatement(node)) {
      this.registerLabel(node);
    } else if (isFunctionDeclaration(node)) {
      this.registerBinding('hoisted', node.id.name, node);
    } else if (isVariableDeclaration(node)) {
      const declar = node.declarations;
      for (const decl of declar) {
        // node.kind 有 var, let, const
        this.registerBinding(node.kind, decl.id.name, decl);
      }
    } else if (isClassDeclaration(node)) {
      if (node.declare) return;
      this.registerBinding('let', node.id.name, node);
    } else if (isImportDeclaration(node)) {
      const specifiers = node.specifiers;
      for (const specifier of specifiers) {
        this.registerBinding('module', specifier.local.name, specifier);
      }
    } else if (isExportDeclaration(node)) {
      const declar = node.declaration;
      if (
        isClassDeclaration(declar) ||
        isFunctionDeclaration(declar) ||
        isVariableDeclaration(declar)
      ) {
        this.registerDeclaration(declar);
      }
    } else {
      this.registerBinding('unknown', node.exported.name, node);
    }
  }
}

const collectorVisitor = {
  // for (var i = 0; ...) {}
  ForStatement(node, state) {
    const { init } = node;
    if (isVar(init)) {
      const scope = state.scopes.get(node);
      const parent =
        state.getFunctionParent(scope) || state.getProgramParent(scope);
      for (const decl of init.declarations) {
        if (isIdentifier(decl.id)) {
          parent.registerBinding('var', decl.id.name, decl);
        }
      }
    }
  },

  Declaration(node, state) {
    if (isBlockScoped(node)) return;
    if (isImportDeclaration(node)) return;
    if (isExportDeclaration(node)) return;
    const scope = state.scopes.get(node);
    const parent =
      state.getFunctionParent(scope) || state.getProgramParent(scope);
    parent.registerDeclaration(node);
  },

  BlockScoped(node, state) {
    let scope = state.scopes.get(node);
    if (scope.node === node) scope = scope.parent;
    const parent = state.getBlockParent(scope);
    parent.registerDeclaration(node);
  },

  ImportDeclaration(node, state) {
    const scope = state.scopes.get(node);
    const parent = state.getBlockParent(scope);
    parent.registerDeclaration(node);
  },

  ForXStatement(node, state) {
    const scope = state.scopes.get(node);
    const { left } = node;
    if (isPattern(left) || isIdentifier(left)) {
      scope.constantViolations.add(node);
    } else if (isVar(left)) {
      const parentScope =
        state.getFunctionParent(scope) || state.getProgramParent(scope);
      parentScope.registerBinding('var', left, left);
    }
  },

  LabeledStatement(node, state) {
    const scope = state.scopes.get(node);
    const parent = state.getBlockParent(scope);
    parent.registerDeclaration(node);
  },

  UpdateExpression(node, state) {
    const scope = state.scopes.get(node);
    scope.constantViolations.add(node);
  },

  UnaryExpression(node, state) {
    if (node.operator === 'delete') {
      const scope = state.scopes.get(node);
      scope.constantViolations.add(node);
    }
  },

  CatchClause(node, state) {
    const scope = state.scopes.get(node);
    scope.registerBinding('let', node.param.name, node);
  },

  Function(node, state) {
    const { params } = node;
    const scope = state.scopes.get(node);
    for (const param of params) {
      scope.registerBinding('param', param.name, param);
    }
    // Register function expression id after params. When the id
    // collides with a function param, the id effectively can't be
    // referenced: here we registered it as a constantViolation
    if (isFunctionExpression(node) && node.id) {
      scope.registerBinding('local', id.name, node);
    }
  },

  ClassExpression(node, state) {
    const { id } = node;
    const scope = state.scopes.get(node);
    if (id) {
      scope.registerBinding('local', id.name, node);
    }
  },
};

// 虚拟 types
const virtualTypes = {
  Declaration: isDeclaration,
  BlockScoped: isBlockScoped,
  ForXStatement: isForXStatement,
};
const virtualTypesKeys = Object.keys(virtualTypes);

function scopeAncestor(node, visitors, state) {
  const ancestors = [];
  const baseVisitor = base;
  const call = (node, st, override) => {
    const type = override || node.type;
    const found = visitors[type];
    const isNew = node !== ancestors[ancestors.length - 1];
    const isCurrentNode = type === node.type;
    const virtualFnKeys = virtualTypesKeys.filter((k) => virtualTypes[k](node));

    if (isNew) ancestors.push(node);
    if (isCurrentNode) {
      state.ancestors.set(node, [...ancestors]);
      const parentNode = ancestors[ancestors.length - 2];
      let scope = state.scopes.get(parentNode);
      if (isProgram(node) || isScope(node, parentNode)) {
        scope = new Scope(node, scope, state);
      }
      state.scopes.set(node, scope);
    }

    baseVisitor[type](node, st, call);

    if (found) found(node, st || ancestors, ancestors);
    if (isCurrentNode && virtualFnKeys.length > 0) {
      for (const key of virtualFnKeys) {
        const fn = visitors[key];
        if (fn) fn(node, st || ancestors, ancestors);
      }
    }
    if (isNew) ancestors.pop();
  };
  call(node, state);
}

export function createState(ast) {
  const state = {
    scopes: new WeakMap(),
    ancestors: new WeakMap(),

    _getParentScope(scope, condition) {
      do {
        if (condition(scope.node)) {
          return scope;
        }
      } while ((scope = scope.parent));
      return null;
    },

    isReferenced(node, ancestors) {
      const l = ancestors.length;
      const parent = ancestors[l - 2];
      const grandparent = ancestors[l - 3];
      return isReferenced(node, parent, grandparent);
    },

    getFunctionParent(scope) {
      return this._getParentScope(scope, isFunctionParent);
    },

    getProgramParent(scope) {
      scope = this._getParentScope(scope, isProgram);
      if (scope) return scope;
      throw new Error("Couldn't find a Program");
    },

    getBlockParent(scope) {
      scope = this._getParentScope(scope, isBlockParent);
      if (scope) return scope;
      throw new Error(
        "We couldn't find a BlockStatement, For, Switch, Function, Loop or Program...",
      );
    },
  };

  console.log(state);
  scopeAncestor(ast, collectorVisitor, state);
  return state;
}
