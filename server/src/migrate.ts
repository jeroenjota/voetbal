import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import mariadb from 'mariadb'
import { dbOptions, pool } from './db'

// Every migration is idempotent (IF NOT EXISTS), so running them again is safe.
const directory = fileURLToPath(new URL('../migrations/', import.meta.url))
const connection = await mariadb.createConnection({ ...dbOptions, multipleStatements: true })
try {
  for (const file of (await readdir(directory)).filter((name) => name.endsWith('.sql')).sort()) {
    await connection.query(await readFile(directory + file, 'utf8'))
    console.log(`Migratie uitgevoerd: ${file}`)
  }
} finally {
  await connection.end()
  await pool.end()
}
