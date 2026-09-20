import opaqueModule from './vendor/ma-professor-opaque/opaque_bg.wasm'

import init, {
  createServerRegistrationResponse,
  createServerSetup,
  finishServerLogin,
  startServerLogin
} from './vendor/ma-professor-opaque/opaque.js'

import type {
  MAProfessorOpaqueServerRuntime
} from './maProfessorOpaqueAuthProtocol'

let opaqueReady:
  Promise<unknown> |
  null =
  null

const serverRuntime:
  MAProfessorOpaqueServerRuntime = {
    createServerSetup,
    createServerRegistrationResponse,
    startServerLogin,
    finishServerLogin
  }

function ensureOpaqueReady() {
  if (!opaqueReady) {
    opaqueReady =
      init({
        module_or_path:
          opaqueModule
      })
  }

  return opaqueReady
}

export async function getMAProfessorOpaqueServerRuntime():
  Promise<MAProfessorOpaqueServerRuntime> {
  await ensureOpaqueReady()

  return serverRuntime
}
