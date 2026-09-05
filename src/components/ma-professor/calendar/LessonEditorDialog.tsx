import {
  type ComponentProps,
  type FormEvent,
  type MouseEvent,
  useEffect,
  useRef,
  useState
} from 'react'

import {
  useMAProfessorUnsavedWorkspaceProtection
} from '../navigation/useUnsavedWorkspaceProtection'

import type {
  Lesson,
  LessonStatus
} from '../types'

import LessonEditorDialogBase from './LessonEditorDialogBase'

type LessonEditorDialogProps =
  ComponentProps<typeof LessonEditorDialogBase>

type EditorSectionKind =
  | 'main'
  | 'attendance'
  | 'assessment'

const DISCARD_MESSAGE =
  'Existem alterações por guardar nesta aula. Se continuar, essas alterações serão perdidas. Pretende continuar?'

const ATTENDANCE_SAVE_MESSAGE =
  'Existem alterações de assiduidade por guardar. Mantenha a aula marcada como dada para guardar essas alterações. Se pretender descartá-las, feche o editor e confirme o respetivo descarte.'

const ASSESSMENT_REMOVE_MESSAGE =
  'Existem alterações na nova avaliação por guardar. Remover esta avaliação irá perder essas alterações. Pretende continuar?'

function getButtonLabel(
  event: MouseEvent<HTMLDivElement>
) {
  const target = event.target

  if (!(target instanceof Element)) {
    return ''
  }

  return (
    target
      .closest('button')
      ?.textContent
      ?.trim() ??
    ''
  )
}

function getEditorSectionKind(
  target: EventTarget | null
): EditorSectionKind {
  if (!(target instanceof Element)) {
    return 'main'
  }

  const section =
    target.closest('section')

  if (
    !section ||
    section.getAttribute(
      'aria-labelledby'
    ) === 'lesson-editor-title'
  ) {
    return 'main'
  }

  const text =
    section.textContent ?? ''

  if (
    text.includes('Assiduidade')
  ) {
    return 'attendance'
  }

  if (
    text.includes('Avaliações da aula')
  ) {
    return 'assessment'
  }

  return 'main'
}

