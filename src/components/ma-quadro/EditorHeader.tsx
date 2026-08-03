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
        <button
          type="button"
          className="mq-button mq-button--ghost"
          onClick={() =>
            editor.setNewDesignOpen(
              true
            )
          }
        >
          Novo
        </button>

        <button
          type="button"
          className="mq-button mq-button--ghost mq-hide-mobile"
          onClick={() =>
            editor.projectInputRef
              .current
              ?.click()
          }
        >
          Importar
        </button>

        <button
          type="button"
          className="mq-button mq-button--ghost mq-hide-tablet"
          onClick={() =>
            void editor
              .saveProjectAsTemplate()
          }
          disabled={
            !editor.project ||
            editor.busy
          }
        >
          Guardar como modelo
        </button>

        <button
          type="button"
          className="mq-button mq-button--secondary"
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
