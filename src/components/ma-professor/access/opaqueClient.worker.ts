import {
  finishMAProfessorOpaqueClientLogin,
  finishMAProfessorOpaqueClientRegistration,
  startMAProfessorOpaqueClientLogin,
  startMAProfessorOpaqueClientRegistration
} from './opaqueClientRuntime'
import {
  MAProfessorOpaqueTimeoutError,
  type MAProfessorOpaqueWorkerRequest,
  type MAProfessorOpaqueWorkerResponse
} from './opaqueClientTypes'

async function execute(request: MAProfessorOpaqueWorkerRequest) {
  switch (request.operation) {
    case 'startRegistration': return startMAProfessorOpaqueClientRegistration(...request.args)
    case 'finishRegistration': return finishMAProfessorOpaqueClientRegistration(...request.args)
    case 'startLogin': return startMAProfessorOpaqueClientLogin(...request.args)
    case 'finishLogin': return finishMAProfessorOpaqueClientLogin(...request.args)
  }
}

self.onmessage = async (event: MessageEvent<MAProfessorOpaqueWorkerRequest>) => {
  let response: MAProfessorOpaqueWorkerResponse
  try {
    response = { success: true, result: await execute(event.data) }
  } catch (error) {
    // Do not send vendor errors or credential material to the page/logs.
    response = { success: false, timeout: error instanceof MAProfessorOpaqueTimeoutError }
  }
  self.postMessage(response)
}
