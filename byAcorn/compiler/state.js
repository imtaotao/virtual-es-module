// From `@babel/traverse`
import { base } from 'acorn-walk';
import { Scope } from './scope';
import { collectorVisitor } from './collectorVisitor';
import {
  isScope,
  isProgram,
  isReferenced,
  isBlockScoped,
  isDeclaration,
  isBlockParent,
  isForXStatement,
  isFunctionParent,
} from './types';

// 虚拟 types
const virtualTypes = {
  Declaration: isDeclaration,
  BlockScoped: isBlockScoped,
  ForXStatement: isForXStatement,
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
    if (condition(scope.node)) return scope;
  } while ((scope = scope.parent));
  return null;
}

export function createState(ast) {
  const state = {
    scopes: new WeakMap(),
    ancestors: new WeakMap(),

    isReferenced(node, ancestors) {
      const l = ancestors.length;
      const parent = ancestors[l - 2];
      const grandparent = ancestors[l - 3];
      return isReferenced(node, parent, grandparent);
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
  };

  console.log(state);
  walk(ast, collectorVisitor, state);
  return state;
}
