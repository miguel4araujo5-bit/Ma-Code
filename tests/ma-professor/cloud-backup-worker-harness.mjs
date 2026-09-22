import { DatabaseSync } from 'node:sqlite'
import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

// Run the production Worker and SQL in browser tests; only D1/DO bindings are local.
export async function createCloudBackupWorkerHarness(email, token) {
  const output = await build({ entryPoints: [fileURLToPath(new URL('../../worker/maProfessorCloudBackup.ts', import.meta.url))], bundle: true, write: false, format: 'esm', platform: 'node' })
  const worker = await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].text).toString('base64')}`)
  const db = new DatabaseSync(':memory:')
  const migrations = new URL('../../migrations/ma-professor/', import.meta.url)
  for (const name of (await readdir(migrations)).filter(name => name.endsWith('.sql')).sort()) db.exec(await readFile(new URL(name, migrations), 'utf8'))
  let queue = Promise.resolve()
  const binding = {
    prepare(sql) {
      let values = []
      return { bind(...args) { values = args; return this },
        async first() { return db.prepare(sql).get(...values) ?? null },
        async run() { return { success: true, meta: { changes: Number(db.prepare(sql).run(...values).changes) } } }
      }
    },
    batch(statements) {
      const result = queue.then(async () => {
        db.exec('BEGIN')
        try { const results = []; for (const s of statements) results.push(await s.run()); db.exec('COMMIT'); return results }
        catch (error) { db.exec('ROLLBACK'); throw error }
      })
      queue = result.then(() => {}, () => {})
      return result
    }
  }
  const env = { MA_PROFESSOR_DB: binding, MA_PROFESSOR_ACCESS: {
    idFromName: name => name, get: () => ({ fetch: async request => {
      const body = await request.json()
      return Response.json(body.token === token ? { success: true, license: { email, status: 'active' } } : { success: false }, { status: body.token === token ? 200 : 401 })
    } })
  } }
  return { handle: request => worker.handleMAProfessorCloudBackupApiRequest(request, env), close: () => db.close() }
}
