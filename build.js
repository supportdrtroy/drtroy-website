#!/usr/bin/env node
/**
 * DrTroy CE Platform — Build Script
 * Minifies HTML, CSS, and JS before deploy.
 * Output goes to dist/ — Netlify publishes from there.
 */
const { minify: minifyHtml } = require('html-minifier-terser');
const { minify: minifyJs }   = require('terser');
const fs   = require('fs');
const path = require('path');

const SRC  = __dirname;
const DIST = path.join(__dirname, 'dist');

// Files/dirs to skip entirely
const SKIP = new Set([
  'node_modules', 'dist', '.git', 'build.js',
  'package.json', 'package-lock.json', 'validate-site.js',
  'CLAUDE.md',
  'BANE-BRIEFING.md',
]);

// Extensions we actively minify
const HTML_EXT = new Set(['.html', '.htm']);
const JS_EXT   = new Set(['.js']);

const HTML_OPTS = {
  removeComments:            true,
  removeCommentsFromCDATA:   true,
  collapseWhitespace:        true,
  conservativeCollapse:      true,
  collapseInlineTagWhitespace: false,
  removeAttributeQuotes:     false,
  removeRedundantAttributes: true,
  removeEmptyAttributes:     true,
  removeScriptTypeAttributes: true,
  removeStyleLinkTypeAttributes: true,
  useShortDoctype:           true,
  minifyCSS:                 true,
  // Compress inline JS but don't rename variables — cross-file globals must stay intact
  // NOTE: drop_console disabled temporarily for debugging admin panel issues
  minifyJS: { compress: { drop_console: false, passes: 2 }, mangle: false },
};

const JS_OPTS = {
  compress: { drop_console: false, passes: 2 },
  mangle:   true,
  format:   { comments: false },
};

// DON'T minify these JS files — they contain inline scripts that break when mangled
const NO_MINIFY_JS = new Set([
  'admin.html',  // contains inline scripts with onclick handlers
  path.join('courses', 'pt-msk-001-progressive.html'),
  path.join('courses', 'balance-gait-001-progressive.html'),
  path.join('courses', 'neuro-gait-001-progressive.html'),
  path.join('courses', 'stroke-rehab-001-progressive.html'),
  path.join('courses', 'vestibular-001-progressive.html'),
  path.join('courses', 'ortho-sports-001-progressive.html'),
  path.join('courses', 'amputee-rehab-001-progressive.html'),
  path.join('courses', 'wound-care-001-progressive.html'),
  path.join('courses', 'cardiac-rehab-001-progressive.html'),
  path.join('courses', 'pelvic-floor-001-progressive.html'),
  path.join('courses', 'pediatric-pt-001-progressive.html'),
  path.join('courses', 'geriatric-pt-001-progressive.html'),
  path.join('courses', 'manual-therapy-001-progressive.html'),
]);

// ─────────────────────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────────────────────
async function copyFile(src, dest) {
  const buf = await fs.promises.readFile(src);
  await fs.promises.mkdir(path.dirname(dest), { recursive: true });
  await fs.promises.writeFile(dest, buf);
}

async function processHtmlFile(src, dest) {
  const raw = await fs.promises.readFile(src, 'utf-8');

  // Check if this file should be excluded from minification
  const relativePath = path.relative(SRC, src);
  if (NO_MINIFY_JS.has(relativePath)) {
    // Copy as-is for files with inline scripts that break minification
    await fs.promises.mkdir(path.dirname(dest), { recursive: true });
    await fs.promises.writeFile(dest, raw, 'utf-8');
    return { size: Buffer.byteLength(raw, 'utf-8'), minified: false };
  }

  const mini = await minifyHtml(raw, HTML_OPTS);
  await fs.promises.mkdir(path.dirname(dest), { recursive: true });
  await fs.promises.writeFile(dest, mini, 'utf-8');
  return { size: Buffer.byteLength(mini, 'utf-8'), minified: true };
}

async function processJsFile(src, dest) {
  // Skip minification for problematic files (handled inline in HTML)
  const relativePath = path.relative(SRC, src);
  if (relativePath.includes('admin')) {
    // Copy as-is
    const raw = await fs.promises.readFile(src, 'utf-8');
    await fs.promises.mkdir(path.dirname(dest), { recursive: true });
    await fs.promises.writeFile(dest, raw, 'utf-8');
    return { size: Buffer.byteLength(raw, 'utf-8'), minified: false };
  }

  const raw = await fs.promises.readFile(src, 'utf-8');
  const mini = await minifyJs(raw, JS_OPTS);
  if (mini.code) {
    await fs.promises.mkdir(path.dirname(dest), { recursive: true });
    await fs.promises.writeFile(dest, mini.code, 'utf-8');
    return { size: Buffer.byteLength(mini.code, 'utf-8'), minified: true };
  }
  // Fallback: copy as-is if minification fails
  await fs.promises.mkdir(path.dirname(dest), { recursive: true });
  await fs.promises.writeFile(dest, raw, 'utf-8');
  return { size: Buffer.byteLength(raw, 'utf-8'), minified: false };
}

// ─────────────────────────────────────────────────────────────────────────────
// RECURSIVE WALK
// ─────────────────────────────────────────────────────────────────────────────
async function walk(dir, callback) {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    const rel  = path.relative(SRC, full);

    if (SKIP.has(entry.name) || SKIP.has(rel)) continue;

    if (entry.isDirectory()) {
      await walk(full, callback);
    } else if (entry.isFile()) {
      await callback(full, rel);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  console.log('🔨  DrTroy Build Starting...\n');

  // Clean/create dist
  try { await fs.promises.rm(DIST, { recursive: true }); } catch {}
  await fs.promises.mkdir(DIST, { recursive: true });

  const stats = { html: 0, js: 0, other: 0 };

  await walk(SRC, async (srcPath, relPath) => {
    const destPath = path.join(DIST, relPath);
    const ext = path.extname(relPath).toLowerCase();

    try {
      if (HTML_EXT.has(ext)) {
        const s = await processHtmlFile(srcPath, destPath);
        stats.html++;
        console.log(`  📄 ${relPath} ${s.minified ? '(minified)' : '(copied)'}`);
      } else if (JS_EXT.has(ext)) {
        const s = await processJsFile(srcPath, destPath);
        stats.js++;
        console.log(`  📜 ${relPath} ${s.minified ? '(minified)' : '(copied)'}`);
      } else {
        await copyFile(srcPath, destPath);
        stats.other++;
        console.log(`  📦 ${relPath}`);
      }
    } catch (err) {
      console.error(`  ❌ ${relPath}: ${err.message}`);
      // Copy file as-is if processing fails
      try {
        await copyFile(srcPath, destPath);
        console.log(`  📦 ${relPath} (fallback copy)`);
      } catch (copyErr) {
        console.error(`  💥 ${relPath}: Copy failed - ${copyErr.message}`);
      }
    }
  });

  console.log(`\n✅  Build complete!`);
  console.log(`   HTML: ${stats.html}, JS: ${stats.js}, Other: ${stats.other}`);
})();
