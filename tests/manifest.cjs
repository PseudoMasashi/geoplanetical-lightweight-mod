const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'mod.json'), 'utf8'));
const source = fs.readFileSync(path.join(root, 'lightweight.js'));
const digest = crypto.createHash('sha256').update(source).digest('hex');
assert.equal(digest, manifest.moduleSha256, 'Published adapter must match the installer manifest');
assert.equal(manifest.modVersion, require('../package.json').version);
assert.equal(manifest.patches.length, manifest.hookCount);
assert.deepEqual(manifest.simulationFilesModified, []);
assert.equal(new Set(manifest.patches.map(p => p.find)).size, manifest.hookCount);
for (const key of ['originalBundleSha256', 'modifiedBundleSha256', 'moduleSha256']) {
  assert.match(manifest[key], /^[a-f0-9]{64}$/);
}
console.log('Manifest and source hashes passed.');
