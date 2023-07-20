import { ancestor } from 'acorn-walk';
import { generate } from 'escodegen';
import { Parser, Node as AcornNode } from 'acorn';
import { transformUrl, haveSourcemap } from '../utils';
import type {
  Node,
  Program,
  Identifier,
  Expression,
  MetaProperty,
  CallExpression,
  MemberExpression,
  VariableDeclaration,
  ExportDefaultDeclaration,
  ImportSpecifier,
  ImportExpression,
  ImportDeclaration,
  ExportAllDeclaration,
  ExportNamedDeclaration,
} from 'estree';
import {
  isIdentifier,
  isVariableDeclaration,
  isExportSpecifier,
  isExportAllDeclaration,
  isExportDefaultDeclaration,
  isImportDefaultSpecifier,
  isImportNamespaceSpecifier,
} from './types';
import {
  literal,
  identifier,
  callExpression,
  objectProperty,
  objectExpression,
  memberExpression,
  arrowFunctionExpression,
  variableDeclarator,
  variableDeclaration,
} from './generated';
import type { Scope } from './scope';
import { mergeSourcemap } from './mergeMap';
import { State, createState } from './state';
import { Runtime, ModuleResource } from '../runtime';

type ImportInfoData = (
  | ReturnType<Compiler['getImportInformation']>
  | ReturnType<Compiler['getImportInformationBySource']>
) & {
  moduleName: string;
};

type ImportTransformNode = ReturnType<Compiler['generateImportTransformNode']>;

interface CompilerOptions {
  code: string;
  storeId: string;
  filename: string;
  runtime: Runtime;
}

export interface Output {
  map: string;
  code: string;
}

export class Compiler {
  static keys = {
    __VIRTUAL_IMPORT__: '__VIRTUAL_IMPORT__',
    __VIRTUAL_EXPORT__: '__VIRTUAL_EXPORT__',
    __VIRTUAL_DEFAULT__: '__VIRTUAL_DEFAULT__',
    __VIRTUAL_WRAPPER__: '__VIRTUAL_WRAPPER__',
    __VIRTUAL_NAMESPACE__: '__VIRTUAL_NAMESPACE__',
    __VIRTUAL_IMPORT_META__: '__VIRTUAL_IMPORT_META__',
    __VIRTUAL_DYNAMIC_IMPORT__: '__VIRTUAL_DYNAMIC_IMPORT__',
  };

  private ast: Program;
  private state: ReturnType<typeof createState>;

  private moduleCount = 0;
  private consumed = false;
  private importInfos: Array<{
    data: ImportInfoData;
    transformNode: ImportTransformNode;
  }> = [];
  private exportInfos: Array<{
    name: string;
    refNode: Identifier | CallExpression | MemberExpression;
  }> = [];
  private deferQueue = {
    removes: new Set<() => void>(),
    replaces: new Set<() => void>(),
    importChecks: new Set<() => void>(),
    identifierRefs: new Set<() => void>(),
    exportNamespaces: new Set<{
      moduleId: string;
      namespace: string | undefined;
      fn: (names: Array<string>) => void;
    }>(),
  };

  public options: CompilerOptions;
  public sourcemapComment: string;

  constructor(options: CompilerOptions) {
    this.options = options;
    this.ast = this.parse();
    this.state = createState(this.ast);
  }

  private parse() {
    const parser = new Parser(
      {
        locations: true,
        sourceType: 'module',
        ecmaVersion: 'latest',
        sourceFile: this.options.filename,
        onComment: (isBlock, text) => this.onParseComment(isBlock, text),
      },
      this.options.code,
    );
    try {
      return parser.parse() as unknown as Program;
    } catch (e) {
      e.message += `(${this.options.filename})`;
      throw e;
    }
  }

  private onParseComment(isBlock: boolean, text: string) {
    if (haveSourcemap(text)) {
      this.sourcemapComment = text;
    }
  }

  private checkImportNames(
    imports: ImportInfoData['imports'],
    moduleId: string,
  ) {
    const exports = this.getChildModuleExports(moduleId);
    if (exports) {
      imports.forEach((item) => {
        if (item.isNamespace) return;
        const checkName = item.isDefault ? 'default' : item.name;
        if (!exports.includes(checkName)) {
          throw SyntaxError(
            `(${this.options.filename}): The module '${moduleId}' does not provide an export named '${checkName}'`,
          );
        }
      });
    }
  }

