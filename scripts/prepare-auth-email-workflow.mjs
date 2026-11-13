// Offline generation only: never talks to n8n, Supabase or Unisender.
import fs from 'node:fs';
import path from 'node:path';
import { authEmailWorkflow } from './lib/auth-email-workflow.mjs';
const [output] = process.argv.slice(2);
if (!output) throw new Error('Usage: node scripts/prepare-auth-email-workflow.mjs <new-output.json>');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(authEmailWorkflow(), null, 2) + '\n', { flag: 'wx', mode: 0o600 });
console.log('Prepared inactive workflow definition. No secrets included; nothing published.');
