import {
  useEffect,
  useState,
  type ReactNode
} from 'react'

import type {
  MAQuadroExportFormat,
  MAQuadroProjectCategory
} from '../../types/maQuadro'
import {
  useMAQuadroEditorContext
} from './editorContext'

const categories: Array<{
  value:
    MAQuadroProjectCategory
  label: string
}> = [
  {
    value: 'social',
    label:
      'Redes sociais'
  },
  {
    value: 'story',
    label:
      'Story ou vertical'
  },
  {
    value:
      'presentation',
    label:
      'Apresentação'
  },
  {
    value: 'print',
    label:
      'Impressão'
  },
  {
    value:
      'invitation',
    label:
      'Convite'
  },
  {
    value: 'custom',
    label:
      'Personalizado'
  }
]

function Modal({
  title,
  description,
  onClose,
  children
}: {
  title: string
  description: string
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    const closeWithEscape = (
      event:
        KeyboardEvent
    ) => {
      if (
        event.key ===
        'Escape'
      ) {
        onClose()
      }
    }

    window.addEventListener(
      'keydown',
      closeWithEscape
    )

    return () =>
      window.removeEventListener(
        'keydown',
        closeWithEscape
      )
  }, [
    onClose
  ])

  return (
    <div
      className="mq-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.currentTarget ===
          event.target
        ) {
          onClose()
        }
      }}
    >
      <section
        className="mq-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="mq-modal__header">
          <span>
            <strong>
              {title}
            </strong>

            <small>
              {description}
            </small>
          </span>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
          >
            ×
          </button>
        </header>

        {children}
      </section>
    </div>
  )
}

function NewDesignDialog() {
  const editor =
    useMAQuadroEditorContext()

  const [
    name,
    setName
  ] = useState(
    'Novo design'
  )

  const [
    width,
    setWidth
  ] = useState(1200)

  const [
    height,
    setHeight
  ] = useState(1200)

  const [
    category,
    setCategory
  ] = useState<
    MAQuadroProjectCategory
  >('custom')

  if (
    !editor.newDesignOpen
  ) {
    return null
  }

  return (
    <Modal
      title="Criar design personalizado"
      description="Defina o formato exato em píxeis."
      onClose={() =>
        editor.setNewDesignOpen(
          false
        )
      }
    >
      <div className="mq-modal__body">
        <label className="mq-field">
          <span>
            Nome do projeto
          </span>

          <input
            type="text"
            value={name}
            onChange={(event) =>
              setName(
                event.target.value
              )
            }
          />
        </label>

        <div className="mq-two-columns">
          <label className="mq-field">
            <span>
              Largura
            </span>

            <input
              type="number"
              min="100"
              max="8000"
              value={width}
              onChange={(event) =>
                setWidth(
                  Number(
                    event.target
                      .value
                  )
                )
              }
            />
          </label>

          <label className="mq-field">
            <span>
              Altura
            </span>

            <input
              type="number"
              min="100"
              max="8000"
              value={height}
              onChange={(event) =>
                setHeight(
                  Number(
                    event.target
                      .value
                  )
                )
              }
            />
          </label>
        </div>

        <label className="mq-field">
          <span>
            Categoria
          </span>

          <select
            value={category}
            onChange={(event) =>
              setCategory(
                event.target
                  .value as
                  MAQuadroProjectCategory
              )
            }
          >
            {categories.map(
              (item) => (
                <option
                  key={
                    item.value
                  }
                  value={
                    item.value
                  }
                >
                  {item.label}
                </option>
              )
            )}
          </select>
        </label>

        <div className="mq-modal__preset-row">
          {editor.presets
            .slice(0, 4)
            .map(
              (preset) => (
                <button
                  key={
                    preset.id
                  }
                  type="button"
                  onClick={() => {
                    setName(
                      preset.name
                    )

                    setWidth(
                      preset.width
                    )

                    setHeight(
                      preset.height
                    )

                    setCategory(
                      preset.category
                    )
                  }}
                >
                  <strong>
                    {preset.name}
                  </strong>

                  <small>
                    {preset.width} ×{' '}
                    {preset.height}
                  </small>
                </button>
              )
            )}
        </div>
      </div>

      <footer className="mq-modal__footer">
        <button
          type="button"
          className="mq-button mq-button--ghost"
          onClick={() =>
            editor
              .setNewDesignOpen(
                false
              )
          }
        >
          Cancelar
        </button>

        <button
          type="button"
          className="mq-button mq-button--primary"
          onClick={() =>
            void editor
              .createCustomDesign({
                name,
                width,
                height,
                category
              })
          }
        >
          Criar design
        </button>
      </footer>
    </Modal>
  )
}

