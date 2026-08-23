import {
  useEffect,
  useMemo,
  useState
} from 'react'

import {
  createPortal
} from 'react-dom'

import {
  useMAQuadroEditorContext
} from './editorContext'

import './maQuadroMagicResize.css'

type MagicResizeFormat = {
  id: string
  name: string
  description: string
  width: number
  height: number
}

const EXTRA_FORMATS: MagicResizeFormat[] = [
  {
    id: 'linkedin-post',
    name: 'Publicação LinkedIn',
    description: 'Quadrado profissional',
    width: 1200,
    height: 1200
  },
  {
    id: 'youtube-thumbnail',
    name: 'Miniatura YouTube',
    description: 'Horizontal 16:9',
    width: 1280,
    height: 720
  }
]

function formatDimensions(
  width: number,
  height: number
) {
  return `${width} × ${height}`
}

export default function MagicResizeControl() {
  const editor =
    useMAQuadroEditorContext()

  const [
    open,
    setOpen
  ] = useState(false)

  const [
    preparing,
    setPreparing
  ] = useState(false)

  const [
    generating,
    setGenerating
  ] = useState(false)

  const [
    selectedIds,
    setSelectedIds
  ] = useState<string[]>([])

  const [
    resultMessage,
    setResultMessage
  ] = useState('')

  const formats =
    useMemo<MagicResizeFormat[]>(
      () => [
        ...editor.presets.map(
          (preset) => ({
            id: preset.id,
            name: preset.name,
            description:
              preset.description,
            width: preset.width,
            height: preset.height
          })
        ),
        ...EXTRA_FORMATS
      ],
      [
        editor.presets
      ]
    )

  const currentWidth =
    editor.activePage?.width ?? 0

  const currentHeight =
    editor.activePage?.height ?? 0

  const availableFormats =
    formats.filter(
      (format) =>
        format.width !==
          currentWidth ||
        format.height !==
          currentHeight
    )

  const locked =
    !editor.ready ||
    editor.busy ||
    editor.structureBusy ||
    editor.imageCropEditing ||
    preparing ||
    generating

  useEffect(() => {
    if (!open) {
      return
    }

    const previousOverflow =
      document.body.style.overflow

    document.body.style.overflow =
      'hidden'

    const handleKeyDown = (
      event: KeyboardEvent
    ) => {
      if (
        event.key === 'Escape' &&
        !generating
      ) {
        setOpen(false)
      }
    }

    window.addEventListener(
      'keydown',
      handleKeyDown
    )

    return () => {
      document.body.style.overflow =
        previousOverflow

      window.removeEventListener(
        'keydown',
        handleKeyDown
      )
    }
  }, [
    generating,
    open
  ])

  const openDialog = async () => {
    if (locked) {
      return
    }

    setPreparing(true)
    setResultMessage('')

    try {
      /*
       * O projeto é sempre guardado antes de abrir
       * o fluxo para que as cópias incluam exatamente
       * o estado visível no quadro.
       *
       * Se a origem for um modelo, saveProject()
       * já cria uma cópia editável e preserva o modelo.
       */
      const saved =
        await editor.saveProject(
          true
        )

      if (!saved) {
        setResultMessage(
          'Não foi possível preparar o projeto para o redimensionamento.'
        )

        return
      }

      setSelectedIds([])
      setOpen(true)
    } finally {
      setPreparing(false)
    }
  }

  const toggleFormat = (
    formatId: string
  ) => {
    if (generating) {
      return
    }

    setSelectedIds(
      (current) =>
        current.includes(
          formatId
        )
          ? current.filter(
              (id) =>
                id !==
                formatId
            )
          : [
              ...current,
              formatId
            ]
    )
  }

  const selectAll = () => {
    setSelectedIds(
      availableFormats.map(
        (format) =>
          format.id
      )
    )
  }

  const clearSelection = () => {
    setSelectedIds([])
  }

  const createCopies =
    async () => {
      const sourceProject =
        editor.project

      if (
        !sourceProject ||
        selectedIds.length ===
          0 ||
        generating
      ) {
        return
      }

      const targets =
        formats.filter(
          (format) =>
            selectedIds.includes(
              format.id
            )
        )

      if (
        targets.length ===
        0
      ) {
        return
      }

      const sourceProjectId =
        sourceProject.id

      const sourceProjectName =
        sourceProject.name

      setGenerating(true)
      setResultMessage('')

      let processed = 0

      try {
        for (
          const format
          of targets
        ) {
          /*
           * Cada formato parte sempre do projeto
           * original já guardado.
           *
           * Assim, gerar cinco formatos não significa
           * redimensionar sequencialmente uma cópia
           * cinco vezes.
           */
          await editor.duplicateProject(
            sourceProjectId
          )

          editor.setProjectName(
            `${sourceProjectName} — ${format.name}`
          )

          /*
           * O resize existente usa escala uniforme
           * e centralização, evitando distorções.
           * Todas as páginas da cópia são adaptadas.
           */
          await editor.resizeAllPages(
            format.width,
            format.height,
            'scale'
          )

          processed += 1
        }

        setResultMessage(
          processed === 1
            ? 'Foi criada 1 cópia redimensionada. O original ficou intacto.'
            : `Foram criadas ${processed} cópias redimensionadas. O original ficou intacto.`
        )
      } finally {
        setGenerating(false)
      }
    }

  const dialog =
    open
      ? createPortal(
          <div
            className="mq-magic-resize-backdrop"
            role="presentation"
            onMouseDown={(
              event
            ) => {
              if (
                event.target ===
                  event.currentTarget &&
                !generating
              ) {
                setOpen(false)
              }
            }}
          >
            <section
              className="mq-magic-resize-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="mq-magic-resize-title"
              aria-describedby="mq-magic-resize-description"
            >
              <header className="mq-magic-resize-dialog__header">
                <span
                  className="mq-magic-resize-dialog__symbol"
                  aria-hidden="true"
                >
                  ✦
                </span>

                <span>
                  <strong id="mq-magic-resize-title">
                    Redimensionamento mágico
                  </strong>

                  <small id="mq-magic-resize-description">
                    Crie cópias do design em vários formatos sem alterar o original.
                  </small>
                </span>

                <button
                  type="button"
                  className="mq-magic-resize-dialog__close"
                  disabled={
                    generating
                  }
                  aria-label="Fechar"
                  title="Fechar"
                  onClick={() =>
                    setOpen(false)
                  }
                >
                  ×
                </button>
              </header>

              <div className="mq-magic-resize-current">
                <span>
                  <strong>
                    Formato atual
                  </strong>

                  <small>
                    O design original será preservado.
                  </small>
                </span>

                <b>
                  {formatDimensions(
                    currentWidth,
                    currentHeight
                  )}
                </b>
              </div>

              <div className="mq-magic-resize-dialog__toolbar">
                <span>
                  {
                    selectedIds.length
                  }{' '}
                  selecionado{
                    selectedIds.length ===
                    1
                      ? ''
                      : 's'
                  }
                </span>

                <div>
                  <button
                    type="button"
                    disabled={
                      generating
                    }
                    onClick={
                      selectAll
                    }
                  >
                    Selecionar todos
                  </button>

                  <button
                    type="button"
                    disabled={
                      generating ||
                      selectedIds.length ===
                        0
                    }
                    onClick={
                      clearSelection
                    }
                  >
                    Limpar
                  </button>
                </div>
              </div>

              <div className="mq-magic-resize-grid">
                {formats.map(
                  (format) => {
                    const current =
                      format.width ===
                        currentWidth &&
                      format.height ===
                        currentHeight

                    const selected =
                      selectedIds.includes(
                        format.id
                      )

                    return (
                      <button
                        key={
                          format.id
                        }
                        type="button"
                        className={`mq-magic-resize-card${
                          selected
                            ? ' is-selected'
                            : ''
                        }${
                          current
                            ? ' is-current'
                            : ''
                        }`}
                        disabled={
                          generating ||
                          current
                        }
                        aria-pressed={
                          selected
                        }
                        onClick={() =>
                          toggleFormat(
                            format.id
                          )
                        }
                      >
                        <span
                          className="mq-magic-resize-card__check"
                          aria-hidden="true"
                        >
                          {current
                            ? 'Atual'
                            : selected
                              ? '✓'
                              : '+'}
                        </span>

                        <span className="mq-magic-resize-card__preview">
                          <span
                            style={{
                              aspectRatio:
                                `${format.width} / ${format.height}`
                            }}
                          />
                        </span>

                        <span className="mq-magic-resize-card__copy">
                          <strong>
                            {
                              format.name
                            }
                          </strong>

                          <small>
                            {
                              format.description
                            }
                          </small>

                          <b>
                            {formatDimensions(
                              format.width,
                              format.height
                            )}
                          </b>
                        </span>
                      </button>
                    )
                  }
                )}
              </div>

              <div className="mq-magic-resize-note">
                <span
                  aria-hidden="true"
                >
                  i
                </span>

                <p>
                  O MA-Quadro adapta proporcionalmente os elementos e mantém cada formato numa cópia independente. Mudanças fortes de orientação podem beneficiar de um pequeno ajuste manual depois da criação.
                </p>
              </div>

              {resultMessage ? (
                <p
                  className="mq-magic-resize-result"
                  role="status"
                >
                  {
                    resultMessage
                  }
                </p>
              ) : null}

              <footer className="mq-magic-resize-dialog__footer">
                <button
                  type="button"
                  disabled={
                    generating
                  }
                  onClick={() =>
                    setOpen(false)
                  }
                >
                  Fechar
                </button>

                <button
                  type="button"
                  className="is-primary"
                  disabled={
                    generating ||
                    selectedIds.length ===
                      0
                  }
                  aria-busy={
                    generating
                  }
                  onClick={() =>
                    void createCopies()
                  }
                >
                  {generating
                    ? 'A criar formatos…'
                    : selectedIds.length ===
                        1
                      ? 'Criar 1 formato'
                      : `Criar ${selectedIds.length} formatos`}
                </button>
              </footer>
            </section>
          </div>,
          document.body
        )
      : null

  return (
    <>
      <button
        type="button"
        className="mq-tool-discovery__button mq-magic-resize-trigger"
        disabled={
          locked
        }
        aria-busy={
          preparing
        }
        title="Criar cópias do design noutros formatos"
        onClick={() =>
          void openDialog()
        }
      >
        <span
          className="mq-tool-discovery__icon"
          aria-hidden="true"
        >
          ✦
        </span>

        <span>
          {preparing
            ? 'A preparar…'
            : 'Resize mágico'}
        </span>
      </button>

      {dialog}
    </>
  )
}
