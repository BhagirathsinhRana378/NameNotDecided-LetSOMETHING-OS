import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

console.log('🔍 Running BrowOS Production Build & Integrity Check...\n');

let errors = 0;

function check(desc, fn) {
  try {
    fn();
    console.log(`  ✅ ${desc}`);
  } catch (err) {
    console.error(`  ❌ ${desc}: ${err.message}`);
    errors++;
  }
}

// 1. Manifest verification
check('manifest.json validity and integrity', () => {
  const manifestPath = path.join(root, 'manifest.json');
  const raw = fs.readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(raw);
  if (manifest.manifest_version !== 3) throw new Error('Manifest version must be 3');
  if (!manifest.name) throw new Error('Manifest missing name');
  if (!manifest.version) throw new Error('Manifest missing version');
  if (!manifest.chrome_url_overrides?.newtab) throw new Error('Missing newtab override');

  // Verify icon files exist
  for (const [size, iconPath] of Object.entries(manifest.icons || {})) {
    const full = path.join(root, iconPath);
    if (!fs.existsSync(full)) throw new Error(`Missing icon file: ${iconPath}`);
  }

  // Verify background worker
  if (manifest.background?.service_worker) {
    const worker = path.join(root, manifest.background.service_worker);
    if (!fs.existsSync(worker)) throw new Error(`Missing background worker: ${manifest.background.service_worker}`);
  }
});

// 2. newtab.html verification
check('newtab.html structure and asset links', () => {
  const htmlPath = path.join(root, 'newtab.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  if (!html.includes('css/os.css')) throw new Error('Missing css/os.css reference');
  if (!html.includes('js/main.js')) throw new Error('Missing js/main.js reference');
});

// 3. JavaScript files syntax verification
const jsDir = path.join(root, 'js');
if (fs.existsSync(jsDir)) {
  const jsFiles = fs.readdirSync(jsDir).filter(f => f.endsWith('.js'));
  for (const file of jsFiles) {
    check(`Syntax check for js/${file}`, () => {
      const code = fs.readFileSync(path.join(jsDir, file), 'utf8');
      new vm.SourceTextModule(code, { initializeImportMeta() {} });
    });
  }
}

// 4. CSS file validation
check('css/os.css brackets and format integrity', () => {
  const css = fs.readFileSync(path.join(root, 'css', 'os.css'), 'utf8');
  let openBraces = 0;
  for (let i = 0; i < css.length; i++) {
    if (css[i] === '{') openBraces++;
    else if (css[i] === '}') openBraces--;
    if (openBraces < 0) throw new Error(`Mismatched closing brace at character ${i}`);
  }
  if (openBraces !== 0) throw new Error(`Unclosed braces (${openBraces} remaining) in css/os.css`);
});

console.log('\n----------------------------------------');
if (errors > 0) {
  console.error(`💥 Build verification FAILED with ${errors} error(s).`);
  process.exit(1);
} else {
  console.log('✨ Build verification PASSED successfully!');
  process.exit(0);
}
