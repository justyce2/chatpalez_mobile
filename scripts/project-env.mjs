import fs from 'node:fs';
import path from 'node:path';

export function loadProjectEnv(root = process.cwd()) {
  const values = {};
  const file = path.join(root, '.env');
  if (!fs.existsSync(file)) return values;

  for (const rawLine of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }

  return values;
}

export function projectEnvValue(name, fallback, root = process.cwd()) {
  const fileValues = loadProjectEnv(root);
  return process.env[name] ?? fileValues[name] ?? fallback;
}
