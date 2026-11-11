// Сборка сцены в один HTML (three.js внутри, без интернета) → lib/scene3d/sceneHtml.js.
// Запуск: cd scene && npm install && npm run build. Файл результата хранится в репозитории,
// поэтому сборке APK этот шаг не нужен. --preview дополнительно пишет scene/preview.html.
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const out = esbuild.buildSync({
  entryPoints: [path.join(__dirname, 'src/main.js')],
  bundle: true, minify: true, format: 'iife', target: 'es2018', write: false, legalComments: 'none',
});
const js = out.outputFiles[0].text.replace(/<\/script/g, '<\\/script');
const html = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>html,body{margin:0;height:100%;overflow:hidden;background:#F6F4EE;touch-action:none}canvas{display:block;position:fixed;left:0;top:0}</style>
</head><body><script>${js}</script></body></html>`;

const dir = path.join(__dirname, '../lib/scene3d');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'sceneHtml.js'),
  '// Собрано из scene/src (cd scene && npm run build). Руками не править.\n' +
  'export const SCENE_HTML = ' + JSON.stringify(html) + ';\n');
if (process.argv.includes('--preview')) fs.writeFileSync(path.join(__dirname, 'preview.html'), html);
console.log('scene html:', Math.round(html.length / 1024) + ' KB');
