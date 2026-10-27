// Loads the engine files listed in src/manifest.json into globalThis.RLS (Node).
const path = require('node:path');
const manifest = require('../src/manifest.json');
for (const f of manifest.engine) require(path.join(__dirname, '..', f));
module.exports = globalThis.RLS;
