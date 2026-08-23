import {
  useEffect,
  useMemo,
  useState
} from 'react'

import {
  createPortal
} from 'react-dom'

import type {
  MAQuadroProjectCategory
} from '../../types/maQuadro'

import {
  createMAQuadroResizedProject,
  type MAQuadroSmartResizeMode
} from '../../lib/maQuadro/smartResize'

import {
  useMAQuadroEditorContext
} from './editorContext'

import './maQuadroMagicResize.css'
import './maQuadroMagicResizeV2.css'

type MagicResizeFormat = {
  id: string
  name: string
  description: string
  width: number
  height: number
  category: MAQuadroProjectCategory
}

const EXTRA_FORMATS:
  MagicResizeFormat[] = [
    {
      id: 'linkedin-post',
      name: 'Publicação LinkedIn',
      description: 'Quadrado profissional',
      width: 1200,
      height: 1200,
      category: 'social'
    },
    {
      id: 'youtube-thumbnail',
      name: 'Miniatura YouTube',
      description: 'Horizontal 16:9',
      width: 1280,
      height: 720,
      category: 'social'
    }
  ]

function formatDimensions(
  width: number,
  height: number
) {
  return `${width} × ${height}`
}

function modeDescription(
  mode: MAQuadroSmartResizeMode
) {
  return mode === 'smart'
    ? 'Reorganiza blocos visuais quando a proporção muda muito.'
    : 'Mantém exatamente a composição e altera apenas a escala proporcional.'
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
    mode,
    setMode
  ] = useState<MAQuadroSmartResizeMode>(
    'smart'
  )

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
            height: preset.height,
            category:
              preset.category
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
      setMode('smart')
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
        selectedIds.length === 0 ||
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
        targets.length === 0
      ) {
        return
      }

      setGenerating(true)
      setResultMessage('')

      let processed = 0
      let adjustedObjects = 0
      let semanticObjects = 0

      try {
        for (
          const format
          of targets
        ) {
          const {
            project,
            report
          } =
            await createMAQuadroResizedProject(
              sourceProject,
              `${sourceProject.name} — ${format.name}`,
              format.width,
              format.height,
              mode,
              format.category
            )

          const serialized =
            JSON.stringify(
              project
            )

          if (
            serialized.length >
            90_000_000
          ) {
            throw new Error(
              `A cópia para ${format.name} ficaria demasiado grande para ser criada com segurança.`
            )
          }

          const file =
            new File(
              [
                serialized
              ],
              `${project.name}.ma-quadro.json`,
              {
                type:
                  'application/json'
              }
            )

          const syntheticEvent = {
            target: {
              files: [
                file
              ],
              value: ''
            }
          } as unknown as
            Parameters<
              typeof editor.importProject
            >[0]

          await editor.importProject(
            syntheticEvent
          )

          processed += 1

          adjustedObjects +=
            report.adjustedObjects

          semanticObjects +=
            report.semanticObjects
        }

        if (
          mode === 'smart'
        ) {
          setResultMessage(
            processed === 1
              ? `Foi criada 1 cópia com adaptação inteligente. ${adjustedObjects} elemento${adjustedObjects === 1 ? '' : 's'} ajustado${adjustedObjects === 1 ? '' : 's'}; ${semanticObjects} reconhecido${semanticObjects === 1 ? '' : 's'} como bloco visual. O original ficou intacto.`
              : `Foram criadas ${processed} cópias com adaptação inteligente. ${adjustedObjects} ajustes efetuados entre todos os formatos. O original ficou intacto.`
          )
        } else {
          setResultMessage(
            processed === 1
              ? 'Foi criada 1 cópia com redimensionamento proporcional. O original ficou intacto.'
              : `Foram criadas ${processed} cópias com redimensionamento proporcional. O original ficou intacto.`
          )
        }
      } catch (
        error
      ) {
        console.error(
          error
        )

        setResultMessage(
          error instanceof
            Error
            ? error.message
            : 'Não foi possível concluir o redimensionamento. O projeto original não foi alterado.'
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

              <div className="mq-magic-resize-mode">
                <div className="mq-magic-resize-mode__heading">
                  <span>
                    <strong>
                      Método de adaptação
                    </strong>

                    <small>
                      {modeDescription(
                        mode
                      )}
                    </small>
                  </span>

                  {mode === 'smart' ? (
                    <b>
                      Recomendado
                    </b>
                  ) : null}
                </div>

                <div
                  className="mq-magic-resize-mode__choices"
                  role="group"
                  aria-label="Método de adaptação"
                >
                  <button
                    type="button"
                    className={
                      mode === 'smart'
                        ? 'is-active'
                        : ''
                    }
                    disabled={
                      generating
                    }
                    aria-pressed={
                      mode === 'smart'
                    }
                    onClick={() =>
                      setMode(
                        'smart'
                      )
                    }
                  >
                    <span
                      aria-hidden="true"
                    >
                      ✦
                    </span>

                    <span>
                      <strong>
                        Inteligente
                      </strong>

                      <small>
                        Redistribui título, texto, imagem, CTA e elementos de apoio.
                      </small>
                    </span>
                  </button>

                  <button
                    type="button"
                    className={
                      mode === 'proportional'
                        ? 'is-active'
                        : ''
                    }
                    disabled={
                      generating
                    }
                    aria-pressed={
                      mode === 'proportional'
                    }
                    onClick={() =>
                      setMode(
                        'proportional'
                      )
                    }
                  >
                    <span
                      aria-hidden="true"
                    >
                      ↔
                    </span>

                    <span>
                      <strong>
                        Proporcional
                      </strong>

                      <small>
                        Mantém a composição original e apenas redimensiona.
                      </small>
                    </span>
                  </button>
                </div>
              </div>

              <div className="mq-magic-resize-dialog__toolbar">
                <span>
                  {
                    selectedIds.length
                  }{' '}
                  selecionado{
                    selectedIds.length === 1
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
                      selectedIds.length === 0
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
                  {mode === 'smart'
                    ? 'A adaptação inteligente é determinística e processada localmente. Usa o tipo, o nome e a geometria das camadas para preservar hierarquia visual e redistribuir conteúdo quando a orientação muda. Não utiliza serviços externos nem IA generativa.'
                    : 'O modo proporcional mantém a composição exatamente como está e aplica a mesma escala a todos os elementos. É útil quando pretende uma cópia fiel e fará os ajustes manualmente.'}
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
                    selectedIds.length === 0
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
                    : selectedIds.length === 1
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
        title="Criar cópias inteligentes do design noutros formatos"
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
