import { PGlite } from '@electric-sql/pglite'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const sqlDir = join(here, '..')

/** schema.sql primero y después 002_…, 003_… en orden. */
export const migrationFiles = () => [
  'schema.sql',
  ...readdirSync(sqlDir).filter((f) => /^\d{3}_.*\.sql$/.test(f)).sort(),
]

export const migrate = (db, file) => db.exec(readFileSync(join(sqlDir, file), 'utf8'))

/** Postgres limpio con el arnés de Supabase y las migraciones hasta `upTo` (inclusive). */
export async function newDb({ upTo } = {}) {
  const db = new PGlite()
  await db.exec(readFileSync(join(here, '00_harness.sql'), 'utf8'))
  for (const f of migrationFiles()) {
    await migrate(db, f)
    if (f === upTo) break
  }
  return db
}

/**
 * Ejecuta `fn(q)` como lo haría la API de Supabase: rol `anon` o `authenticated`
 * con el usuario `uid` en el token. Todo se revierte al terminar.
 */
export async function as(db, { role = 'authenticated', uid = null }, fn) {
  await db.exec('begin')
  try {
    await db.exec(`set local role ${role}`)
    if (uid) await db.exec(`set local request.jwt.claim.sub = '${uid}'`)
    return await fn((sql, params) => db.query(sql, params))
  } finally {
    await db.exec('rollback')
  }
}

/** Igual que `as`, pero conserva los cambios (para funciones que deben dejar datos). */
export async function asCommit(db, { role = 'authenticated', uid = null }, fn) {
  await db.exec('begin')
  try {
    await db.exec(`set local role ${role}`)
    if (uid) await db.exec(`set local request.jwt.claim.sub = '${uid}'`)
    const out = await fn((sql, params) => db.query(sql, params))
    await db.exec('commit')
    return out
  } catch (e) {
    await db.exec('rollback')
    throw e
  }
}

export const user = async (db, email, confirmed = true) =>
  (await db.query(
    'insert into auth.users (email, email_confirmed_at) values ($1, $2) returning id',
    [email, confirmed ? new Date() : null],
  )).rows[0].id
