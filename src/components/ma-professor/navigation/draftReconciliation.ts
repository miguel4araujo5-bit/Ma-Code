export function hasMAProfessorDirtyDraftRecord<T>(
  persisted: Record<string, T>,
  drafts: Record<string, T>
) {
  const persistedKeys = Object.keys(persisted)
  const draftKeys = Object.keys(drafts)

  if (
    persistedKeys.length !== draftKeys.length
  ) {
    return true
  }

  return persistedKeys.some(key =>
    JSON.stringify(persisted[key]) !==
    JSON.stringify(drafts[key])
  )
}

export function reconcileMAProfessorDraftRecord<T>(
  previousPersisted: Record<string, T>,
  currentDrafts: Record<string, T>,
  nextPersisted: Record<string, T>
): Record<string, T> {
  return Object.fromEntries(
    Object.entries(nextPersisted).map(
      ([key, nextValue]) => {
        const previousValue =
          previousPersisted[key]
        const currentValue =
          currentDrafts[key]

        const dirty =
          currentValue !== undefined &&
          JSON.stringify(currentValue) !==
            JSON.stringify(previousValue)

        return [
          key,
          dirty
            ? currentValue
            : nextValue
        ]
      }
    )
  ) as Record<string, T>
}
