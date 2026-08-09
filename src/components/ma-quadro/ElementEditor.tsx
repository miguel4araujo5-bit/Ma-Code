import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ChangeEvent
} from 'react'

import {
  createPortal
} from 'react-dom'

import {
  createMAQuadroLibraryElementFile,
  createMAQuadroLibraryElementObjectName,
  createMAQuadroLibraryElementPreviewUrl,
  getMAQuadroLibraryElement,
  MA_QUADRO_ELEMENT_MAX_STROKE,
  MA_QUADRO_ELEMENT_MIN_STROKE,
  readMAQuadroLibraryElementDocumentFromName,
  updateMAQuadroLibraryElementDocument,
  type MAQuadroLibraryElementDocument
} from '../../lib/maQuadro/elementLibrary'

import {
  useMAQuadroEditorContext
} from './editorContext'

function createFileChangeEvent(
  file: File
) {
  const files = {
    0: file,
    length: 1,

    item: (
      index: number
    ) =>
      index === 0
        ? file
        : null
  } as unknown as FileList

  const input = {
    files,
    value: ''
  } as unknown as HTMLInputElement

  return {
    currentTarget: input,
    target: input
  } as unknown as ChangeEvent<HTMLInputElement>
}

export default function ElementEditor() {
  const editor =
    useMAQuadroEditorContext()

  const sourceDocument =
    useMemo(() => {
      if (
        editor.selection.count !== 1 ||
        editor.selection.role !==
          'image'
      ) {
        return null
      }

      return readMAQuadroLibraryElementDocumentFromName(
        editor.selection.name
      )
    }, [
      editor.selection.count,
      editor.selection.name,
      editor.selection.role
    ])

  const [
    host,
    setHost
  ] = useState<HTMLElement | null>(
    null
  )

  const [
    draft,
    setDraft
  ] = useState<MAQuadroLibraryElementDocument | null>(
    null
  )

  const [
    saving,
    setSaving
  ] = useState(false)

  const [
    message,
    setMessage
  ] = useState('')

  useEffect(() => {
    setDraft(
      sourceDocument
    )

    setMessage('')
  }, [
    editor.activePage?.id,
    editor.project?.id,
    editor.selection.name,
    sourceDocument
  ])

  useLayoutEffect(() => {
    if (
      !editor.ready ||
      !sourceDocument
    ) {
      setHost(null)
      return
    }

    const scroll =
      document.querySelector<HTMLElement>(
        '.mq-properties-panel .mq-properties-panel__scroll'
      )

    if (!scroll) {
      setHost(null)
      return
    }

    const mount =
      document.createElement(
        'div'
      )

    mount.className =
      'mq-element-editor-host'

    scroll.prepend(
      mount
    )

    setHost(mount)

    return () => {
      mount.remove()
    }
  }, [
    editor.ready,
    editor.selection.name,
    sourceDocument
  ])

  if (
    !host ||
    !sourceDocument ||
    !draft
  ) {
    return null
  }

  const definition =
    getMAQuadroLibraryElement(
      draft.elementId
    )

  if (!definition) {
    return null
  }

  const locked =
    editor.busy ||
    editor.structureBusy ||
    editor.imageCropEditing ||
    saving

  const dirty =
    JSON.stringify(draft) !==
    JSON.stringify(sourceDocument)

  const update = <
    Key extends keyof MAQuadroLibraryElementDocument
  >(
    key: Key,
    value:
      MAQuadroLibraryElementDocument[Key]
  ) => {
    setDraft((current) => {
      if (!current) {
        return current
      }

      return updateMAQuadroLibraryElementDocument(
        current,
        {
          [key]: value
        }
      ) || current
    })

    setMessage('')
  }

  const reset = () => {
    setDraft(
      sourceDocument
    )

    setMessage('')
  }

  const apply =
    async () => {
      if (
        locked ||
        !dirty
      ) {
        return
      }

      setSaving(true)
      setMessage('')

      try {
        const file =
          createMAQuadroLibraryElementFile(
            draft
          )

        editor.setSelectionName(
          createMAQuadroLibraryElementObjectName(
            draft
          )
        )

        await editor
          .replaceSelectedImage(
            createFileChangeEvent(
              file
            )
          )

        setMessage(
          'Elemento atualizado.'
        )
      } catch {
        setMessage(
          'Não foi possível atualizar o elemento.'
        )
      } finally {
        setSaving(false)
      }
    }

  return createPortal(
    <section
      className="mq-element-editor"
      aria-label={`Editar ${definition.name}`}
    >
      <div className="mq-element-editor__heading">
        <div>
          <strong>
            {definition.name}
          </strong>

          <small>
            Forma / ícone da biblioteca local
          </small>
        </div>

        {dirty ? (
          <span>
            Alterado
          </span>
        ) : null}
      </div>

      <div className="mq-element-editor__preview">
        <img
          src={
            createMAQuadroLibraryElementPreviewUrl(
              draft
            )
          }
          alt=""
        />
      </div>

      <label className="mq-element-editor__field">
        <span>
          Cor
        </span>

        <input
          type="color"
          value={draft.color}
          disabled={locked}
          onChange={(event) =>
            update(
              'color',
              event.target.value
            )
          }
        />
      </label>

      {definition.usesStroke ? (
        <label className="mq-element-editor__field">
          <span>
            Espessura:{' '}
            {draft.strokeWidth}
          </span>

          <input
            type="range"
            min={
              MA_QUADRO_ELEMENT_MIN_STROKE
            }
            max={
              MA_QUADRO_ELEMENT_MAX_STROKE
            }
            step={1}
            value={
              draft.strokeWidth
            }
            disabled={locked}
            onChange={(event) =>
              update(
                'strokeWidth',
                Number(
                  event.target.value
                )
              )
            }
          />
        </label>
      ) : null}

      <div className="mq-element-editor__actions">
        <button
          type="button"
          disabled={
            locked ||
            !dirty
          }
          onClick={reset}
        >
          Repor
        </button>

        <button
          type="button"
          className="is-primary"
          disabled={
            locked ||
            !dirty
          }
          onClick={() =>
            void apply()
          }
        >
          {saving
            ? 'A aplicar…'
            : 'Aplicar alterações'}
        </button>
      </div>

      {message ? (
        <p
          className="mq-element-editor__message"
          role="status"
        >
          {message}
        </p>
      ) : null}
    </section>,
    host
  )
}
