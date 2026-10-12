import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const allowed = {
  '@tandara/contracts': [],
  '@tandara/api-client': ['@tandara/contracts'],
  '@tandara/ui': [],
  '@tandara/database': [],
  '@tandara/backend': ['@tandara/contracts', '@tandara/database'],
  '@tandara/api': ['@tandara/contracts', '@tandara/backend'],
  '@tandara/worker': ['@tandara/backend'],
  '@tandara/resident-web': ['@tandara/contracts', '@tandara/api-client', '@tandara/ui'],
  '@tandara/coordinator-web': ['@tandara/contracts', '@tandara/api-client', '@tandara/ui'],
};
const browserPackages = new Set([
  '@tandara/contracts',
  '@tandara/api-client',
  '@tandara/ui',
  '@tandara/resident-web',
  '@tandara/coordinator-web',
]);
const packages = [];
for (const group of ['apps', 'packages']) {
  for (const directory of await readdir(path.join(root, group), { withFileTypes: true })) {
    if (!directory.isDirectory()) continue;
    const base = path.join(root, group, directory.name);
    const manifest = JSON.parse(await readFile(path.join(base, 'package.json'), 'utf8'));
    packages.push({ base, manifest });
  }
}

async function files(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...(await files(target)));
    else if (/\.[cm]?[jt]sx?$/.test(entry.name)) result.push(target);
  }
  return result;
}

function imports(source, file) {
  const result = [];
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  function visit(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    )
      result.push(node.moduleSpecifier.text);
    if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        node.expression.getText(tree) === 'require')
    ) {
      const argument = node.arguments[0];
      if (argument && ts.isStringLiteral(argument)) result.push(argument.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  return result;
}

for (const { base, manifest } of packages) {
  assert.ok(allowed[manifest.name], `Declare architecture boundaries for ${manifest.name}`);
  const dependencies = {
    ...manifest.dependencies,
    ...manifest.peerDependencies,
    ...manifest.devDependencies,
  };
  for (const name of Object.keys(dependencies).filter((name) => name.startsWith('@tandara/'))) {
    assert.ok(allowed[manifest.name].includes(name), `${manifest.name} may not depend on ${name}`);
  }
  for (const file of await files(path.join(base, 'src'))) {
    for (const specifier of imports(await readFile(file, 'utf8'), file)) {
      if (specifier.startsWith('@tandara/')) {
        const name = specifier.split('/').slice(0, 2).join('/');
        assert.ok(dependencies[name], `${file}: undeclared workspace dependency ${name}`);
        assert.ok(
          allowed[manifest.name].includes(name),
          `${file}: forbidden workspace import ${name}`,
        );
        assert.ok(!specifier.includes('/src/'), `${file}: import through public package exports`);
      }
      if (specifier.startsWith('.')) {
        const resolved = path.resolve(path.dirname(file), specifier);
        const relative = path.relative(base, resolved);
        assert.ok(
          !relative.startsWith('..') && !path.isAbsolute(relative),
          `${file}: relative import crosses a package boundary`,
        );
      }
      if (browserPackages.has(manifest.name)) {
        assert.ok(
          !/^(node:|@nestjs\/|pg$|kysely$|bullmq$|pino$)/.test(specifier),
          `${file}: server dependency in browser package`,
        );
      }
    }
  }
}
console.info(`Architecture boundaries verified for ${packages.length} workspace packages.`);
