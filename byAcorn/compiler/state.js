// Inspired by `@babel/traverse`
import { base } from 'acorn-walk';
import { Scope } from './scope';
import { collectorVisitor } from './collectorVisitor';
import {
  isScope,
  isProgram,
  isIdentifier,
  isReferenced,
  isBlockScoped,
  isDeclaration,
  isBlockParent,
  isRestElement,
  isArrayPattern,
  isObjectPattern,
  isAssignmentPattern,
  isForXStatement,
  isFunctionParent,
  isExportDeclaration,
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

export function getBindingIdentifiers(node) {
  const f = (node) => {
    if (isIdentifier(node)) {
      return [node];
    } else if (isArrayPattern(node)) {
      return node.elements.map((el) => f(el)).flat();
    } else if (isObjectPattern(node)) {
      return node.properties.map((p) => f(p.value)).flat();
    } else if (isAssignmentPattern(node)) {
      return f(node.left);
    } else if (isRestElement(node)) {
      return f(node.argument);
    } else {
      return [];
    }
  };
  return f(node);
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

    getBindingIdentifiers,

    getScopeByAncestors(ancestors) {
      let l = ancestors.length;
      while (~--l) {
        const scope = this.scopes.get(ancestors[l]);
        if (scope) return scope;
      }
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

    isReferenced(ancestors) {
      const l = ancestors.length;
      return isReferenced(ancestors[l - 1], ancestors[l - 2], ancestors[l - 3]);
    },

    remove(ancestors) {
      this.replaceWith(null, ancestors);
    },

    replaceWith(replacement, ancestors) {
      const l = ancestors.length;
      const node = ancestors[l - 1];
      if (node === replacement) return;
      const parent = ancestors[l - 2];

      const set = (obj, key) => {
        const scope = this.scopes.get(node);
        if (replacement === null) {
          // 删除后会影响遍历的顺序
          Array.isArray(obj) ? obj.splice(key, 1) : delete obj[key];
        } else {
          obj[key] = replacement;
          this.scopes.set(replacement, scope);
          this.ancestors.set(replacement, ancestors);
        }
      };

      for (const key in parent) {
        const children = parent[key];
        if (Array.isArray(children)) {
          const idx = children.indexOf(node);
          if (idx > -1) set(children, idx);
        } else {
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
    const { ids, scope } = fn();
    for (const node of ids) {
      if (!scope.getBinding(node.name)) {
        programParent.addGlobal(node);
      }
      scope.registerConstantViolation(node.name, node);
    }
  });

  state.defer.references.forEach((fn) => {
    const { ids, type, scope } = fn();
    for (const node of ids) {
      const binding = scope.getBinding(node.name);
      if (binding) {
        binding.references.add(node);
      } else if (type === 'identifier') {
        programParent.addGlobal(node);
      }
    }
  });

  state.defer.constantViolations.forEach((fn) => {
    const { node, scope } = fn();
    scope.registerConstantViolation(node.name, node);
  });

  delete state.defer;
  return state;
}
