const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env'), override: true });

const root = path.resolve(__dirname, '..');
const mobile = path.join(root, 'mobile');
const www = path.join(root, 'www');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function copyFile(from, to) {
  ensureDir(path.dirname(to));
  fs.copyFileSync(from, to);
}

function copyDir(from, to) {
  ensureDir(to);
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(src, dst);
    else copyFile(src, dst);
  }
}

ensureDir(www);
copyDir(mobile, www);
copyFile(path.join(root, 'gabarito.pdf'), path.join(www, 'gabarito.pdf'));
copyDir(path.join(root, 'diretor'), path.join(www, 'diretor'));
if (fs.existsSync(path.join(root, 'assinaturas'))) {
  copyDir(path.join(root, 'assinaturas'), path.join(www, 'assinaturas'));
}
copyFile(path.join(root, 'node_modules', 'pdf-lib', 'dist', 'pdf-lib.min.js'), path.join(www, 'vendor', 'pdf-lib.min.js'));
copyFile(path.join(root, 'node_modules', '@pdf-lib', 'fontkit', 'dist', 'fontkit.umd.min.js'), path.join(www, 'vendor', 'fontkit.umd.min.js'));

const signatureFonts = fs.existsSync(path.join(root, 'assinaturas'))
  ? fs.readdirSync(path.join(root, 'assinaturas')).filter((n) => /\.(ttf|otf)$/i.test(n))
  : [];

const configJs = `window.APP_CONFIG = {
  MASTER_PASSWORD: ${JSON.stringify(process.env.APP_MASTER_PASSWORD || '')},
  ACCESS_PASSWORD: ${JSON.stringify(process.env.APP_ACCESS_PASSWORD || '')},
  SIGNATURE_FONTS: ${JSON.stringify(signatureFonts)}
};\n`;
fs.writeFileSync(path.join(www, 'config.js'), configJs, 'utf8');

console.log('Assets mobile gerados em /www');
