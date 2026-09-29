/**
 * Genera dist/TODO_GAS_SYR.html: la aplicación completa en UN SOLO archivo (sin internet,
 * se abre con doble clic en Windows/macOS o se envía por WhatsApp/correo al celular).
 * Uso: node tools/build.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const b64 = (p) => 'data:image/png;base64,' + readFileSync(join(ROOT, p)).toString('base64');
// Evita que "</script" dentro del código cierre la etiqueta.
const safe = (js) => js.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');

// Regenera assets/brand.js desde las imágenes.
writeFileSync(join(ROOT, 'assets/brand.js'),
  '/* Logo, llama y firma embebidos (data URI) para el PDF. Generado por tools/build.mjs */\nwindow.TGS_BRAND = ' +
  JSON.stringify({ logo: b64('assets/logo.png'), flame: b64('assets/flame.png'), firma: b64('assets/firma.png') }) + ';\n');

let html = read('index.html');
html = html.replace('<html lang="es">', '<html lang="es" data-single-file>');
html = html.replace(/<link rel="manifest"[^>]*>\n?/, '');
html = html.replace(/<link rel="icon"[^>]*>/, `<link rel="icon" type="image/png" href="${b64('icons/icon-32.png')}">`);
html = html.replace(/<link rel="apple-touch-icon"[^>]*>/, `<link rel="apple-touch-icon" href="${b64('icons/icon-180.png')}">`);
html = html.replace('<link rel="stylesheet" href="css/app.css">', () => `<style>\n${read('css/app.css')}\n</style>`);
const flame = b64('assets/flame.png');
html = html.replaceAll('src="assets/flame.png"', `src="${flame}"`);
for (const f of ['engine', 'charts', 'pdf', 'app']) {
  html = html.replace(`<script src="js/${f}.js"></script>`, () => `<script>\n${safe(read(`js/${f}.js`))}\n</script>`);
}
// Librerías de PDF como texto inerte: se activan solo al exportar (apertura instantánea).
const libs = [['jspdf', 'vendor/jspdf.umd.min.js'], ['autotable', 'vendor/jspdf.plugin.autotable.min.js'], ['brand', 'assets/brand.js']]
  .map(([id, p]) => `<script type="text/plain" id="lib-${id}">${safe(read(p))}</script>`).join('\n');
html = html.replace('</body>', () => `${libs}\n</body>`);

mkdirSync(join(ROOT, 'dist'), { recursive: true });
writeFileSync(join(ROOT, 'dist/TODO_GAS_SYR.html'), html);
console.log('dist/TODO_GAS_SYR.html', (html.length / 1024).toFixed(0) + ' KB');
