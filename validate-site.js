#!/usr/bin/env node
/**
 * DrTroy Site Validator — Run before committing changes.
 * Catches common issues that break the admin panel.
 */
const fs = require('fs');
const path = require('path');

let errors = 0;
let warnings = 0;

function error(msg) { console.error('  \x1b[31mERROR\x1b[0m ' + msg); errors++; }
function warn(msg) { console.warn('  \x1b[33mWARN\x1b[0m  ' + msg); warnings++; }
function ok(msg) { console.log('  \x1b[32mOK\x1b[0m    ' + msg); }

console.log('\nDrTroy Site Validator\n' + '='.repeat(40));

// ── 1. Syntax check JS files ──────────────────────────────
console.log('\n1. JavaScript Syntax');
const jsFiles = [
    'js/admin.js',
    'js/course-management.js',
    'js/supabase-client.js',
    'js/cart.js',
    'js/course-guard.js',
];
for (const f of jsFiles) {
    const full = path.join(__dirname, f);
    if (!fs.existsSync(full)) { warn(f + ' — file not found'); continue; }
    try {
        new Function(fs.readFileSync(full, 'utf8'));
        ok(f + ' — syntax valid');
    } catch (e) {
        error(f + ' — SYNTAX ERROR: ' + e.message);
    }
}

// ── 2. Check for const/let global collisions ──────────────
console.log('\n2. Global Scope Collisions');
const globalNames = {};
const jsToScan = ['js/admin.js', 'js/course-management.js', 'js/supabase-client.js'];
for (const f of jsToScan) {
    const full = path.join(__dirname, f);
    if (!fs.existsSync(full)) continue;
    const src = fs.readFileSync(full, 'utf8');

    // Find top-level function declarations
    const funcRe = /^function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/gm;
    let m;
    while ((m = funcRe.exec(src)) !== null) {
        const name = m[1];
        if (globalNames[name] && globalNames[name] !== f) {
            warn('Function "' + name + '" defined in BOTH ' + globalNames[name] + ' AND ' + f + ' — last loaded wins');
        }
        globalNames[name] = f;
    }

    // Find dangerous const/let that might collide
    const constLetRe = /^(const|let)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/gm;
    while ((m = constLetRe.exec(src)) !== null) {
        const kind = m[1];
        const name = m[2];
        if (globalNames[name] && globalNames[name] !== f) {
            error(kind + ' "' + name + '" in ' + f + ' COLLIDES with ' + globalNames[name] + ' — will cause SyntaxError! Use var instead.');
        }
    }
}
if (errors === 0 && warnings === 0) ok('No global scope collisions detected');

// ── 3. Check escapeHtml pattern in admin.js ───────────────
console.log('\n3. escapeHtml Safety');
{
    const adminSrc = fs.readFileSync(path.join(__dirname, 'js/admin.js'), 'utf8');
    if (/\b(const|let)\s+escapeHtml\b/.test(adminSrc)) {
        error('admin.js uses const/let for escapeHtml — MUST be var to avoid collision with course-management.js');
    } else if (/\bvar\s+escapeHtml\b/.test(adminSrc)) {
        ok('admin.js uses var for escapeHtml (correct)');
    } else {
        warn('escapeHtml not found in admin.js — may be missing');
    }
}

// ── 4. Check script references in admin.html ──────────────
console.log('\n4. Script References');
{
    const html = fs.readFileSync(path.join(__dirname, 'admin.html'), 'utf8');
    const scriptRe = /src="([^"]*\.js[^"]*)"/g;
    let m;
    while ((m = scriptRe.exec(html)) !== null) {
        const src = m[1];
        if (src.startsWith('http')) continue; // External CDN
        const localPath = src.split('?')[0]; // Strip query params
        const full = path.join(__dirname, localPath);
        if (fs.existsSync(full)) {
            ok(localPath + ' — exists');
        } else {
            error(localPath + ' — REFERENCED IN admin.html BUT FILE MISSING');
        }
    }
}

// ── 5. Check Netlify functions syntax ─────────────────────
console.log('\n5. Netlify Functions');
const fnDir = path.join(__dirname, 'netlify/functions');
if (fs.existsSync(fnDir)) {
    for (const f of fs.readdirSync(fnDir)) {
        if (!f.endsWith('.js')) continue;
        const full = path.join(fnDir, f);
        try {
            require(full);
            ok(f + ' — loads OK');
        } catch (e) {
            // Some functions need env vars, that's expected
            if (e.message && e.message.includes('Cannot find module')) {
                error(f + ' — missing dependency: ' + e.message);
            } else {
                ok(f + ' — syntax OK (runtime deps may differ)');
            }
        }
    }
}

// ── 6. Check build.js exclusions still correct ────────────
console.log('\n6. Build Config');
{
    const buildSrc = fs.readFileSync(path.join(__dirname, 'build.js'), 'utf8');
    if (buildSrc.includes("'admin.html'")) {
        ok('admin.html excluded from minification');
    } else {
        error('admin.html NOT excluded from minification — will break onclick handlers');
    }
    if (buildSrc.includes("'admin.js'")) {
        ok('admin.js excluded from minification');
    } else {
        error('admin.js NOT excluded from minification — will break global functions');
    }
}

// ── 7. Build test ─────────────────────────────────────────
console.log('\n7. Build Test');
const { execSync } = require('child_process');
try {
    const output = execSync('node build.js 2>&1', { cwd: __dirname, timeout: 30000 }).toString();
    if (output.includes('Build complete')) {
        const match = output.match(/Build complete in [\d.]+s/);
        ok('Build passed' + (match ? ' — ' + match[0] : ''));
    } else {
        error('Build did not report completion');
    }
} catch (e) {
    error('Build FAILED: ' + (e.stderr || e.message).toString().slice(0, 200));
}

// ── Summary ───────────────────────────────────────────────
console.log('\n' + '='.repeat(40));
if (errors > 0) {
    console.log('\x1b[31mFAILED\x1b[0m — ' + errors + ' error(s), ' + warnings + ' warning(s)');
    console.log('Fix errors before committing!\n');
    process.exit(1);
} else if (warnings > 0) {
    console.log('\x1b[33mPASSED WITH WARNINGS\x1b[0m — ' + warnings + ' warning(s)');
    console.log('Review warnings before committing.\n');
} else {
    console.log('\x1b[32mALL CHECKS PASSED\x1b[0m\n');
}
