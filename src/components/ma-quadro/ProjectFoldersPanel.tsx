import {
  useEffect,
  useRef,
  useState
} from 'react'

import type {
  MAQuadroProjectFolder
} from '../../lib/maQuadro/projectFolders'

import {
  MA_QUADRO_UNFILED_FOLDER_ID
} from '../../lib/maQuadro/projectFolders'

import './maQuadroProjectFolders.css'

type FolderDialog =
  | {
      mode: 'create'
    }
  | {
      mode: 'rename'
      folder: MAQuadroProjectFolder
    }
  | {
      mode: 'delete'
      folder: MAQuadroProjectFolder
    }

export type MAQuadroProjectFolderActionResult = {
  ok: boolean
  message?: string
}

function FolderIcon({
  variant = 'folder'
}: {
  variant?:
    | 'all'
    | 'folder'
    | 'unfiled'
}) {
  return (
    <span
      className={`mq-home-folder-icon is-${variant}`}
      aria-hidden="true"
    >
      <i />
    </span>
  )
}

export default function ProjectFoldersPanel({
  folders,
  projectCounts,
  totalCount,
  unfiledCount,
  selectedFolderId,
  locked,
  onSelect,
  onCreate,
  onRename,
  onDelete
}: {
  folders:
    MAQuadroProjectFolder[]
  projectCounts:
    Record<string, number>
  totalCount: number
  unfiledCount: number
  selectedFolderId:
    string |
    null
  locked: boolean
  onSelect:
    (
      folderId:
        string |
        null
    ) => void
  onCreate:
    (
      name: string
    ) =>
      MAQuadroProjectFolderActionResult
  onRename:
    (
      folderId: string,
      name: string
    ) =>
      MAQuadroProjectFolderActionResult
  onDelete:
    (
      folderId: string
    ) => void
}) {
  const [
    dialog,
    setDialog
  ] = useState<FolderDialog | null>(
    null
  )

  const [
    draft,
    setDraft
  ] = useState('')

  const [
    error,
    setError
  ] = useState('')

  const inputRef =
    useRef<HTMLInputElement | null>(
      null
    )

  const openCreate = () => {
    if (locked) {
      return
    }

    setDraft('')
    setError('')
    setDialog({
      mode: 'create'
    })
  }

  const openRename = (
    folder:
      MAQuadroProjectFolder
  ) => {
    if (locked) {
      return
    }

    setDraft(folder.name)
    setError('')
    setDialog({
      mode: 'rename',
      folder
    })
  }

  const openDelete = (
    folder:
      MAQuadroProjectFolder
  ) => {
    if (locked) {
      return
    }

    setDraft('')
    setError('')
    setDialog({
      mode: 'delete',
      folder
    })
  }

  const closeDialog = () => {
    setDialog(null)
    setDraft('')
    setError('')
  }

  useEffect(() => {
    if (
      !dialog ||
      dialog.mode === 'delete'
    ) {
      return
    }

    const frame =
      window.requestAnimationFrame(
        () => {
          inputRef.current
            ?.focus()

          inputRef.current
            ?.select()
        }
      )

    return () => {
      window.cancelAnimationFrame(
        frame
      )
    }
  }, [dialog])

  useEffect(() => {
    if (!dialog) {
      return
    }

    const handleKeyDown = (
      event: KeyboardEvent
    ) => {
      if (event.key !== 'Escape') {
        return
      }

      event.preventDefault()
      closeDialog()
    }

    window.addEventListener(
      'keydown',
      handleKeyDown
    )

    return () => {
      window.removeEventListener(
        'keydown',
        handleKeyDown
      )
    }
  }, [dialog])

  const commitName = () => {
    if (
      !dialog ||
      dialog.mode === 'delete' ||
      locked
    ) {
      return
    }

    const result =
      dialog.mode === 'create'
        ? onCreate(draft)
        : onRename(
            dialog.folder.id,
            draft
          )

    if (!result.ok) {
      setError(
        result.message ||
          'Não foi possível guardar a pasta.'
      )

      return
    }

    closeDialog()
  }

  const commitDelete = () => {
    if (
      !dialog ||
      dialog.mode !== 'delete' ||
      locked
    ) {
      return
    }

    onDelete(
      dialog.folder.id
    )

    closeDialog()
  }

  return (
    <section className="mq-home-folders">
      <div className="mq-home-folders__heading">
        <span>
          <h2>
            Pastas
          </h2>

          <p>
            Organize os projetos sem
            alterar o conteúdo dos
            designs.
          </p>
        </span>

        <button
          type="button"
          disabled={locked}
          onClick={openCreate}
        >
          + Nova pasta
        </button>
      </div>

      <div className="mq-home-folder-grid">
        <button
          type="button"
          className={`mq-home-folder-card is-system${
            selectedFolderId === null
              ? ' is-active'
              : ''
          }`}
          disabled={locked}
          aria-pressed={
            selectedFolderId === null
          }
          onClick={() =>
            onSelect(null)
          }
        >
          <FolderIcon variant="all" />

          <span>
            <strong>
              Todos os projetos
            </strong>

            <small>
              {totalCount}{' '}
              {totalCount === 1
                ? 'projeto'
                : 'projetos'}
            </small>
          </span>
        </button>

        <button
          type="button"
          className={`mq-home-folder-card is-system${
            selectedFolderId ===
            MA_QUADRO_UNFILED_FOLDER_ID
              ? ' is-active'
              : ''
          }`}
          disabled={locked}
          aria-pressed={
            selectedFolderId ===
            MA_QUADRO_UNFILED_FOLDER_ID
          }
          onClick={() =>
            onSelect(
              MA_QUADRO_UNFILED_FOLDER_ID
            )
          }
        >
          <FolderIcon variant="unfiled" />

          <span>
            <strong>
              Sem pasta
            </strong>

            <small>
              {unfiledCount}{' '}
              {unfiledCount === 1
                ? 'projeto'
                : 'projetos'}
            </small>
          </span>
        </button>

        {folders.map(
          (folder) => {
            const count =
              projectCounts[
                folder.id
              ] || 0

            const active =
              selectedFolderId ===
              folder.id

            return (
              <article
                key={folder.id}
                className={`mq-home-folder-shell${
                  active
                    ? ' is-active'
                    : ''
                }`}
              >
                <button
                  type="button"
                  className="mq-home-folder-card"
                  disabled={locked}
                  aria-pressed={active}
                  onClick={() =>
                    onSelect(
                      folder.id
                    )
                  }
                >
                  <FolderIcon />

                  <span>
                    <strong>
                      {folder.name}
                    </strong>

                    <small>
                      {count}{' '}
                      {count === 1
                        ? 'projeto'
                        : 'projetos'}
                    </small>
                  </span>
                </button>

                <div className="mq-home-folder-actions">
                  <button
                    type="button"
                    disabled={locked}
                    aria-label={`Renomear pasta ${folder.name}`}
                    title="Renomear pasta"
                    onClick={() =>
                      openRename(
                        folder
                      )
                    }
                  >
                    ✎
                  </button>

                  <button
                    type="button"
                    className="is-danger"
                    disabled={locked}
                    aria-label={`Eliminar pasta ${folder.name}`}
                    title="Eliminar pasta"
                    onClick={() =>
                      openDelete(
                        folder
                      )
                    }
                  >
                    ×
                  </button>
                </div>
              </article>
            )
          }
        )}
      </div>

      {dialog ? (
        <div
          className="mq-home-folder-modal-backdrop"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeDialog()
            }
          }}
        >
          <section
            className="mq-home-folder-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mq-home-folder-modal-title"
          >
            <div className="mq-home-folder-modal__heading">
              <span>
                <h2 id="mq-home-folder-modal-title">
                  {dialog.mode === 'create'
                    ? 'Criar pasta'
                    : dialog.mode === 'rename'
                      ? 'Renomear pasta'
                      : 'Eliminar pasta'}
                </h2>

                <p>
                  {dialog.mode === 'delete'
                    ? 'Os projetos permanecem guardados e passam para “Sem pasta”.'
                    : 'Utilize um nome curto e fácil de identificar.'}
                </p>
              </span>

              <button
                type="button"
                aria-label="Fechar"
                onClick={closeDialog}
              >
                ×
              </button>
            </div>

            {dialog.mode === 'delete' ? (
              <div className="mq-home-folder-modal__warning">
                <FolderIcon />

                <span>
                  <strong>
                    {dialog.folder.name}
                  </strong>

                  <small>
                    {projectCounts[
                      dialog.folder.id
                    ] || 0}{' '}
                    {(projectCounts[
                      dialog.folder.id
                    ] || 0) === 1
                      ? 'projeto será movido'
                      : 'projetos serão movidos'}
                  </small>
                </span>
              </div>
            ) : (
              <label className="mq-home-folder-modal__field">
                <span>
                  Nome da pasta
                </span>

                <input
                  ref={inputRef}
                  type="text"
                  value={draft}
                  maxLength={80}
                  placeholder="Ex.: Redes sociais"
                  onChange={(event) => {
                    setDraft(
                      event.target.value
                    )

                    setError('')
                  }}
                  onKeyDown={(event) => {
                    if (
                      event.key === 'Enter'
                    ) {
                      event.preventDefault()
                      commitName()
                    }
                  }}
                />
              </label>
            )}

            {error ? (
              <p
                className="mq-home-folder-modal__error"
                role="alert"
              >
                {error}
              </p>
            ) : null}

            <div className="mq-home-folder-modal__buttons">
              <button
                type="button"
                className="is-secondary"
                onClick={closeDialog}
              >
                Cancelar
              </button>

              <button
                type="button"
                className={
                  dialog.mode === 'delete'
                    ? 'is-danger'
                    : 'is-primary'
                }
                disabled={
                  dialog.mode !== 'delete' &&
                  !draft.trim()
                }
                onClick={
                  dialog.mode === 'delete'
                    ? commitDelete
                    : commitName
                }
              >
                {dialog.mode === 'create'
                  ? 'Criar pasta'
                  : dialog.mode === 'rename'
                    ? 'Guardar nome'
                    : 'Eliminar pasta'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  )
}
