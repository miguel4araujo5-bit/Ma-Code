import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent
} from 'react'

import {
  useMAQuadroEditorContext
} from './editorContext'

import FormatPainterButton from './FormatPainterButton'

const saveLabels = {
  ready:
    'Pronto',

  dirty:
    'Alterações por guardar',

  saving:
    'A guardar…',

  saved:
    'Guardado automaticamente',

  error:
    'Erro ao guardar'
} as const

function ProjectNameField() {
  const editor =
    useMAQuadroEditorContext()

  const projectId =
    editor.project?.id ||
    ''

  const currentName =
    editor.project?.name ||
    ''

  const [
    draft,
    setDraft
  ] = useState(
    currentName
  )

  const skipCommitRef =
    useRef(false)

  useEffect(() => {
    setDraft(
      currentName
    )

    skipCommitRef.current =
      false
  }, [
    currentName,
    projectId
  ])

  const commit = () => {
    if (
      skipCommitRef.current
    ) {
      skipCommitRef.current =
        false

      setDraft(
        currentName
      )

      return
    }

    const next =
      draft.trim()

    if (!next) {
      setDraft(
        currentName
      )

      return
    }

    setDraft(next)

    if (
      next !==
      currentName
    ) {
      editor.setProjectName(
        next
      )
    }
  }

  const handleKeyDown = (
    event:
      KeyboardEvent<HTMLInputElement>
  ) => {
    if (
      event.key ===
      'Enter'
    ) {
      event.preventDefault()

      event.currentTarget
        .blur()

      return
    }

    if (
      event.key ===
      'Escape'
    ) {
      event.preventDefault()

      skipCommitRef.current =
        true

      setDraft(
        currentName
      )

      event.currentTarget
        .blur()
    }
  }

  return (
    <input
      className="mq-document-name"
      value={draft}
      maxLength={180}
      onChange={(event) =>
        setDraft(
          event.target.value
        )
      }
      onBlur={commit}
      onKeyDown={
        handleKeyDown
      }
      aria-label="Nome do projeto"
      disabled={
        !editor.project ||
        editor.busy ||
        editor.structureBusy ||
        editor.imageCropEditing
      }
    />
  )
}

export default function EditorHeader({
  onOpenShortcuts
}: {
  onOpenShortcuts:
    () => void
}) {
  const editor =
    useMAQuadroEditorContext()

  const menuRef =
    useRef<
      HTMLDetailsElement | null
    >(null)

  const locked =
    editor.busy ||
    editor.structureBusy ||
    editor.imageCropEditing

  const closeMenu = () => {
    if (
      menuRef.current
    ) {
      menuRef.current.open =
        false
    }
  }

  const openNewDesign = () => {
    if (locked) {
      return
    }

    closeMenu()

    editor.setNewDesignOpen(
      true
    )
  }

  const openImport = () => {
    if (locked) {
      return
    }

    closeMenu()

    editor.projectInputRef
      .current
      ?.click()
  }

  const saveAsTemplate = () => {
    if (locked) {
      return
    }

    closeMenu()

    void editor
      .saveProjectAsTemplate()
  }

  const saveProject = () => {
    if (locked) {
      return
    }

    closeMenu()

    void editor.saveProject(
      false
    )
  }

  const openShortcuts = () => {
    closeMenu()

    onOpenShortcuts()
  }

  return (
    <header className="mq-header">
      <div className="mq-header__brand">
        <a
          className="mq-icon-button"
          href="/produtos"
          aria-label="Voltar aos produtos"
          title="Voltar aos produtos"
        >
          ←
        </a>

        <a
          className="mq-brand"
          href="/"
          aria-label="MA-Code.pt"
        >
          <img
            src="/ma-code.png"
            alt=""
            className="mq-brand__logo"
          />

          <span>
            <strong>
              MA-Quadro
            </strong>

            <small>
              Estúdio de design
              local
            </small>
          </span>
        </a>
      </div>

      <div className="mq-header__document">
        <ProjectNameField />

        <span
          className={`mq-save-state mq-save-state--${editor.saveState}`}
          aria-live="polite"
        >
          {
            saveLabels[
              editor.saveState
            ]
          }
        </span>
      </div>

      <div className="mq-header__actions">
        <div className="mq-header__desktop-actions">
          <button
            type="button"
            className="mq-button mq-button--ghost mq-header__shortcuts-button"
            onClick={
              openShortcuts
            }
            title="Atalhos de teclado (?)"
            aria-label="Atalhos de teclado"
          >
            <span aria-hidden="true">
              ?
            </span>

            <span className="mq-header__shortcuts-label">
              Atalhos
            </span>
          </button>
        </div>

        <FormatPainterButton />

        <button
          type="button"
          className="mq-button mq-button--secondary mq-header__save-button"
          onClick={
            saveProject
          }
          disabled={
            !editor.project ||
            locked
          }
        >
          Guardar
        </button>

        <button
          type="button"
          className="mq-button mq-button--primary"
          onClick={() =>
            editor.setExportOpen(
              true
            )
          }
          disabled={
            !editor.project ||
            locked
          }
        >
          Exportar
        </button>

        <details
          ref={menuRef}
          className="mq-header-menu"
        >
          <summary
            aria-label="Mais ações"
            title="Mais ações"
          >
            ⋯
          </summary>

          <div className="mq-header-menu__panel">
            <button
              type="button"
              onClick={
                openNewDesign
              }
              disabled={locked}
            >
              Novo design
            </button>

            <button
              type="button"
              onClick={
                openImport
              }
              disabled={locked}
            >
              Importar projeto
            </button>

            <button
              type="button"
              onClick={
                saveAsTemplate
              }
              disabled={
                !editor.project ||
                locked
              }
            >
              Guardar como modelo
            </button>

            <button
              type="button"
              onClick={
                saveProject
              }
              disabled={
                !editor.project ||
                locked
              }
            >
              Guardar projeto
            </button>

            <button
              type="button"
              onClick={
                openShortcuts
              }
            >
              Atalhos de teclado
            </button>
          </div>
        </details>

        <input
          ref={
            editor.projectInputRef
          }
          type="file"
          accept="application/json,.json"
          disabled={locked}
          onChange={(event) =>
            void editor.importProject(
              event
            )
          }
          hidden
        />
      </div>
    </header>
  )
}
