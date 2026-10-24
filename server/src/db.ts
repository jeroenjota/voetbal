import { config } from 'dotenv'
import { fileURLToPath } from 'node:url'
import mariadb from 'mariadb'
import type { PoolConnection } from 'mariadb'

config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true })

function env(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback
  if (value === undefined) throw new Error(`Omgevingsvariabele ${name} ontbreekt (zie server/.env.example).`)
  return value
}

export const dbOptions = {
  host: env('DB_HOST', '127.0.0.1'),
  port: Number(env('DB_PORT', '3306')),
  user: env('DB_USER'),
  password: env('DB_PASSWORD'),
  database: env('DB_NAME', 'voetbalpool'),
  dateStrings: true,
  bigIntAsNumber: true,
  insertIdAsNumber: true,
  decimalAsNumber: true,
}

export const pool = mariadb.createPool({ ...dbOptions, connectionLimit: 5 })

export type Db = Pick<PoolConnection, 'query'>

export async function query<T = Record<string, unknown>>(sql: string, params: unknown[] = [], db: Db = pool): Promise<T[]> {
  const rows = await db.query(sql, params)
  return Array.isArray(rows) ? [...rows] as T[] : []
}

export async function execute(sql: string, params: unknown[] = [], db: Db = pool): Promise<{ insertId: number; affectedRows: number }> {
  return db.query(sql, params)
}

export async function transaction<T>(work: (db: PoolConnection) => Promise<T>): Promise<T> {
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const result = await work(connection)
    await connection.commit()
    return result
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}
