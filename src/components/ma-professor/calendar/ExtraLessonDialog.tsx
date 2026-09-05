import {
  type MouseEvent,
  useRef,
  useState
} from 'react'

import {
  useMAProfessorUnsavedWorkspaceProtection
} from '../navigation/useUnsavedWorkspaceProtection'

import type {
  Lesson
} from '../types'

import type {
  ExtraLessonCreateContext
} from './extraLessonRepository'

import ExtraLessonDialogBase from './ExtraLessonDialogBase'

type ExtraLessonDialogProps = {
  context: ExtraLessonCreateContext
  onClose: () => void
  onCreated: (lesson: Lesson) => void | Promise<void>
}

const UNSAVED_EXTRA_LESSON_MESSAGE =
  'Existem alterações na aula extra por guardar. Se fechar este ecrã, essas alterações serão perdidas. Pretende continuar?'

export default function ExtraLessonDialog({
  context,
  onClose,
  onCreated
}: ExtraLessonDialogProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [hasUserChanges, setHasUserChanges] =
    useState(false)

  function markUserChange() {
    setHasUserChanges(true)
  }

  function confirmDiscardExtraLessonChanges() {
    if (!hasUserChanges) {
      return true
    }

    return window.confirm(
      UNSAVED_EXTRA_LESSON_MESSAGE
    )
  }

  function requestClose() {
    if (!confirmDiscardExtraLessonChanges()) {
      return
    }

    onClose()
  }

  function handleUserActionCapture(
    event: MouseEvent<HTMLDivElement>
  ) {
    const target = event.target

    if (!(target instanceof Element)) {
      return
    }

    const button = target.closest('button')

    if (
      !(button instanceof HTMLButtonElement) ||
      button.disabled ||
      button.type === 'submit'
    ) {
      return
    }

    const ariaLabel =
      button.getAttribute('aria-label')?.trim() ?? ''

    const text =
      button.textContent?.trim() ?? ''

    if (
      ariaLabel === 'Fechar criação da aula extra' ||
      text === 'Fechar' ||
      text === 'Cancelar'
    ) {
      return
    }

    markUserChange()
  }

  async function handleCreated(lesson: Lesson) {
    setHasUserChanges(false)
    await onCreated(lesson)
  }

  useMAProfessorUnsavedWorkspaceProtection(
    hasUserChanges,
    rootRef,
    UNSAVED_EXTRA_LESSON_MESSAGE
  )

  return (
    <div
      ref={rootRef}
      className="contents"
      onChangeCapture={markUserChange}
      onClickCapture={handleUserActionCapture}
    >
      <ExtraLessonDialogBase
        context={context}
        onClose={requestClose}
        onCreated={handleCreated}
      />
    </div>
  )
}