const formatOptions: Array<{
  value:
    MAQuadroExportFormat
  label: string
  description: string
}> = [
  {
    value: 'png',
    label: 'PNG',
    description:
      'Imagem com alta qualidade e transparência'
  },
  {
    value: 'jpg',
    label: 'JPG',
    description:
      'Imagem comprimida e leve'
  },
  {
    value: 'svg',
    label: 'SVG',
    description:
      'Formato vetorial da página atual'
  },
  {
    value: 'pdf',
    label: 'PDF',
    description:
      'Documento com uma ou todas as páginas'
  },
  {
    value: 'zip',
    label: 'ZIP',
    description:
      'Todas as páginas como PNG'
  },
  {
    value: 'project',
    label: 'Projeto',
    description:
      'Cópia editável em JSON'
  }
]

function ExportDialog() {
  const editor =
    useMAQuadroEditorContext()

  const options =
    editor.exportOptions

  const imageFormat =
    options.format ===
      'png' ||
    options.format ===
      'jpg' ||
    options.format ===
      'zip'

  const supportsScope =
    options.format ===
    'pdf'

  if (!editor.exportOpen) {
    return null
  }

  return (
    <Modal
      title="Exportar design"
      description="Escolha o formato, qualidade e páginas."
      onClose={() =>
        editor.setExportOpen(
          false
        )
      }
    >
      <div className="mq-modal__body">
        <div className="mq-export-formats">
          {formatOptions.map(
            (format) => (
              <button
                key={format.value}
                type="button"
                className={
                  options.format ===
                  format.value
                    ? 'is-active'
                    : ''
                }
                onClick={() =>
                  editor
                    .setExportOptions({
                      format:
                        format.value
                    })
                }
              >
                <strong>
                  {format.label}
                </strong>

                <small>
                  {
                    format.description
                  }
                </small>
              </button>
            )
          )}
        </div>

        {imageFormat ? (
          <>
            <label className="mq-field">
              <span>
                Escala
              </span>

              <select
                value={
                  options.scale
                }
                onChange={(event) =>
                  editor
                    .setExportOptions({
                      scale:
                        Number(
                          event
                            .target
                            .value
                        ) as
                          | 1
                          | 2
                          | 3
                    })
                }
              >
                <option value="1">
                  1x — tamanho
                  original
                </option>

                <option value="2">
                  2x — alta
                  resolução
                </option>

                <option value="3">
                  3x — resolução
                  máxima
                </option>
              </select>
            </label>

            {options.format ===
            'jpg' ? (
              <label className="mq-range-field">
                <span>
                  <strong>
                    Qualidade
                  </strong>

                  <output>
                    {
                      options.quality
                    }
                    %
                  </output>
                </span>

                <input
                  type="range"
                  min="35"
                  max="100"
                  value={
                    options.quality
                  }
                  onChange={(
                    event
                  ) =>
                    editor
                      .setExportOptions({
                        quality:
                          Number(
                            event
                              .target
                              .value
                          )
                      })
                  }
                />
              </label>
            ) : null}
          </>
        ) : null}

        {supportsScope ? (
          <div className="mq-segmented mq-segmented--large">
            <button
              type="button"
              className={
                options.scope ===
                'current'
                  ? 'is-active'
                  : ''
              }
              onClick={() =>
                editor
                  .setExportOptions({
                    scope:
                      'current'
                  })
              }
            >
              Página atual
            </button>

            <button
              type="button"
              className={
                options.scope ===
                'all'
                  ? 'is-active'
                  : ''
              }
              onClick={() =>
                editor
                  .setExportOptions({
                    scope:
                      'all'
                  })
              }
            >
              Todas as páginas
            </button>
          </div>
        ) : null}

        <div className="mq-info-card mq-info-card--accent">
          <strong>
            Privacidade
          </strong>

          <p>
            A exportação é
            processada no browser.
            Os conteúdos do design
            não são enviados para a
            MA-Code.
          </p>
        </div>
      </div>

      <footer className="mq-modal__footer">
        <button
          type="button"
          className="mq-button mq-button--ghost"
          onClick={() =>
            editor.setExportOpen(
              false
            )
          }
        >
          Cancelar
        </button>

        <button
          type="button"
          className="mq-button mq-button--primary"
          onClick={() =>
            void editor.runExport()
          }
          disabled={
            editor.busy
          }
        >
          {editor.busy
            ? 'A preparar…'
            : 'Exportar agora'}
        </button>
      </footer>
    </Modal>
  )
}

export default function EditorDialogs() {
  return (
    <>
      <NewDesignDialog />
      <ExportDialog />
    </>
  )
}
