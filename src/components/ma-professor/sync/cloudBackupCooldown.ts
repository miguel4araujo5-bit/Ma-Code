import { useEffect, useState } from 'react'

export const CLOUD_BACKUP_INTERVAL_MS = 30_000
const retryTimes = new Map<string, number>()
const CHANGE_EVENT = 'ma-professor-cloud-backup-cooldown'

export function cloudBackupRetryDelay(email: string) {
  return Math.max(0, (retryTimes.get(email.trim().toLowerCase()) ?? 0) - Date.now())
}

export function deferCloudBackupUpload(email: string, delay: number) {
  const account = email.trim().toLowerCase()
  retryTimes.set(account, Math.max(retryTimes.get(account) ?? 0, Date.now() + delay))
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CHANGE_EVENT))
}

export class MAProfessorCloudBackupCooldownError extends Error {
  constructor() {
    super('Aguarde 30 segundos entre envios de cópias online. Depois, confirme novamente o envio.')
    this.name = 'MAProfessorCloudBackupCooldownError'
  }
}

export function reserveCloudBackupUpload(email: string) {
  if (cloudBackupRetryDelay(email) > 0) throw new MAProfessorCloudBackupCooldownError()
  deferCloudBackupUpload(email, CLOUD_BACKUP_INTERVAL_MS)
}

export function useCloudBackupCooldown(email: string) {
  const [waiting, setWaiting] = useState(() => cloudBackupRetryDelay(email) > 0)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const update = () => {
      clearTimeout(timer)
      const delay = cloudBackupRetryDelay(email)
      setWaiting(delay > 0)
      if (delay > 0) timer = setTimeout(update, delay)
    }
    update()
    window.addEventListener(CHANGE_EVENT, update)
    return () => {
      clearTimeout(timer)
      window.removeEventListener(CHANGE_EVENT, update)
    }
  }, [email])
  return waiting
}
