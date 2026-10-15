import {
  MA_PROFESSOR_OPAQUE_TIMEOUT_MS,
  MAProfessorOpaqueTimeoutError,
  type MAProfessorOpaqueOperation,
  type MAProfessorOpaqueOperations,
  type MAProfessorOpaqueWorkerResponse
} from './opaqueClientTypes'

export {
  MA_PROFESSOR_OPAQUE_TIMEOUT_MS,
  MAProfessorOpaqueTimeoutError
} from './opaqueClientTypes'
export type {
  MAProfessorOpaqueClientRegistrationStart,
  MAProfessorOpaqueClientRegistrationFinish,
  MAProfessorOpaqueClientLoginStart,
  MAProfessorOpaqueClientLoginFinish
} from './opaqueClientTypes'

// Never run two memory-heavy calculations at once in the same page.
let operationQueue: Promise<unknown> = Promise.resolve()

function workerFailure() {
  return new Error('Não foi possível confirmar a password neste navegador. Feche outros separadores e tente novamente.')
}

function runOperation<K extends MAProfessorOpaqueOperation>(
  operation: K,
  args: MAProfessorOpaqueOperations[K]['args'],
  signal?: AbortSignal
): Promise<MAProfessorOpaqueOperations[K]['result']> {
  const pending = operationQueue.then(() => new Promise<MAProfessorOpaqueOperations[K]['result']>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new MAProfessorOpaqueTimeoutError())
      return
    }

    let worker: Worker
    try {
      worker = new Worker(new URL('./opaqueClient.worker.ts', import.meta.url), { type: 'module' })
    } catch {
      reject(workerFailure())
      return
    }

    let settled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const finish = (error: Error | null, result?: MAProfessorOpaqueOperations[K]['result']) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      signal?.removeEventListener('abort', abort)
      worker.onmessage = null
      worker.onerror = null
      worker.onmessageerror = null
      // Wasm memory cannot shrink. Dispose of the entire runtime after every
      // operation instead of retaining its peak allocation for the page lifetime.
      worker.terminate()
      if (error) reject(error)
      else resolve(result as MAProfessorOpaqueOperations[K]['result'])
    }
    const abort = () => finish(new MAProfessorOpaqueTimeoutError())

    worker.onmessage = (event: MessageEvent<MAProfessorOpaqueWorkerResponse>) => {
      if (event.data?.success === true) {
        finish(null, event.data.result as MAProfessorOpaqueOperations[K]['result'])
      } else {
        finish(event.data?.timeout ? new MAProfessorOpaqueTimeoutError() : workerFailure())
      }
    }
    worker.onerror = event => {
      event.preventDefault()
      finish(workerFailure())
    }
    worker.onmessageerror = () => finish(workerFailure())
    signal?.addEventListener('abort', abort, { once: true })
    timer = setTimeout(abort, MA_PROFESSOR_OPAQUE_TIMEOUT_MS)

    try {
      worker.postMessage({ operation, args })
    } catch {
      finish(workerFailure())
    }
  }))
  operationQueue = pending.catch(() => undefined)
  return pending
}

export async function startMAProfessorOpaqueClientRegistration(password: string) {
  return runOperation('startRegistration', [password])
}

export async function finishMAProfessorOpaqueClientRegistration(
  password: string,
  clientRegistrationState: string,
  registrationResponse: string
) {
  return runOperation('finishRegistration', [password, clientRegistrationState, registrationResponse])
}

export async function startMAProfessorOpaqueClientLogin(password: string, signal?: AbortSignal) {
  return runOperation('startLogin', [password], signal)
}

export async function finishMAProfessorOpaqueClientLogin(
  password: string,
  clientLoginState: string,
  loginResponse: string,
  signal?: AbortSignal
) {
  return runOperation('finishLogin', [password, clientLoginState, loginResponse], signal)
}
