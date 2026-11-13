// Offline only. Reads a protected export and writes a protected API body; never publishes it.
import fs from 'node:fs';
import { patchVkAuth } from './lib/vk-auth-workflow-patch.mjs';

const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error('Usage: node scripts/prepare-vk-auth-patch.mjs <protected-current.json> <protected-candidate.json>');
const raw = JSON.parse(fs.readFileSync(input, 'utf8'));
const source = raw.data || raw;
if (source.reviewOnly) throw new Error('A redacted review file cannot produce a production API body');
const w = patchVkAuth(source);
fs.writeFileSync(output, JSON.stringify({ name: w.name, nodes: w.nodes, connections: w.connections, settings: w.settings || {} }, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
console.log('Prepared local protected VK_Auth candidate. Nothing published.');
