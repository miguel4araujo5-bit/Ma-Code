import { DatabaseSync } from 'node:sqlite'
import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

// Run the production Worker and SQL in browser tests; only D1/DO bindings are local.
export async function createCloudBackupWorkerHarness(email, token) {
  let acceptedToken = token

  const source = await readFile(new URL('../../worker/maProfessorCloudBackup.ts', import.meta.url), 'utf8')
  const timedSource = source.replaceAll('Date.now()', 'testNow()') + '\nlet testClock = Date.now(); function testNow() { return testClock } export function advanceTestClock(ms) { testClock += ms }'
  const output = await build({ stdin: { contents: timedSource, loader: 'ts', resolveDir: fileURLToPath(new URL('../../worker/', import.meta.url)) }, bundle: true, write: false, format: 'esm', platform: 'node' })
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
        async run() {
          // Match D1 metadata, including ciphertext archive/pruning triggers.
          const before = db.prepare('SELECT total_changes() AS count').get().count
          db.prepare(sql).run(...values)
          const changes = db.prepare('SELECT total_changes() AS count').get().count - before
          return { success: true, meta: { changes: Number(changes) } }
        }
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
      return Response.json(body.token === acceptedToken ? { success: true, license: { email, status: 'active' } } : { success: false }, { status: body.token === acceptedToken ? 200 : 401 })
    } })
  } }
  return {
    handle: request => worker.handleMAProfessorCloudBackupApiRequest(request, env),
    setToken: value => { acceptedToken = value },
    advance: milliseconds => worker.advanceTestClock(milliseconds),
    close: () => db.close()
  }
}
