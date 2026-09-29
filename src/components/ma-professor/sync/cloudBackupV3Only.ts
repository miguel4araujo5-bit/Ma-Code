import type {
  MAProfessorAccessSession
} from '../access/accessTypes'

import type {
  MAProfessorBackup
} from '../types'

import {
  inspectMAProfessorCloudBackup,
  MAProfessorCloudBackupRevisionConflictError,
  uploadAndVerifyCompatibleMAProfessorCloudBackup,
  uploadAndVerifyMAProfessorCloudBackupV3,
  type MAProfessorCloudBackupUploadOptions,
  type MAProfessorUploadedCloudBackup
} from './cloudBackupService'

/**
 * Único ponto de escrita usado pelos fluxos atuais de produção.
 *
 * Uma conta sem perfil remoto ainda precisa do inicializador v3 que vive no
 * serviço base. Depois de existir perfil, só aceitamos explicitamente v3.
 * Perfis legados nunca são encaminhados para o escritor v2.
 */
export async function uploadAndVerifyMAProfessorCloudBackupV3Only(
  session: MAProfessorAccessSession,
  backup: MAProfessorBackup,
  options: MAProfessorCloudBackupUploadOptions = {}
): Promise<MAProfessorUploadedCloudBackup> {
  const status =
    await inspectMAProfessorCloudBackup(
      session
    )

  if (
    options.expectedServerRevision !== undefined &&
    status.serverRevision !==
      options.expectedServerRevision
  ) {
    throw new MAProfessorCloudBackupRevisionConflictError()
  }

  const forwardedOptions = {
    ...options,
    expectedServerRevision:
      status.serverRevision
  }

  if (status.cryptoVersion === null) {
    return uploadAndVerifyCompatibleMAProfessorCloudBackup(
      session,
      backup,
      forwardedOptions
    )
  }

  if (status.cryptoVersion !== 3) {
    throw new Error(
      'Esta conta apresenta uma proteção de cópia antiga e não pode ser usada pelo fluxo v3 atual.'
    )
  }

  return uploadAndVerifyMAProfessorCloudBackupV3(
    session,
    backup,
    forwardedOptions
  )
}
