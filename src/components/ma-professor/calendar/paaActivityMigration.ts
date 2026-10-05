import type { EntityId, PAAActivity } from '../types'

export function isPAAActivity(value: unknown, academicYearId: EntityId): value is PAAActivity {
  if (typeof value !== 'object' || value === null) return false
  const row = value as Record<string, unknown>
  return typeof row.id === 'string' && Boolean(row.id.trim()) &&
    row.academicYearId === academicYearId &&
    typeof row.title === 'string' && typeof row.date === 'string' &&
    typeof row.description === 'string' &&
    (row.source === 'manual' || row.source === 'imported') &&
    typeof row.createdAt === 'string' && typeof row.updatedAt === 'string'
}

// Só a atualização da base local lê o armazenamento anterior. Nunca o
// reaplicar depois de um restauro/reset, nem apagar a origem durante a migração.
export function readLegacyPAAActivities(academicYearIds: EntityId[]): PAAActivity[] {
  if (typeof window === 'undefined') return []
  try {
    return academicYearIds.flatMap(academicYearId => {
      const raw = window.localStorage.getItem(`ma-professor:paa:${academicYearId}`)
      if (raw === null) return []
      const parsed: unknown = JSON.parse(raw)
      if (!Array.isArray(parsed) || !parsed.every(row => isPAAActivity(row, academicYearId))) {
        throw new Error('Dados do PAA inválidos.')
      }
      return parsed
    })
  } catch {
    throw new Error('Não foi possível transferir as atividades do PAA para o armazenamento local protegido. Os dados anteriores não foram apagados. Tente novamente neste browser.')
  }
}