  private getChildModuleExports(moduleId: string) {
    const storeId = transformUrl(this.options.storeId, moduleId);
    const output = (this.options.runtime as any).resources[
      storeId
    ] as ModuleResource;
    return output ? output.exports : null;
  }

  private getImportInformation(node: ImportDeclaration) {
    const imports = node.specifiers.map((n) => {
      const isDefault = isImportDefaultSpecifier(n);
      const isNamespace = isImportNamespaceSpecifier(n);
      const isSpecial = isDefault || isNamespace;
      const alias = isSpecial ? null : n.local.name;
      const name = isSpecial
        ? n.local.name
        : (n as ImportSpecifier).imported.name;
      return {
        name,
        isDefault,
        isNamespace,
        alias: alias === name ? null : alias,
      };
    });

    return {
      imports,
      isExport: false,
      moduleId: node.source.value as string,
    };
  }

  private getImportInformationBySource(
    node: ExportNamedDeclaration | ExportAllDeclaration,
  ) {
    const imports = ((node as ExportNamedDeclaration).specifiers || []).map(
      (n) => {
        const alias = n.exported.name;
        const name = n.local.name;
        return {
          name,
          alias: alias === name ? null : alias,
        };
      },
    );

    return {
      imports,
      isExport: true,
      moduleId: node.source.value as string,
    };
  }

  private generateImportTransformNode(moduleName: string, moduleId: string) {
    const varName = identifier(moduleName);
    const varExpr = callExpression(
      identifier(Compiler.keys.__VIRTUAL_IMPORT__),
      [literal(moduleId)],
    );
    const varNode = variableDeclarator(varName, varExpr);
    return variableDeclaration('const', [varNode]);
  }

  private generateIdentifierTransformNode(
    nameOrInfo: string | ReturnType<Compiler['findIndexInData']>,
  ) {
    let info;
    if (typeof nameOrInfo === 'string') {
      for (const { data } of this.importInfos) {
        if (!data.isExport) {
          const result = this.findIndexInData(nameOrInfo, data);
          if (result) {
            info = result;
            break;
          }
        }
      }
    } else {
      info = nameOrInfo;
    }

    if (info && info.data) {
      const { i, data } = info;
      const item = data.imports[i];
      if (item.isNamespace) {
        return callExpression(identifier(Compiler.keys.__VIRTUAL_NAMESPACE__), [
          identifier(data.moduleName),
        ]);
      } else {
        const propName = item.isDefault ? 'default' : item.name;
        return memberExpression(
          identifier(data.moduleName),
          identifier(propName),
        );
      }
    }
  }

  private generateVirtualModuleSystem() {
    const exportNodes = this.exportInfos.map(({ name, refNode }) => {
      return objectProperty(
        identifier(name),
        arrowFunctionExpression([], refNode),
      );
    });
    const exportCallExpression = callExpression(
      identifier(Compiler.keys.__VIRTUAL_EXPORT__),
      [objectExpression(exportNodes)],
    );
    this.ast.body.unshift(
      exportCallExpression as any,
      ...new Set(this.importInfos.map((val) => val.transformNode)),
    );
  }

  private findIndexInData(refName: string, data: ImportInfoData) {
    for (let i = 0; i < data.imports.length; i++) {
      const { name, alias } = data.imports[i];
      if (refName === alias || refName === name) {
        return { i, data };
      }
    }
  }

  private findImportInfo(moduleId: string): [string?, VariableDeclaration?] {
    for (const { data, transformNode } of this.importInfos) {
      if (data.moduleId === moduleId) {
        return [data.moduleName, transformNode];
      }
    }
    return [];
  }

  private isReferencedModuleVariable(scope: Scope, node: Identifier) {
    const u = () =>
      Object.keys(scope.bindings).some((key) => {
        const { kind, references, constantViolations } = scope.bindings[key];
        if (kind === 'module') {
          return references.has(node) || constantViolations.has(node);
        }
      });
    while (scope) {
      if (u()) return true;
      scope = scope.parent;
    }
    return false;
  }

