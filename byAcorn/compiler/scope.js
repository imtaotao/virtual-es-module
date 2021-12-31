// From `@babel/traverse`
import {
  isProgram,
  isLabeledStatement,
  isClassDeclaration,
  isImportDeclaration,
  isExportDeclaration,
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
export class Scope {
  constructor(node, parent, state) {
    this.node = node;
    this.state = state;
    this.parent = parent;
    this.bindings = {};
    this.labels = new Map();
    this.constantViolations = new Set();
  }

  get isTopLevel() {
    return isProgram(this.node);
  }

  registerLabel(node) {
    this.labels.set(node.label.name, node);
  }

  setRef(name, node) {
    this.bindings[name].references.add(node);
  }

  setViolation(name, node) {
    this.bindings[name].constantViolations.add(node);
  }

  getBinding(name) {
    return this.bindings[name];
  }

  registerBinding(kind, name, node) {
    if (!kind) throw new ReferenceError('no `kind`');
    const binding = this.bindings[name];
    if (binding) {
      // 遍历的时候会有重复塞入
      if (binding.node === node) return;
      if (kind !== 'param') {
        throw new Error(`Duplicate declaration "${name}"`);
      }
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
