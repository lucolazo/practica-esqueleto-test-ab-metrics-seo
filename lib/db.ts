import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { parseLog, serializeLog, type ExperimentLog, type Variant } from '@/lib/experiment'

// Log de eventos del experimento. Vive en una base, no en el navegador.
// Dos drivers con la misma interfaz y sin dependencias nuevas:
//  - Upstash Redis (REST, con fetch) si hay UPSTASH_REDIS_REST_URL/TOKEN (o KV_REST_API_*).
//    Es lo que hay que usar en un deploy serverless, donde el disco no persiste.
//  - SQLite (node:sqlite, incluido en Node 22) en un archivo. Es lo que se usa en local.

export type Store = {
  label: string
  recordImpression(visitorId: string, variant: Variant): Promise<void>
  // true si anotó la conversión; false si ese visitante ya tenía una.
  recordConversion(visitorId: string, variant: Variant): Promise<boolean>
  readLog(): Promise<ExperimentLog>
}

const VARIANT_KEYS: Variant[] = ['a', 'b']

// ---------------------------------------------------------------- SQLite

function openSqlite(): Store {
  const { DatabaseSync } = process.getBuiltinModule('node:sqlite') as typeof import('node:sqlite')
  // En Vercel solo /tmp es escribible: sirve para probar, pero no persiste entre instancias.
  const file =
    process.env.LAB_DB_PATH ??
    (process.env.VERCEL
      ? path.join(os.tmpdir(), 'lab.sqlite')
      : path.join(process.cwd(), 'data', 'lab.sqlite'))
  fs.mkdirSync(path.dirname(file), { recursive: true })

  const db = new DatabaseSync(file)
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS events (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      visitor_id TEXT NOT NULL,
      variant    TEXT NOT NULL CHECK (variant IN ('a','b')),
      kind       TEXT NOT NULL CHECK (kind IN ('impression','conversion')),
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    -- Una conversión por visitante, garantizada por la base y no por el código.
    CREATE UNIQUE INDEX IF NOT EXISTS one_conversion_per_visitor
      ON events (visitor_id) WHERE kind = 'conversion';
    CREATE INDEX IF NOT EXISTS events_kind_variant ON events (kind, variant);
  `)
  const insertImpression = db.prepare(
    "INSERT INTO events (visitor_id, variant, kind) VALUES (?, ?, 'impression')",
  )
  const insertConversion = db.prepare(
    "INSERT OR IGNORE INTO events (visitor_id, variant, kind) VALUES (?, ?, 'conversion')",
  )
  const counts = db.prepare('SELECT variant, kind, COUNT(*) AS n FROM events GROUP BY variant, kind')

  return {
    label: `SQLite · ${path.relative(process.cwd(), file) || file}`,
    async recordImpression(visitorId, variant) {
      insertImpression.run(visitorId, variant)
    },
    async recordConversion(visitorId, variant) {
      return Number(insertConversion.run(visitorId, variant).changes) === 1
    },
    async readLog() {
      const log: Record<string, { impressions: number; conversions: number }> = {
        a: { impressions: 0, conversions: 0 },
        b: { impressions: 0, conversions: 0 },
      }
      for (const row of counts.all()) {
        const variant = String(row.variant)
        if (!(variant in log)) continue
        if (row.kind === 'impression') log[variant].impressions = Number(row.n)
        if (row.kind === 'conversion') log[variant].conversions = Number(row.n)
      }
      return parseLog(serializeLog(log as ExperimentLog))
    },
  }
}

// --------------------------------------------------------------- Upstash

function openUpstash(url: string, token: string): Store {
  async function run(commands: (string | number)[][]): Promise<unknown[]> {
    const response = await fetch(`${url.replace(/\/$/, '')}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(commands),
      cache: 'no-store',
    })
    if (!response.ok) throw new Error(`Upstash respondió ${response.status}`)
    const items = (await response.json()) as { result?: unknown; error?: string }[]
    for (const item of items) if (item.error) throw new Error(`Upstash: ${item.error}`)
    return items.map((item) => item.result)
  }

  const event = (visitorId: string, variant: Variant, kind: string) =>
    JSON.stringify({ visitorId, variant, kind, at: new Date().toISOString() })

  return {
    label: 'Upstash Redis (REST)',
    async recordImpression(visitorId, variant) {
      await run([
        ['HINCRBY', 'lab:counts', `${variant}:impressions`, 1],
        ['LPUSH', 'lab:events', event(visitorId, variant, 'impression')],
        ['LTRIM', 'lab:events', 0, 9999],
      ])
    },
    async recordConversion(visitorId, variant) {
      // SADD devuelve 1 solo la primera vez que ve a ese visitante.
      const [added] = await run([['SADD', 'lab:converters', visitorId]])
      if (added !== 1) return false
      await run([
        ['HINCRBY', 'lab:counts', `${variant}:conversions`, 1],
        ['LPUSH', 'lab:events', event(visitorId, variant, 'conversion')],
        ['LTRIM', 'lab:events', 0, 9999],
      ])
      return true
    },
    async readLog() {
      const [flat] = await run([['HGETALL', 'lab:counts']])
      const map = new Map<string, number>()
      if (Array.isArray(flat)) {
        for (let i = 0; i + 1 < flat.length; i += 2) map.set(String(flat[i]), Number(flat[i + 1]))
      }
      const log: Record<string, { impressions: number; conversions: number }> = {}
      for (const variant of VARIANT_KEYS) {
        log[variant] = {
          impressions: map.get(`${variant}:impressions`) ?? 0,
          conversions: map.get(`${variant}:conversions`) ?? 0,
        }
      }
      return parseLog(serializeLog(log as ExperimentLog))
    },
  }
}

// ------------------------------------------------------------------ elegir

const holder = globalThis as typeof globalThis & { __labStore?: Store }

export function getStore(): Store {
  if (!holder.__labStore) {
    const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL
    const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN
    holder.__labStore = url && token ? openUpstash(url, token) : openSqlite()
  }
  return holder.__labStore
}
