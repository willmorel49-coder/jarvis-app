// PostToolUse : `node --check` sur chaque .js/.mjs écrit, pour voir une erreur de
// syntaxe tout de suite plutôt qu'au push (ci.yml ne contrôle que crm/).
import { spawnSync } from 'node:child_process';
let brut = '';
process.stdin.on('data', (c) => (brut += c)).on('end', () => {
  let f = '';
  try { f = JSON.parse(brut).tool_input?.file_path || ''; } catch { return; }
  if (!/\.m?js$/.test(f) || f.includes('/vendor/')) return;
  const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
  if (r.status !== 0) {
    process.stderr.write(`Erreur de syntaxe dans ${f} :\n${r.stderr}`);
    process.exit(2);
  }
});