export default function LessonEditorDialog(
  props: LessonEditorDialogProps
) {
  const rootRef =
    useRef<HTMLDivElement>(null)

  const [
    formDirty,
    setFormDirty
  ] = useState(false)

  const [
    attendanceDirty,
    setAttendanceDirty
  ] = useState(false)

  const [
    assessmentDirty,
    setAssessmentDirty
  ] = useState(false)

  const [
    currentStatus,
    setCurrentStatus
  ] = useState<LessonStatus>(
    props.context.lessonRow.lesson.status
  )

  const [
    guardError,
    setGuardError
  ] = useState('')

  const lessonId =
    props.context.lessonRow.lesson.id

  const hasUnsavedLessonChanges =
    formDirty ||
    attendanceDirty ||
    assessmentDirty

  useMAProfessorUnsavedWorkspaceProtection(
    hasUnsavedLessonChanges,
    rootRef,
    DISCARD_MESSAGE
  )

  useEffect(() => {
    setFormDirty(false)
    setAttendanceDirty(false)
    setAssessmentDirty(false)
    setCurrentStatus(
      props.context.lessonRow.lesson.status
    )
    setGuardError('')
  }, [
    lessonId
  ])

  function confirmDiscardLessonChanges() {
    return (
      !hasUnsavedLessonChanges ||
      window.confirm(
        DISCARD_MESSAGE
      )
    )
  }

  function requestClose() {
    if (
      !confirmDiscardLessonChanges()
    ) {
      return
    }

    props.onClose()
  }

  function markSectionDirty(
    kind: EditorSectionKind
  ) {
    if (
      kind === 'attendance'
    ) {
      setAttendanceDirty(true)
      return
    }

    if (
      kind === 'assessment'
    ) {
      setAssessmentDirty(true)
      return
    }

    setFormDirty(true)
  }

  function handleEditorChangeCapture(
    event: FormEvent<HTMLDivElement>
  ) {
    markSectionDirty(
      getEditorSectionKind(
        event.target
      )
    )

    setGuardError('')
  }

  function handleAttendanceClickCapture(
    label: string
  ) {
    if (
      label === 'Presente' ||
      label === 'Falta' ||
      label === 'Marcar todos presentes'
    ) {
      setAttendanceDirty(true)
      setGuardError('')
    }
  }

  function handleAssessmentClickCapture(
    event: MouseEvent<HTMLDivElement>,
    label: string
  ) {
    if (
      label === '+ Nova avaliação'
    ) {
      setAssessmentDirty(true)
      setGuardError('')
      return
    }

    if (
      label !== 'Remover nova avaliação' ||
      !assessmentDirty
    ) {
      return
    }

    if (
      window.confirm(
        ASSESSMENT_REMOVE_MESSAGE
      )
    ) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    event.nativeEvent.stopImmediatePropagation()
  }

  function handleMainClickCapture(
    label: string
  ) {
    const statusByLabel: Partial<
      Record<string, LessonStatus>
    > = {
      Planeada: 'planned',
      Dada: 'taught',
      Cancelada: 'cancelled',
      'Marcar como dada': 'taught'
    }

    const nextStatus =
      statusByLabel[label]

    if (
      nextStatus
    ) {
      if (
        nextStatus !== currentStatus
      ) {
        setFormDirty(true)
      }

      setCurrentStatus(
        nextStatus
      )

      if (
        nextStatus === 'taught'
      ) {
        setGuardError('')
      }

      return
    }

    if (
      label === 'Usar próximo item' ||
      label === 'Copiar aula anterior' ||
      label === 'Desligar da planificação' ||
      label === 'Manter pendente' ||
      label === 'Marcar como submetido'
    ) {
      setFormDirty(true)
      setGuardError('')
    }
  }

  function handleEditorClickCapture(
    event: MouseEvent<HTMLDivElement>
  ) {
    const label =
      getButtonLabel(
        event
      )

    if (
      !label
    ) {
      return
    }

    const kind =
      getEditorSectionKind(
        event.target
      )

    if (
      kind === 'attendance'
    ) {
      handleAttendanceClickCapture(
        label
      )
      return
    }

    if (
      kind === 'assessment'
    ) {
      handleAssessmentClickCapture(
        event,
        label
      )
      return
    }

    handleMainClickCapture(
      label
    )
  }

  function handleSubmitCapture(
    event: FormEvent<HTMLDivElement>
  ) {
    if (
      currentStatus !== 'taught' &&
      attendanceDirty
    ) {
      event.preventDefault()
      event.stopPropagation()
      event.nativeEvent.stopImmediatePropagation()

      setGuardError(
        ATTENDANCE_SAVE_MESSAGE
      )
    }
  }

  async function handleSaved(
    lesson: Lesson
  ) {
    setFormDirty(false)
    setAttendanceDirty(false)
    setAssessmentDirty(false)
    setGuardError('')

    await props.onSaved(
      lesson
    )
  }

  return (
    <div
      ref={rootRef}
      onChangeCapture={
        handleEditorChangeCapture
      }
      onClickCapture={
        handleEditorClickCapture
      }
      onSubmitCapture={
        handleSubmitCapture
      }
    >
      {guardError ? (
        <div
          role="alert"
          className="fixed left-1/2 top-4 z-[130] w-[min(42rem,calc(100%-2rem))] -translate-x-1/2 rounded-2xl border border-rose-300/25 bg-slate-950/95 p-4 text-sm leading-6 text-rose-50 shadow-2xl shadow-black/50 backdrop-blur-xl"
        >
          {guardError}
        </div>
      ) : null}

      <LessonEditorDialogBase
        {...props}
        onClose={requestClose}
        onSaved={handleSaved}
      />
    </div>
  )
}
