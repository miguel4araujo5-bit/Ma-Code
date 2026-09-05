import {
  type RefObject,
  useEffect
} from 'react'

const DEFAULT_MESSAGE =
  'Existem alterações por guardar. Se continuar, essas alterações serão perdidas. Pretende continuar?'

export function useMAProfessorUnsavedWorkspaceProtection(
  hasUnsavedChanges: boolean,
  rootRef: RefObject<HTMLElement | null>,
  message = DEFAULT_MESSAGE
) {
  useEffect(() => {
    if (!hasUnsavedChanges) {
      return
    }

    const handleBeforeUnload = (
      event: BeforeUnloadEvent
    ) => {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener(
      'beforeunload',
      handleBeforeUnload
    )

    return () => {
      window.removeEventListener(
        'beforeunload',
        handleBeforeUnload
      )
    }
  }, [
    hasUnsavedChanges
  ])

  useEffect(() => {
    if (!hasUnsavedChanges) {
      return
    }

    const handleExternalClick = (
      event: MouseEvent
    ) => {
      const target =
        event.target

      if (
        !(target instanceof Node) ||
        rootRef.current?.contains(
          target
        )
      ) {
        return
      }

      if (
        window.confirm(
          message
        )
      ) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
    }

    document.addEventListener(
      'click',
      handleExternalClick,
      true
    )

    return () => {
      document.removeEventListener(
        'click',
        handleExternalClick,
        true
      )
    }
  }, [
    hasUnsavedChanges,
    message,
    rootRef
  ])
}
