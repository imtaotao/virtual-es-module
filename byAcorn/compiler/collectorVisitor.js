// From `@babel/traverse`
import {
  isVar,
  isPattern,
  isIdentifier,
  isBlockScoped,
  isImportDeclaration,
  isExportDeclaration,
  isFunctionExpression,
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
