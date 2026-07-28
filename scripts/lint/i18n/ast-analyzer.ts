import * as fs from "node:fs";
import * as path from "node:path";

import * as ts from "typescript";

const HOOKS = new Set(["useTranslations", "getTranslations"]);
const ITER_METHODS = new Set([
  "map",
  "forEach",
  "flatMap",
  "filter",
  "some",
  "every",
  "find",
  "reduce",
]);

export interface CodeReferences {
  usedKeys: Set<string>;
  dynamicKeySites: string[];
  rootNamespaceSites: string[];
}

function literalText(node: ts.Node | undefined): string | null {
  if (!node) return null;
  if (ts.isStringLiteral(node)) return node.text;
  if (ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return null;
}

/** For a call expression, return the base identifier name (foo for both foo() and foo.bar()). */
function baseCalleeName(call: ts.CallExpression): string | null {
  const e = call.expression;
  if (ts.isIdentifier(e)) return e.text;
  if (ts.isPropertyAccessExpression(e) && ts.isIdentifier(e.expression)) return e.expression.text;
  return null;
}

/** Walk a method-call chain (a.slice().filter()…) down to its base identifier. */
function arrayReceiverName(node: ts.Expression): string | null {
  if (ts.isIdentifier(node)) return node.text;
  if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
    return arrayReceiverName(node.expression.expression);
  }
  return null;
}

function literalStringValues(node: ts.Node): string[] | null {
  if (ts.isAsExpression(node)) node = node.expression;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return [node.text];
  if (ts.isArrayLiteralExpression(node)) {
    const out: string[] = [];
    for (const el of node.elements) {
      const v = literalStringValues(el);
      if (v === null) return null;
      out.push(...v);
    }
    return out;
  }
  return null;
}

function extractStringLiteralValues(type: ts.Type): string[] | null {
  if (type.isStringLiteral()) return [type.value];
  if (type.isUnion()) {
    const values: string[] = [];
    for (const t of type.types) {
      if (!t.isStringLiteral()) return null;
      values.push(t.value);
    }
    return values.length > 0 ? values : null;
  }
  return null;
}

