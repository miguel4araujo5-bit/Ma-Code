import {
  useRef
} from 'react'

import {
  useMAQuadroEditorContext
} from './editorContext'

const saveLabels = {
  ready: 'Pronto',
  dirty: 'Alterações por guardar',
  saving: 'A guardar…',
  saved: 'Guardado automaticamente',
  error: 'Erro ao guardar'
} as const

export default function EditorHeader() {
  const editor =
    useMAQuadroEditorContext()

  const menuRef =
    useRef<
      HTMLDetailsElement | null
    >(null)

  const closeMenu = () => {
    if (
      menuRef.current
    ) {
      menuRef.current.open =
        false
    }
  }

  const openNewDesign = () => {
    closeMenu()

    editor.setNewDesignOpen(
      true
    )
  }

  const openImport = () => {
    closeMenu()

    editor.projectInputRef
      .current
      ?.click()
  }

  const saveAsTemplate = () => {
    closeMenu()

    void editor.saveProjectAsTemplate()
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
              Estúdio de design local
            </small>
          </span>
        </a>
      </div>

      <div className="mq-header__document">
        <input
          className="mq-document-name"
          value={
            editor.project?.name ||
            ''
          }
          maxLength={180}
          onChange={(event) =>
            editor.setProjectName(
              event.target.value
            )
          }
          aria-label="Nome do projeto"
          disabled={!editor.project}
        />

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
            className="mq-button mq-button--ghost"
            onClick={openNewDesign}
          >
            Novo
          </button>

          <button
            type="button"
            className="mq-button mq-button--ghost"
            onClick={openImport}
          >
            Importar
          </button>

          <button
            type="button"
            className="mq-button mq-button--ghost mq-hide-tablet"
            onClick={saveAsTemplate}
            disabled={
              !editor.project ||
              editor.busy
            }
          >
            Guardar como modelo
          </button>
        </div>

        <button
          type="button"
          className="mq-button mq-button--secondary mq-header__save-button"
          onClick={() =>
            void editor.saveProject(
              false
            )
          }
          disabled={
            !editor.project ||
            editor.busy
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
            editor.busy
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
              onClick={openNewDesign}
            >
              Novo design
            </button>

            <button
              type="button"
              onClick={openImport}
            >
              Importar projeto
            </button>

            <button
              type="button"
              onClick={saveAsTemplate}
              disabled={
                !editor.project ||
                editor.busy
              }
            >
              Guardar como modelo
            </button>

            <button
              type="button"
              onClick={() => {
                closeMenu()

                void editor.saveProject(
                  false
                )
              }}
              disabled={
                !editor.project ||
                editor.busy
              }
            >
              Guardar projeto
            </button>
          </div>
        </details>

        <input
          ref={
            editor.projectInputRef
          }
          type="file"
          accept="application/json,.json"
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
