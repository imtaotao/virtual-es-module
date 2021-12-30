import { base } from 'acorn-walk';
import {
  isVar,
  isIdentifier,
  isProgram,
  isScope,
  isReferenced,
  isFunctionParent,
} from './types';

class Scope {
  constructor(node) {
    this.node = node;
    this.references = {};
    this.constantViolations = {};
  }

  addReference(kind, name, node) {
    if (this.references[name]) {
      if (kind !== 'param') {
        throw new Error(`Duplicate declaration "${name}"`);
      }
    } else {
      this.references[name] = { kind, node };
    }
  }
}

const collectorVisitor = {
  // for (var i = 0; ...) {}
  ForStatement(node, state, ancestors) {
    const { init } = node;
    if (isVar(init)) {
      const scope =
        state.getFunctionParent(ancestors) || state.getProgramParent(ancestors);
      for (const declar of init.declarations) {
        if (isIdentifier(declar.id)) {
          scope.addReference('var', declar.id.name, declar);
        }
      }
    }
  },

  Declaration(node, state, ancestors) {},

  ImportDeclaration(node, state, ancestors) {},

  ForXStatement(node, state, ancestors) {},

  LabeledStatement(node, state, ancestors) {},

  AssignmentExpression(node, state, ancestors) {},

  UpdateExpression(node, state, ancestors) {},

  UnaryExpression(node, state, ancestors) {},

  BlockScoped(node, state, ancestors) {},

  CatchClause(node, state, ancestors) {},

  Function(node, state, ancestors) {},

  ClassExpression(node, state, ancestors) {},
};

function scopeAncestor(node, visitors, state) {
  const ancestors = [];
  const baseVisitor = base;
  function c(node, st, override) {
    const type = override || node.type;
    const found = visitors[type];
    const isNew = node !== ancestors[ancestors.length - 1];
    if (isNew) ancestors.push(node);
    if (type === node.type) {
      if (isProgram(node) || isScope(node)) {
        if (!state.scopes.has(node)) {
          state.scopes.set(node, new Scope(node));
        }
      }
    }
    baseVisitor[type](node, st, c);
    if (found) found(node, st || ancestors, ancestors);
    if (isNew) ancestors.pop();
  }
  c(node, state);
}

export function createState(ast) {
  const state = {
    scopes: new WeakMap(),

    getScope(ancestors) {
      let i = ancestors.length;
      while (~--i) {
        const node = ancestors[i];
        if (this.scopes.has(node)) {
          return this.scopes.get(node);
        }
      }
    },

    getFunctionParent(ancestors) {
      let i = ancestors.length;
      while (~--i) {
        const node = ancestors[i];
        if (this.scopes.has(node)) {
          if (isFunctionParent(node)) {
            return this.scopes.get(node);
          }
        }
      }
    },

    getProgramParent(ancestors) {
      let i = ancestors.length;
      while (~--i) {
        const node = ancestors[i];
        if (this.scopes.has(node)) {
          if (isProgram(node)) {
            return this.scopes.get(node);
          }
        }
      }
    },

    isReferenced(node, ancestors) {
      const l = ancestors.length;
      const parent = ancestors[l - 2];
      const grandparent = ancestors[l - 3];
      return isReferenced(node, parent, grandparent);
    },
  };

  scopeAncestor(ast, collectorVisitor, state);
  return state;
}
