import {
  type RefObject,
  useEffect
} from 'react'

const DEFAULT_MESSAGE =
  'Existem alterações por guardar. Se continuar, essas alterações serão perdidas. Pretende continuar?'

function getSelectInteractionTarget(
  target: EventTarget | null
): HTMLSelectElement | null {
  if (
    !(target instanceof Element)
  ) {
    return null
  }

  const directSelect =
    target.closest(
      'select'
    )

  if (
    directSelect instanceof
      HTMLSelectElement
  ) {
    return directSelect
  }

  const label =
    target.closest(
      'label'
    )

  const labelledSelect =
    label?.querySelector(
      'select'
    ) ?? null

  return labelledSelect instanceof
      HTMLSelectElement
    ? labelledSelect
    : null
}

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

    const previousSelectValues =
      new WeakMap<
        HTMLSelectElement,
        string
      >()

    const getExternalSelect = (
      target: EventTarget | null
    ) => {
      const select =
        getSelectInteractionTarget(
          target
        )

      if (
        !select ||
        rootRef.current?.contains(
          select
        )
      ) {
        return null
      }

      return select
    }

    const rememberExternalSelectValue = (
      event: Event
    ) => {
      const select =
        getExternalSelect(
          event.target
        )

      if (!select) {
        return
      }

      previousSelectValues.set(
        select,
        select.value
      )
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
        getSelectInteractionTarget(
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

    const handleExternalChange = (
      event: Event
    ) => {
      const select =
        getExternalSelect(
          event.target
        )

      if (!select) {
        return
      }

      if (
        window.confirm(
          message
        )
      ) {
        previousSelectValues.set(
          select,
          select.value
        )
        return
      }

      const previousValue =
        previousSelectValues.get(
          select
        )

      if (
        previousValue !== undefined
      ) {
        select.value =
          previousValue
      }

      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
    }

    document.addEventListener(
      'focusin',
      rememberExternalSelectValue,
      true
    )
    document.addEventListener(
      'pointerdown',
      rememberExternalSelectValue,
      true
    )
    document.addEventListener(
      'keydown',
      rememberExternalSelectValue,
      true
    )
    document.addEventListener(
      'click',
      handleExternalClick,
      true
    )
    document.addEventListener(
      'change',
      handleExternalChange,
      true
    )

    return () => {
      document.removeEventListener(
        'focusin',
        rememberExternalSelectValue,
        true
      )
      document.removeEventListener(
        'pointerdown',
        rememberExternalSelectValue,
        true
      )
      document.removeEventListener(
        'keydown',
        rememberExternalSelectValue,
        true
      )
      document.removeEventListener(
        'click',
        handleExternalClick,
        true
      )
      document.removeEventListener(
        'change',
        handleExternalChange,
        true
      )
    }
  }, [
    hasUnsavedChanges,
    message,
    rootRef
  ])
}
