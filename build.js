#!/usr/bin/env node
/**
 * DrTroy CE Platform — Build Script (Simple Copy Version)
 * Copies files to dist/ for deploy.
 */
const fs   = require('fs');
const path = require('path');

const SRC  = __dirname;
const DIST = path.join(__dirname, 'dist');

// Files/dirs to skip entirely
const SKIP = new Set([
  'node_modules', 'dist', '.git', 'build.js',
  'package.json', 'package-lock.json', 'validate-site.js',
  'CLAUDE.md', 'BANE-BRIEFING.md',
]);

// ─────────────────────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────────────────────
async function copyFile(src, dest) {
  const buf = await fs.promises.readFile(src);
  await fs.promises.mkdir(path.dirname(dest), { recursive: true });
  await fs.promises.writeFile(dest, buf);
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

  const stats = { files: 0 };

  await walk(SRC, async (srcPath, relPath) => {
    const destPath = path.join(DIST, relPath);
    try {
      await copyFile(srcPath, destPath);
      stats.files++;
      console.log(`  📄 ${relPath}`);
    } catch (err) {
      console.error(`  ❌ ${relPath}: ${err.message}`);
      process.exit(1);
    }
  });

  console.log(`\n✅  Build complete! ${stats.files} files copied.`);
})();
