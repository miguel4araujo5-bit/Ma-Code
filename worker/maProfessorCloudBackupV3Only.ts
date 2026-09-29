import {
  MA_PROFESSOR_CLOUD_BACKUP_API_PREFIX,
  handleMAProfessorCloudBackupApiRequest as handleLegacyCompatibleCloudBackupRequest,
  isMAProfessorCloudBackupApiPath as isCloudBackupApiPath,
  type MaProfessorCloudBackupEnv
} from './maProfessorCloudBackup'

const LEGACY_V2_PATHS = new Set([
  '/key',
  '/push',
  '/promote-v3'
])

export type { MaProfessorCloudBackupEnv }

export function isMAProfessorCloudBackupApiPath(
  pathname: string
) {
  return isCloudBackupApiPath(pathname)
}

export function isLegacyMAProfessorCloudBackupPath(
  pathname: string
) {
  if (!pathname.startsWith(MA_PROFESSOR_CLOUD_BACKUP_API_PREFIX)) {
    return false
  }

  const suffix = pathname.slice(
    MA_PROFESSOR_CLOUD_BACKUP_API_PREFIX.length
  )

  return LEGACY_V2_PATHS.has(suffix)
}

function legacyV2RemovedResponse() {
  return new Response(
    JSON.stringify({
      success: false,
      status: 'legacy-backup-version-removed',
      message:
        'Esta versão antiga das cópias online já não é suportada.'
    }),
    {
      status: 410,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store'
      }
    }
  )
}

export async function handleMAProfessorCloudBackupApiRequest(
  request: Request,
  env: MaProfessorCloudBackupEnv
) {
  const pathname = new URL(request.url).pathname

  if (isLegacyMAProfessorCloudBackupPath(pathname)) {
    return legacyV2RemovedResponse()
  }

  return handleLegacyCompatibleCloudBackupRequest(
    request,
    env
  )
}