function analyzeFile(
  filePath: string,
  sf: ts.SourceFile,
  checker: ts.TypeChecker,
  usedKeys: Set<string>,
  dynamicKeySites: string[],
  rootNamespaceSites: string[]
): void {
  const walk = (visit: (n: ts.Node) => void) => {
    const go = (n: ts.Node) => {
      visit(n);
      ts.forEachChild(n, go);
    };
    go(sf);
  };

  const constObjArrays = new Map<string, Map<string, string[]>>();
  const constStrRecords = new Map<string, string[]>();
  walk((node) => {
    if (!ts.isVariableStatement(node)) return;
    for (const decl of node.declarationList.declarations) {
      if (!ts.isIdentifier(decl.name) || !decl.initializer) continue;
      let init = decl.initializer;
      if (ts.isAsExpression(init)) init = init.expression;
      const name = decl.name.text;

      if (
        ts.isArrayLiteralExpression(init) &&
        init.elements.length > 0 &&
        init.elements.every(ts.isObjectLiteralExpression)
      ) {
        const fields = new Map<string, string[]>();
        for (const el of init.elements) {
          if (!ts.isObjectLiteralExpression(el)) continue;
          for (const prop of el.properties) {
            if (!ts.isPropertyAssignment(prop) || !ts.isIdentifier(prop.name)) continue;
            const vals = literalStringValues(prop.initializer);
            if (vals === null) continue;
            const fname = prop.name.text;
            if (!fields.has(fname)) fields.set(fname, []);
            fields.get(fname)!.push(...vals);
          }
        }
        if (fields.size > 0) constObjArrays.set(name, fields);
        continue;
      }

      if (ts.isObjectLiteralExpression(init)) {
        const vals: string[] = [];
        let ok = true;
        for (const prop of init.properties) {
          if (!ts.isPropertyAssignment(prop)) {
            ok = false;
            break;
          }
          const v = literalStringValues(prop.initializer);
          if (v === null) {
            ok = false;
            break;
          }
          vals.push(...v);
        }
        if (ok && vals.length > 0) constStrRecords.set(name, vals);
      }
    }
  });

  const bindings = new Map<string, Set<string>>();
  const addBinding = (v: string, ns: string) => {
    let s = bindings.get(v);
    if (!s) {
      s = new Set();
      bindings.set(v, s);
    }
    s.add(ns);
  };
  walk((node) => {
    if (!ts.isVariableStatement(node)) return;
    for (const decl of node.declarationList.declarations) {
      if (!ts.isIdentifier(decl.name)) continue;
      let init = decl.initializer;
      if (init && ts.isAwaitExpression(init)) init = init.expression;
      if (!init || !ts.isCallExpression(init)) continue;
      const callee = baseCalleeName(init);
      if (!callee || !HOOKS.has(callee) || ts.isPropertyAccessExpression(init.expression)) continue;
      const nsArg = init.arguments[0];
      const ns = nsArg ? literalText(nsArg) : null;
      if (ns === null) {
        rootNamespaceSites.push(
          `${filePath}:${sf.getLineAndCharacterOfPosition(decl.getStart()).line + 1}`
        );
        continue;
      }
      addBinding(decl.name.text, ns);
    }
  });

  const cbParamToArray = new Map<string, string>();
  const cbParamDrops = new Set<string>();
  walk((node) => {
    if (!ts.isCallExpression(node)) return;
    const e = node.expression;
    if (!ts.isPropertyAccessExpression(e) || !ITER_METHODS.has(e.name.text)) return;
    const receiver = arrayReceiverName(e.expression);
    if (!receiver || !constObjArrays.has(receiver)) return;
    const cb = node.arguments[0];
    let paramName: string | null = null;
    if (ts.isArrowFunction(cb) && cb.parameters[0] && ts.isIdentifier(cb.parameters[0].name)) {
      paramName = cb.parameters[0].name.text;
    } else if (
      ts.isFunctionExpression(cb) &&
      cb.parameters[0] &&
      ts.isIdentifier(cb.parameters[0].name)
    ) {
      paramName = cb.parameters[0].name.text;
    }
    if (!paramName) return;
    if (cbParamToArray.has(paramName)) cbParamDrops.add(paramName);
    else cbParamToArray.set(paramName, receiver);
  });
  for (const d of cbParamDrops) cbParamToArray.delete(d);

  const namespacesFor = (varName: string): string[] => {
    const s = bindings.get(varName);
    return s ? [...s] : [];
  };
  const markUsed = (namespaces: string[], key: string) => {
    for (const ns of namespaces) usedKeys.add(`${ns}.${key}`);
  };

  walk((node) => {
    if (!ts.isCallExpression(node)) return;
    const varName = baseCalleeName(node);
    if (!varName || !bindings.has(varName)) return;
    const arg = node.arguments[0];
    if (!arg) return;
    const namespaces = namespacesFor(varName);

    const lit = literalText(arg);
    if (lit !== null) {
      markUsed(namespaces, lit);
      return;
    }

    if (
      ts.isPropertyAccessExpression(arg) &&
      ts.isIdentifier(arg.expression) &&
      ts.isIdentifier(arg.name)
    ) {
      const arrName = cbParamToArray.get(arg.expression.text);
      const fieldVals = arrName ? constObjArrays.get(arrName)?.get(arg.name.text) : undefined;
      if (fieldVals) {
        fieldVals.forEach((v) => markUsed(namespaces, v));
        return;
      }
    }

    if (ts.isElementAccessExpression(arg) && ts.isIdentifier(arg.expression)) {
      const vals = constStrRecords.get(arg.expression.text);
      if (vals) {
        vals.forEach((v) => markUsed(namespaces, v));
        return;
      }
    }

    const resolved = extractStringLiteralValues(checker.getTypeAtLocation(arg));
    if (resolved) {
      resolved.forEach((v) => markUsed(namespaces, v));
      return;
    }

    dynamicKeySites.push(
      `${filePath}:${sf.getLineAndCharacterOfPosition(node.getStart()).line + 1}`
    );
  });
}

export function analyzeCodeReferences(srcDir: string): CodeReferences {
  const usedKeys = new Set<string>();
  const dynamicKeySites: string[] = [];
  const rootNamespaceSites: string[] = [];

  const files: string[] = [];
  const walkSrc = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walkSrc(full);
      else if (/\.[tc]sx?$/.test(entry.name)) files.push(full);
    }
  };
  walkSrc(srcDir);

  const root = path.resolve(srcDir, "..");
  const configPath = path.join(root, "tsconfig.json");
  let compilerOptions: ts.CompilerOptions = {};
  if (fs.existsSync(configPath)) {
    const cfg = ts.readConfigFile(configPath, ts.sys.readFile);
    if (!cfg.error && cfg.config) {
      const parsed = ts.parseJsonConfigFileContent(cfg.config, ts.sys, root);
      compilerOptions = { ...parsed.options, skipLibCheck: true, noEmit: true };
    }
  }
  const program = ts.createProgram(files, compilerOptions);
  const checker = program.getTypeChecker();

  for (const filePath of files) {
    const sf = program.getSourceFile(filePath);
    if (!sf) continue;
    analyzeFile(filePath, sf, checker, usedKeys, dynamicKeySites, rootNamespaceSites);
  }

  return { usedKeys, dynamicKeySites, rootNamespaceSites };
}
