// Builds the assembler WASM module and copies it next to the compiled server.
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const manifest = path.join(root, 'wasm', 'Cargo.toml');
const target = 'wasm32-unknown-unknown';

const result = spawnSync('cargo', [
	'build', '--release', '--locked', '--target', target, '--manifest-path', manifest,
], { stdio: 'inherit', cwd: root, shell: process.platform === 'win32' });

if (result.error || result.status !== 0) {
	console.error('Failed to build the assembler WASM module. Install Rust (https://rustup.rs) and run `rustup target add ' + target + '`.');
	process.exit(result.status || 1);
}

const built = path.join(root, 'wasm', 'target', target, 'release', 'waveasm_wasm.wasm');
const outDir = path.join(root, 'server', 'out');
fs.mkdirSync(outDir, { recursive: true });
fs.copyFileSync(built, path.join(outDir, 'waveasm.wasm'));
console.log('Copied waveasm.wasm to server/out');
