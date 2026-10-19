import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';

/** Admin is English-only (one reader), tests and generated tables carry no UI text. */
const SKIP = [/\.test\.tsx?$/, /\.generated\.ts$/, /^src\/app\/admin\//, /^src\/components\/site\/admin\//, /^src\/app\/api\//];

function files(dir: string, root: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files(path, root, out);
    else if (/\.tsx?$/.test(entry.name) && !SKIP.some(re => re.test(relative(root, path)))) out.push(path);
  }
  return out;
}

/** The callee is t(…), t.rich(…) or msg(…), whatever t was bound from. */
function isMessageCall(node: ts.CallExpression): boolean {
  const callee = node.expression;
  if (ts.isIdentifier(callee)) return callee.text === 't' || callee.text === 'msg';
  return ts.isPropertyAccessExpression(callee) && callee.name.text === 'rich' && ts.isIdentifier(callee.expression) && callee.expression.text === 't';
}

export type Extracted = Map<string, string[]>;

/** Every literal message in src, with the files it appears in (relative to root). */
export function extract(root: string, dirs = ['src']): Extracted {
  const found: Extracted = new Map();
  for (const dir of dirs) {
    for (const path of files(join(root, dir), root)) {
      const text = readFileSync(path, 'utf8');
      // `t` is a common local name (a time, a helper); only files that import a translator, or take one from a
      // public page's SiteText, hold messages.
      if (!/from '@\/(lib\/core\/i18n\/|components\/ui\/use-t')|\{[^}]*\bt\b[^}]*\} = (?:text|props\.text)\b/.test(text) || !/\b(t|msg)(\.rich)?\(/.test(text)) continue;
      const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, false, path.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
      const file = relative(root, path);
      const visit = (node: ts.Node) => {
        if (ts.isCallExpression(node) && isMessageCall(node)) {
          const first = node.arguments[0];
          if (first && (ts.isStringLiteral(first) || ts.isNoSubstitutionTemplateLiteral(first))) {
            const list = found.get(first.text) ?? [];
            if (!list.includes(file)) list.push(file);
            found.set(first.text, list);
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
    }
  }
  return found;
}
