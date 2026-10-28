// Credential vault for the agent runner. The login for the live app is never in
// the repo, in a bundle, in the runner's JSON, or in a log: it lives here and is
// handed to the page in memory at run time.
//
// Lookup order:
//   1. env  FYP_LOGIN_EMAIL + FYP_LOGIN_PASSWORD   (CI, Linux, Momo)
//   2. Windows DPAPI file agent/.vault/login.json  (password encrypted for THIS
//      Windows user on THIS machine; git-ignored)
//
// "vault set" prompts in the user's own terminal with a hidden password field,
// so no agent or script ever sees the value being typed.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(HERE, '.vault');
const FILE = path.join(DIR, 'login.json');
const isWin = process.platform === 'win32';

const ps = (script, opts = {}) =>
  spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script], { encoding: 'utf8', ...opts });

export function mask(email) {
  if (!email) return null;
  const [u, d] = String(email).split('@');
  return d ? u[0] + '***@' + d : u[0] + '***';
}

/** { email, password, source } or null. */
export function getLogin() {
  const e = process.env.FYP_LOGIN_EMAIL, p = process.env.FYP_LOGIN_PASSWORD;
  if (e && p) return { email: e, password: p, source: 'env' };
  if (isWin && fs.existsSync(FILE)) {
    try {
      const rec = JSON.parse(fs.readFileSync(FILE, 'utf8').replace(/^﻿/, '')); // PowerShell 5.1 writes a BOM
      const r = ps('$s = ConvertTo-SecureString $env:FYP_V; [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s))',
        { env: { ...process.env, FYP_V: rec.passwordDpapi } });
      const pw = (r.stdout || '').replace(/\r?\n$/, '');
      if (r.status === 0 && rec.email && pw) return { email: rec.email, password: pw, source: 'dpapi' };
    } catch { /* corrupt or from another user/machine: treat as absent */ }
  }
  return null;
}

export function status() {
  const l = getLogin();
  return {
    stored: !!l,
    source: l ? l.source : null,
    email: l ? mask(l.email) : null,
    backends: isWin ? ['env', 'windows-dpapi'] : ['env'],
    howTo: l ? null : (isWin
      ? 'Run "node agent/fyp.mjs vault set" in your own terminal (hidden prompt), or set FYP_LOGIN_EMAIL and FYP_LOGIN_PASSWORD.'
      : 'Set FYP_LOGIN_EMAIL and FYP_LOGIN_PASSWORD in the environment.'),
  };
}

/** Interactive (Windows). Must be run by the user in a real terminal. */
export function setLogin() {
  if (!isWin) return { ok: false, userMessage: 'On this OS use the environment variables FYP_LOGIN_EMAIL and FYP_LOGIN_PASSWORD.' };
  if (!process.stdin.isTTY) return { ok: false, userMessage: 'Run "vault set" yourself in a terminal: it asks for the password with a hidden prompt, which only works interactively.' };
  fs.mkdirSync(DIR, { recursive: true });
  const script = [
    "$e = Read-Host 'Login email for the live app'",
    "$p = Read-Host 'Password (hidden)' -AsSecureString",
    "if (-not $e -or $p.Length -eq 0) { Write-Host 'Nothing stored.'; exit 3 }",
    '$o = @{ email = $e; passwordDpapi = (ConvertFrom-SecureString $p) } | ConvertTo-Json',
    `Set-Content -Path '${FILE.replace(/'/g, "''")}' -Value $o -Encoding UTF8`,
  ].join('; ');
  const r = ps(script, { stdio: 'inherit' });
  return r.status === 0 ? { ok: true, ...status() } : { ok: false, userMessage: 'Nothing was stored.' };
}

export function clearLogin() {
  try { fs.rmSync(DIR, { recursive: true, force: true }); } catch { /* already gone */ }
  return { ok: true, ...status() };
}
