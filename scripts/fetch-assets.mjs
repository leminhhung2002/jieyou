// Downloads Figma MCP assets listed in a JSON manifest: { "relative/path.ext": "url" }
// Usage: node scripts/fetch-assets.mjs manifest.json outDir
import fs from 'node:fs/promises';
import path from 'node:path';
const [,, manifestPath, outDir] = process.argv;
const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
const entries = Object.entries(manifest);
let ok = 0, fail = 0;
await Promise.all(entries.map(async ([rel, url]) => {
  const dest = path.join(outDir, rel);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(res.status);
      const buf = Buffer.from(await res.arrayBuffer());
      if (!buf.length) throw new Error('empty');
      await fs.writeFile(dest, buf); ok++; return;
    } catch (e) { if (attempt === 2) { fail++; console.error('FAIL', rel, e.message); } }
  }
}));
console.log(`done ok=${ok} fail=${fail}`);