  // 1. export { a as default };
  // 2. export { default as x } from 'module';
  private processExportSpecifiers(
    node: ExportNamedDeclaration,
    state: State,
    ancestors: Array<Node>,
  ) {
    if (node.source) {
      const moduleId = node.source.value as string;
      const data = this.getImportInformationBySource(node);
      let [moduleName, transformNode] = this.findImportInfo(moduleId);

      if (!moduleName) {
        moduleName = `__m${this.moduleCount++}__`;
        transformNode = this.generateImportTransformNode(moduleName, moduleId);
      }

      (data as ImportInfoData).moduleName = moduleName;
      this.importInfos.push({ data: data as ImportInfoData, transformNode });
      this.deferQueue.importChecks.add(() =>
        this.checkImportNames(data.imports, moduleId),
      );

      node.specifiers.forEach((n) => {
        const useInfo = this.findIndexInData(
          n.local.name,
          data as ImportInfoData,
        );
        const refNode = this.generateIdentifierTransformNode(useInfo);
        this.exportInfos.push({ refNode, name: n.exported.name });
      });
    } else {
      const scope = state.getScopeByAncestors(ancestors);
      node.specifiers.forEach((n) => {
        const refNode = this.isReferencedModuleVariable(scope, n.local)
          ? this.generateIdentifierTransformNode(n.local.name)
          : identifier(n.local.name);
        this.exportInfos.push({ refNode, name: n.exported.name });
      });
    }
    this.deferQueue.removes.add(() => state.remove(ancestors));
  }

  // 1. export default 1;
  // 2. export const a = 1;
  private processExportNamedDeclaration(
    node: ExportNamedDeclaration | ExportDefaultDeclaration,
    state: State,
    ancestors: Array<Node>,
  ) {
    const isDefault = isExportDefaultDeclaration(node);
    const nodes = isVariableDeclaration(node.declaration)
      ? node.declaration.declarations
      : [node.declaration];

    nodes.forEach((node) => {
      if (isDefault) {
        const name = 'default';
        const refNode = identifier(Compiler.keys.__VIRTUAL_DEFAULT__);
        this.exportInfos.push({ name, refNode });
      } else {
        const names = state.getBindingIdentifiers(node.id);
        names.forEach(({ name }) => {
          this.exportInfos.push({ name, refNode: identifier(name) });
        });
      }
    });

    if (isDefault) {
      this.deferQueue.replaces.add(() => {
        // 此时 declaration 可能已经被替换过了
        const varName = identifier(Compiler.keys.__VIRTUAL_DEFAULT__);
        const varNode = variableDeclarator(
          varName,
          node.declaration as Expression,
        );
        state.replaceWith(variableDeclaration('const', [varNode]), ancestors);
      });
    } else if (isIdentifier(node.declaration)) {
      this.deferQueue.removes.add(() => state.remove(ancestors));
    } else {
      this.deferQueue.replaces.add(() => {
        state.replaceWith(node.declaration, ancestors);
      });
    }
  }

  // 1. export * from 'module';
  // 2. export * as x from 'module';
  private processExportAllDeclaration(
    node: ExportAllDeclaration,
    state: State,
    ancestors: Array<Node>,
  ) {
    const namespace = node.exported?.name;
    const moduleId = node.source.value as string;
    const data = this.getImportInformationBySource(node);
    let [moduleName, transformNode] = this.findImportInfo(moduleId);

    if (!moduleName) {
      moduleName = `__m${this.moduleCount++}__`;
      transformNode = this.generateImportTransformNode(moduleName, moduleId);
    }

    (data as ImportInfoData).moduleName = moduleName;
    this.importInfos.push({ data: data as ImportInfoData, transformNode });

    this.deferQueue.removes.add(() => state.remove(ancestors));
    this.deferQueue.exportNamespaces.add({
      moduleId,
      namespace,
      fn: (names) => {
        names.forEach((name) => {
          let refNode;
          if (name === namespace) {
            refNode = callExpression(
              identifier(Compiler.keys.__VIRTUAL_NAMESPACE__),
              [identifier(moduleName)],
            );
          } else {
            refNode = memberExpression(
              identifier(moduleName),
              identifier(name),
            );
          }
          this.exportInfos.push({ refNode, name });
        });
      },
    });
  }

  // 处理所有的 export
  private exportDeclarationVisitor(
    node: any,
    state: State,
    ancestors: Array<Node>,
  ) {
    if (node.declaration) {
      this.processExportNamedDeclaration(node, state, [...ancestors]);
    } else if (node.specifiers) {
      this.processExportSpecifiers(node, state, [...ancestors]);
    } else if (isExportAllDeclaration(node)) {
      this.processExportAllDeclaration(node, state, [...ancestors]);
    }
  }

