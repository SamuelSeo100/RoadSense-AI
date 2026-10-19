/** Shared helpers for the eval scripts: seeded PRNG, CSV, paths. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

export const SEED = 2026;

/** Frozen release worktree (tag v1.0) and the uncommitted output folder. */
export const V1_ROOT = resolve(import.meta.dirname, '../../../routly-v1.0');
export const OUT_DIR = join(homedir(), 'routly-eval');

export function outPath(name: string): string {
  mkdirSync(OUT_DIR, { recursive: true });
  return join(OUT_DIR, name);
}

/** mulberry32: deterministic 32-bit PRNG, uniform in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates on a copy. */
export function shuffled<T>(items: readonly T[], rand: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a;
}

// ---- CSV (RFC 4180 quoting) ----

const cell = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function writeCsv(path: string, header: string[], rows: Record<string, unknown>[]): void {
  const lines = [header.join(','), ...rows.map((r) => header.map((h) => cell(r[h])).join(','))];
  writeFileSync(path, lines.join('\n') + '\n');
}

export function readCsv(path: string): Record<string, string>[] {
  const text = readFileSync(path, 'utf8').replace(/^﻿/, '');
  const records: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      records.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field !== '' || row.length) {
    row.push(field);
    records.push(row);
  }
  const [header, ...body] = records.filter((r) => r.some((f) => f.trim() !== ''));
  if (!header) return [];
  const keys = header.map((h) => h.trim());
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])));
}
