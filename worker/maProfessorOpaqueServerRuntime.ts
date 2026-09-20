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

const opaqueReady =
  init({
    module_or_path:
      opaqueModule
  })

const serverRuntime:
  MAProfessorOpaqueServerRuntime = {
    createServerSetup,
    createServerRegistrationResponse,
    startServerLogin,
    finishServerLogin
  }

export async function getMAProfessorOpaqueServerRuntime():
  Promise<MAProfessorOpaqueServerRuntime> {
  await opaqueReady

  return serverRuntime
}
