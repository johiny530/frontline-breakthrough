// Packs dist/ into dist-artifact/index.html: one HTML body fragment (the artifact
// host adds the document skeleton) with CSS, JS, models and textures all inlined,
// since artifacts cannot serve .glb files.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { extname, join, relative, sep } from 'node:path';

const dist = 'dist';
const out = 'dist-artifact';
mkdirSync(out, { recursive: true });

const files = readdirSync(`${dist}/assets`);
const css = readFileSync(`${dist}/assets/${files.find((f) => f.endsWith('.css'))}`, 'utf8');
const js = readFileSync(`${dist}/assets/${files.find((f) => f.endsWith('.js'))}`, 'utf8').replace(/<\/script/gi, '<\\/script');

const MIME = { '.glb': 'model/gltf-binary', '.png': 'image/png' };
const root = `${dist}/assets/kenney`;
const inline = {};
const walk = (dir) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (MIME[extname(p)]) {
      const key = relative(root, p).split(sep).join('/');
      inline[key] = `data:${MIME[extname(p)]};base64,${readFileSync(p).toString('base64')}`;
    }
  }
};
walk(root);

const html = `<title>Frontline Breakthrough</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Black+Ops+One&family=Chakra+Petch:wght@400;600;700&family=Noto+Sans+TC:wght@700;900&display=swap">
<style>${css}</style>
<div id="app"><div id="ui"></div></div>
<script>window.__FB_INLINE_ASSETS = ${JSON.stringify(inline)};</script>
<script type="module">${js}</script>
`;
writeFileSync(`${out}/index.html`, html);
console.log(`wrote ${out}/index.html (${(html.length / 1024).toFixed(0)} KB)`);
