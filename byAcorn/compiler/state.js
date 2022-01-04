// Inspired by `@babel/traverse`
import { base } from 'acorn-walk';
import { Scope } from './scope';
import { collectorVisitor } from './collectorVisitor';
import {
  isScope,
  isProgram,
  isBlockScoped,
  isDeclaration,
  isBlockParent,
  isForXStatement,
  isFunctionParent,
  isExportDeclaration,
  isVariableDeclaration,
} from './types';

const virtualTypes = {
  Declaration: isDeclaration,
  BlockScoped: isBlockScoped,
  ForXStatement: isForXStatement,
  ExportDeclaration: isExportDeclaration,
};
const virtualTypesKeys = Object.keys(virtualTypes);

function walk(node, visitors, state) {
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

function getParentScope(scope, condition) {
  do {
    if (condition(scope.node)) {
      return scope;
    }
  } while ((scope = scope.parent));
  return null;
}

export function createState(ast) {
  const state = {
    scopes: new WeakMap(),
    ancestors: new WeakMap(),
    defer: {
      references: new Set(),
      assignments: new Set(),
      constantViolations: new Set(),
    },

    getFunctionParent(scope) {
      return getParentScope(scope, isFunctionParent);
    },

    getProgramParent(scope) {
      scope = getParentScope(scope, isProgram);
      if (scope) return scope;
      throw new Error("Couldn't find a Program");
    },

    getBlockParent(scope) {
      scope = getParentScope(scope, isBlockParent);
      if (scope) return scope;
      throw new Error(
        "We couldn't find a BlockStatement, For, Switch, Function, Loop or Program...",
      );
    },

    remove(node, ancestors) {
      this.replaceWith(node, null, ancestors);
    },

    replaceWith(node, replacement, ancestors) {
      if (node === replacement) return;
      const parent = ancestors[ancestors.length - 2];
      const set = (obj, key) => {
        const scope = this.scopes.get(node);
        obj[key] = replacement;
        this.scopes.set(replacement, scope);
        this.ancestors.set(replacement, ancestors);
      };

      if (isVariableDeclaration(node)) {
        const { declarations } = node;
        const idx = declarations.indexOf(node);
        if (idx > -1) set(declarations, key);
      } else {
        for (const key in parent) {
          if (parent[key] === node) {
            set(parent, key);
          }
        }
      }
    },
  };

  walk(ast, collectorVisitor, state);

  const programParent = state.getProgramParent(state.scopes.get(ast));

  state.defer.assignments.forEach((fn) => {
    const { name, node } = fn();
    const scope = state.scopes.get(node);
    if (!scope.getBinding(name)) {
      programParent.addGlobal(node);
    }
    scope.registerConstantViolation(name, node);
  });

  state.defer.references.forEach((fn) => {
    const { type, node } = fn();
    const scope = state.scopes.get(node);
    const binding = scope.getBinding(node.name);
    if (binding) {
      binding.references.add(node);
    } else if (type !== 'export') {
      programParent.addGlobal(node);
    }
  });

  state.defer.constantViolations.forEach((fn) => {
    const { name, node } = fn();
    const scope = state.scopes.get(node);
    scope.registerConstantViolation(name, node);
  });

  delete state.defer;
  return state;
}
