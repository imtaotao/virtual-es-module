// Inspired by `@babel/traverse`
import {
  isVar,
  isPattern,
  isIdentifier,
  isReferenced,
  isBlockScoped,
  isClassDeclaration,
  isImportDeclaration,
  isExportDeclaration,
  isFunctionDeclaration,
  isExportAllDeclaration,
  isFunctionExpression,
  isVariableDeclaration,
} from './types';

export const collectorVisitor = {
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

  Identifier(node, state, ancestors) {
    const l = ancestors.length;
    const parent = ancestors[l - 2];
    const grandparent = ancestors[l - 3];
    if (isReferenced(node, parent, grandparent)) {
      state.defer.references.add(() => {
        return { node, type: 'identifier' };
      });
    }
  },

  ForXStatement(node, state) {
    const scope = state.scopes.get(node);
    const { left } = node;
    if (isPattern(left) || isIdentifier(left)) {
      scope.registerConstantViolation(left.name, node);
    } else if (isVar(left)) {
      const parentScope =
        state.getFunctionParent(scope) || state.getProgramParent(scope);
      parentScope.registerBinding('var', left, left);
    }
  },

  ExportDeclaration(node, state) {
    if (isExportAllDeclaration(node)) return;
    const { declarations } = node;
    if (
      isClassDeclaration(declarations) ||
      isFunctionDeclaration(declarations)
    ) {
      const { id } = declarations;
      if (!id) return;
      state.defer.references.add(() => {
        return { node: id, type: 'export' };
      });
    } else if (isVariableDeclaration(declarations)) {
      for (const decl of declarations) {
        state.defer.references.add(() => {
          return { node: decl.id, type: 'export' };
        });
      }
    }
  },

  LabeledStatement(node, state) {
    const scope = state.scopes.get(node);
    const parent = state.getBlockParent(scope);
    parent.registerDeclaration(node);
  },

  AssignmentExpression(node, state) {
    state.defer.assignments.add(() => {
      return { node, name: node.left.name };
    });
  },

  UpdateExpression(node, state) {
    state.defer.constantViolations.add(() => {
      return { node, name: node.argument.name };
    });
  },

  UnaryExpression(node, state) {
    if (node.operator === 'delete') {
      state.defer.constantViolations.add(() => {
        return { node, name: node.argument.name };
      });
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
