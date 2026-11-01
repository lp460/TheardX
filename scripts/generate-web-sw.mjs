import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const root = new URL('../dist-web/', import.meta.url);
const base = new URL('../web/service-worker.template.js', import.meta.url);
const paths = [];

async function visit(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await visit(path);
    else if (/\.(?:html|js|css|webmanifest|png|svg|woff2?)$/.test(entry.name)) {
      paths.push('/' + relative(root.pathname, path).replaceAll('\\', '/'));
    }
  }
}

await visit(root.pathname);
const hash = createHash('sha256');
for (const path of paths.sort()) {
  hash.update(path);
  hash.update(await readFile(join(root.pathname, path.slice(1))));
}
const version = hash.digest('hex').slice(0, 12);
const template = await readFile(base, 'utf8');
await writeFile(new URL('./sw.js', root), template
  .replace('__VERSION__', version)
  .replace('__PRECACHE__', JSON.stringify(paths)));