  // 处理所有用到 esm 的引用
  private identifierVisitor(
    node: Identifier,
    state: State,
    ancestors: Array<Node>,
  ) {
    const parent = ancestors[ancestors.length - 2];
    if (isExportSpecifier(parent)) return;
    const scope = state.getScopeByAncestors(ancestors);

    if (this.isReferencedModuleVariable(scope, node)) {
      ancestors = [...ancestors];
      this.deferQueue.identifierRefs.add(() => {
        const replacement = this.generateIdentifierTransformNode(node.name);
        if (replacement) {
          state.replaceWith(replacement, ancestors);
        }
      });
    }
  }

  // Static import expression
  private importDeclarationVisitor(
    node: ImportDeclaration,
    state: State,
    ancestors: Array<Node>,
  ) {
    ancestors = [...ancestors];
    const moduleId = node.source.value as string;
    const data = this.getImportInformation(node);
    let [moduleName, transformNode] = this.findImportInfo(moduleId);

    if (!moduleName) {
      moduleName = `__m${this.moduleCount++}__`;
      transformNode = this.generateImportTransformNode(moduleName, moduleId);
    }

    (data as ImportInfoData).moduleName = moduleName;
    this.importInfos.push({ data: data as ImportInfoData, transformNode });

    this.deferQueue.removes.add(() => state.remove(ancestors));
    this.deferQueue.importChecks.add(() =>
      this.checkImportNames(data.imports, moduleId),
    );
  }

  // Dynamic import expression
  private importExpressionVisitor(
    node: ImportExpression,
    state: State,
    ancestors: Array<Node>,
  ) {
    const replacement = callExpression(
      identifier(Compiler.keys.__VIRTUAL_DYNAMIC_IMPORT__),
      [node.source],
    );
    state.replaceWith(replacement, ancestors);
  }

  // `import.meta`
  private importMetaVisitor(
    node: MetaProperty,
    state: State,
    ancestors: Array<Node>,
  ) {
    if (node.meta.name === 'import') {
      const replacement = memberExpression(
        identifier(Compiler.keys.__VIRTUAL_IMPORT_META__),
        node.property,
      );
      state.replaceWith(replacement, ancestors);
    }
  }

  private async generateCode() {
    const nameCounts = {};
    const getExports = ({ namespace, moduleId }) => {
      return namespace
        ? [namespace as string]
        : this.getChildModuleExports(moduleId) || [];
    };

    this.deferQueue.exportNamespaces.forEach((val) => {
      getExports(val).forEach((name) => {
        if (!nameCounts[name]) {
          nameCounts[name] = 1;
        } else {
          nameCounts[name]++;
        }
      });
    });

    this.deferQueue.exportNamespaces.forEach((val) => {
      // `export namespace` 变量的去重
      const exports = getExports(val).filter((name) => {
        if (name === 'default') return false;
        if (nameCounts[name] > 1) return false;
        return this.exportInfos.every((val) => val.name !== name);
      });
      val.fn(exports);
    });

    this.deferQueue.importChecks.forEach((fn) => fn());
    this.deferQueue.identifierRefs.forEach((fn) => fn());
    this.deferQueue.replaces.forEach((fn) => fn());
    this.deferQueue.removes.forEach((fn) => fn());
    this.generateVirtualModuleSystem();

    const output = generate(this.ast, {
      sourceMapWithCode: true,
      sourceMap: this.options.filename,
      sourceContent: this.options.code,
    }) as unknown as Output;

    await mergeSourcemap(this, output);
    return output;
  }

  transform() {
    if (this.consumed) {
      throw new Error('Already consumed');
    }
    this.consumed = true;
    const that = this;
    const c = (fn) => {
      return function () {
        fn.apply(that, arguments);
      };
    };

    ancestor(
      this.ast as unknown as AcornNode,
      {
        Identifier: c(this.identifierVisitor),
        VariablePattern: c(this.identifierVisitor),
        MetaProperty: c(this.importMetaVisitor),
        ImportExpression: c(this.importExpressionVisitor),
        ImportDeclaration: c(this.importDeclarationVisitor),
        ExportAllDeclaration: c(this.exportDeclarationVisitor),
        ExportNamedDeclaration: c(this.exportDeclarationVisitor),
        ExportDefaultDeclaration: c(this.exportDeclarationVisitor),
      },
      null,
      this.state,
    );

    return {
      imports: this.importInfos.map((v) => v.data),
      generateCode: async () => {
        const output = await this.generateCode();
        (output as ModuleResource).exports = this.exportInfos.map(
          (v) => v.name,
        );
        return output;
      },
    };
  }
}
