// Inspired by `@babel/traverse`
import {
  isProgram,
  isPattern,
  isFunction,
  isLabeledStatement,
  isClassDeclaration,
  isImportDeclaration,
  isExportDeclaration,
  isVariableDeclaration,
  isFunctionDeclaration,
  isArrowFunctionExpression,
} from './types';
import { getBindingIdentifiers } from './state';

// type Kind =
//  | "var" /* var declarator */
//  | "let" /* let declarator, class declaration id, catch clause parameters */
//  | "const" /* const declarator */
//  | "module" /* import specifiers */
//  | "hoisted" /* function declaration id */
//  | "param" /* function declaration parameters */
//  | "local" /* function expression id, class expression id */
//  | "unknown"; /* export specifiers */
export class Scope {
  constructor(node, parent, state) {
    this.node = node;
    this.state = state;
    this.parent = parent;
    this.globals = {};
    this.bindings = {};
    this.labels = new Map();
  }

  get isTopLevel() {
    return isProgram(this.node);
  }

  registerLabel(node) {
    this.labels.set(node.label.name, node);
  }

  addGlobal(node, name) {
    this.globals[name || node.name] = node;
  }

  reference(name, node) {
    const binding = this.getBinding(name);
    if (binding) {
      binding.references.add(node);
    }
  }

  registerConstantViolation(name, node) {
    const binding = this.getBinding(name);
    if (binding) {
      binding.constantViolations.add(node);
    }
  }

  getBinding(name) {
    let scope = this;
    let previousNode;

    do {
      const binding = scope.bindings[name];
      if (binding) {
        // 函数自身的声明和参数不能被
        if (
          isPattern(previousNode) &&
          binding.kind !== 'param' &&
          binding.kind !== 'local'
        ) {
          // do nothing
        } else {
          return binding;
        }
      } else if (
        !binding &&
        name === 'arguments' &&
        isFunction(scope.node) &&
        isArrowFunctionExpression(scope.node)
      ) {
        break;
      }
      previousNode = scope.node;
    } while ((scope = scope.parent));
  }

  checkBlockScopedCollisions(local, kind, name) {
    if (kind === 'param') return;
    // 函数自己的声明规范中是一个独立的作用域，可以被覆盖
    if (local.kind === 'local') return;
    if (
      kind === 'let' ||
      local.kind === 'let' ||
      local.kind === 'const' ||
      local.kind === 'module' ||
      // don't allow a local of param with a kind of let
      (local.kind === 'param' && (kind === 'let' || kind === 'const'))
    ) {
      throw new Error(`Duplicate declaration "${name}"`);
    }
  }

  registerBinding(kind, name, node) {
    if (!kind) throw new ReferenceError('no `kind`');
    const binding = this.bindings[name];

    if (binding) {
      // 遍历的时候会有重复塞入
      if (binding.node === node) return;
      // 检查作用域的碰撞
      this.checkBlockScopedCollisions(binding, kind, name);
      // 如果顺利通过，则代表被更改了，重复的声明也是更改
      this.registerConstantViolation(name, node);
    } else {
      this.bindings[name] = {
        kind,
        node,
        references: new Set(),
        constantViolations: new Set(),
      };
    }
  }

  // @babel/types/src/retrievers/getBindingIdentifiers.ts
  registerDeclaration(node) {
    if (isLabeledStatement(node)) {
      this.registerLabel(node);
    } else if (isFunctionDeclaration(node)) {
      this.registerBinding('hoisted', node.id.name, node);
    } else if (isVariableDeclaration(node)) {
      const { declarations } = node;
      for (const decl of declarations) {
        // node.kind 有 var, let, const
        const ids = getBindingIdentifiers(decl.id);
        for (const name of ids) {
          this.registerBinding(node.kind, name, decl);
        }
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
      const { declaration } = node;
      if (
        isClassDeclaration(declaration) ||
        isFunctionDeclaration(declaration) ||
        isVariableDeclaration(declaration)
      ) {
        this.registerDeclaration(declaration);
      }
    } else {
      this.registerBinding('unknown', node.exported.name, node);
    }
  }
}
