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
  'package.json', 'package-lock.json',
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

let processed = 0, copied = 0, errors = 0;

async function processFile(srcPath, distPath) {
  const ext = path.extname(srcPath).toLowerCase();
  fs.mkdirSync(path.dirname(distPath), { recursive: true });

  try {
    if (HTML_EXT.has(ext)) {
      const src    = fs.readFileSync(srcPath, 'utf8');
      // Skip minification for admin.html — large inline script breaks when minified
      if (path.basename(srcPath) === 'admin.html') {
        fs.writeFileSync(distPath, src, 'utf8');
        processed++;
      } else {
        const result = await minifyHtml(src, HTML_OPTS);
        fs.writeFileSync(distPath, result, 'utf8');
        processed++;
      }
    } else if (JS_EXT.has(ext)) {
      const src    = fs.readFileSync(srcPath, 'utf8');
      const result = await minifyJs(src, JS_OPTS);
      fs.writeFileSync(distPath, result.code, 'utf8');
      processed++;
    } else {
      fs.copyFileSync(srcPath, distPath);
      copied++;
    }
  } catch (err) {
    // If minification fails, copy original as fallback
    console.error(`  ⚠️  Minify failed for ${path.relative(SRC, srcPath)}: ${err.message}`);
    fs.copyFileSync(srcPath, distPath);
    errors++;
  }
}

async function walkDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (SKIP.has(entry.name)) continue;
    const srcPath  = path.join(dir, entry.name);
    const distPath = path.join(DIST, path.relative(SRC, srcPath));
    if (entry.isDirectory()) {
      await walkDir(srcPath);
    } else {
      await processFile(srcPath, distPath);
    }
  }
}

async function build() {
  console.log('🔨 Building DrTroy CE Platform...');
  const start = Date.now();

  // Clean dist
  if (fs.existsSync(DIST)) fs.rmSync(DIST, { recursive: true });
  fs.mkdirSync(DIST, { recursive: true });

  await walkDir(SRC);

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`✅ Build complete in ${elapsed}s — ${processed} minified, ${copied} copied${errors ? `, ${errors} fallback copies` : ''}`);
}

build().catch(err => { console.error('Build failed:', err); process.exit(1); });
