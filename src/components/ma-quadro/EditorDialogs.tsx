import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react'

import {
  formatMAQuadroExportScale,
  getMAQuadroExportPlan
} from '../../lib/maQuadro/export'
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

const focusableSelector = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',')

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
  const dialogRef =
    useRef<
      HTMLElement | null
    >(null)

  const onCloseRef =
    useRef(
      onClose
    )

  const titleId =
    useId()

  const descriptionId =
    useId()

  useEffect(() => {
    onCloseRef.current =
      onClose
  }, [
    onClose
  ])

  useEffect(() => {
    const previousFocus =
      document.activeElement as
        HTMLElement | null

    const previousOverflow =
      document.body
        .style
        .overflow

    document.body
      .style
      .overflow =
        'hidden'

    const focusFirst =
      () => {
        const dialog =
          dialogRef.current

        const first =
          dialog
            ?.querySelector<
              HTMLElement
            >(
              '[autofocus], ' +
              focusableSelector
            )

        const target =
          first ||
          dialog

        target?.focus()
      }

    const frame =
      window
        .requestAnimationFrame(
          focusFirst
        )

    const handleKeyDown = (
      event:
        KeyboardEvent
    ) => {
      const dialog =
        dialogRef.current

      if (!dialog) {
        return
      }

      if (
        event.key ===
        'Escape'
      ) {
        event.preventDefault()
        event.stopPropagation()

        onCloseRef.current()
        return
      }

      if (
        event.key !==
        'Tab'
      ) {
        return
      }

      const focusable =
        Array.from(
          dialog
            .querySelectorAll<
              HTMLElement
            >(
              focusableSelector
            )
        ).filter(
          (
            element
          ) =>
            !element.hidden &&
            element
              .getAttribute(
                'aria-hidden'
              ) !==
              'true'
        )

      if (
        focusable.length ===
        0
      ) {
        event.preventDefault()
        dialog.focus()
        return
      }

      const first =
        focusable[0]

      const last =
        focusable[
          focusable.length -
          1
        ]

      const active =
        document.activeElement

      if (
        event.shiftKey &&
        (
          active === first ||
          !dialog.contains(
            active
          )
        )
      ) {
        event.preventDefault()
        last.focus()
      } else if (
        !event.shiftKey &&
        active === last
      ) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener(
      'keydown',
      handleKeyDown,
      true
    )

    return () => {
      window
        .cancelAnimationFrame(
          frame
        )

      document
        .removeEventListener(
          'keydown',
          handleKeyDown,
          true
        )

      document.body
        .style
        .overflow =
          previousOverflow

      if (
        previousFocus &&
        document.contains(
          previousFocus
        )
      ) {
        previousFocus.focus()
      }
    }
  }, [])

  return (
    <div
      className="mq-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.currentTarget ===
          event.target
        ) {
          onCloseRef.current()
        }
      }}
    >
      <section
        ref={
          dialogRef
        }
        className="mq-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={
          titleId
        }
        aria-describedby={
          descriptionId
        }
        tabIndex={-1}
      >
        <header className="mq-modal__header">
          <span>
            <strong
              id={
                titleId
              }
            >
              {title}
            </strong>

            <small
              id={
                descriptionId
              }
            >
              {description}
            </small>
          </span>

          <button
            type="button"
            onClick={() =>
              onCloseRef
                .current()
            }
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
  ] = useState(
    '1200'
  )

  const [
    height,
    setHeight
  ] = useState(
    '1200'
  )

  const [
    category,
    setCategory
  ] = useState<
    MAQuadroProjectCategory
  >('custom')

  if (
    !editor
      .newDesignOpen
  ) {
    return null
  }

  const parsedWidth =
    Number(
      width
    )

  const parsedHeight =
    Number(
      height
    )

  const validWidth =
    Number.isInteger(
      parsedWidth
    ) &&
    parsedWidth >= 100 &&
    parsedWidth <= 8000

  const validHeight =
    Number.isInteger(
      parsedHeight
    ) &&
    parsedHeight >= 100 &&
    parsedHeight <= 8000

  const canCreate =
    validWidth &&
    validHeight &&
    !editor.busy

  return (
    <Modal
      title="Criar design personalizado"
      description="Defina o formato exato em píxeis."
      onClose={() =>
        editor
          .setNewDesignOpen(
            false
          )
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault()

          if (
            !canCreate
          ) {
            return
          }

          void editor
            .createCustomDesign({
              name,

              width:
                parsedWidth,

              height:
                parsedHeight,

              category
            })
        }}
      >
        <div className="mq-modal__body">
          <label className="mq-field">
            <span>
              Nome do projeto
            </span>

            <input
              type="text"
              value={
                name
              }
              maxLength={
                180
              }
              autoFocus
              onChange={(event) =>
                setName(
                  event
                    .target
                    .value
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
                inputMode="numeric"
                min="100"
                max="8000"
                step="1"
                value={
                  width
                }
                aria-invalid={
                  !validWidth
                }
                onChange={(event) =>
                  setWidth(
                    event
                      .target
                      .value
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
                inputMode="numeric"
                min="100"
                max="8000"
                step="1"
                value={
                  height
                }
                aria-invalid={
                  !validHeight
                }
                onChange={(event) =>
                  setHeight(
                    event
                      .target
                      .value
                  )
                }
              />
            </label>
          </div>

          {(
            !validWidth ||
            !validHeight
          ) ? (
            <div className="mq-info-card">
              <strong>
                Medidas inválidas
              </strong>

              <p>
                Use números inteiros
                entre 100 e 8000
                píxeis.
              </p>
            </div>
          ) : null}

          <label className="mq-field">
            <span>
              Categoria
            </span>

            <select
              value={
                category
              }
              onChange={(event) =>
                setCategory(
                  event
                    .target
                    .value as
                    MAQuadroProjectCategory
                )
              }
            >
              {categories.map(
                (
                  item
                ) => (
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
              .slice(
                0,
                4
              )
              .map(
                (
                  preset
                ) => (
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
                        String(
                          preset.width
                        )
                      )

                      setHeight(
                        String(
                          preset.height
                        )
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
                      {preset.width}{' '}
                      ×{' '}
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
            type="submit"
            className="mq-button mq-button--primary"
            disabled={
              !canCreate
            }
          >
            {editor.busy
              ? 'A criar…'
              : 'Criar design'}
          </button>
        </footer>
      </form>
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
      'Documento achatado com uma ou todas as páginas'
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

  const exportPages =
    useMemo(
      () => {
        if (
          options.format ===
          'zip'
        ) {
          return (
            editor.project
              ?.pages ||
            []
          )
        }

        return editor.activePage
          ? [
              editor.activePage
            ]
          : []
      },
      [
        editor.activePage,
        editor.project
          ?.pages,
        options.format
      ]
    )

  const exportPlans =
    useMemo(
      () =>
        imageFormat
          ? exportPages.map(
              (
                page
              ) =>
                getMAQuadroExportPlan(
                  page,
                  options.scale
                )
            )
          : [],
      [
        exportPages,
        imageFormat,
        options.scale
      ]
    )

  if (
    !editor.exportOpen
  ) {
    return null
  }

  const currentPlan =
    exportPlans[0]

  const reduced =
    exportPlans.some(
      (
        plan
      ) =>
        plan.reduced
    )

  const totalMegapixels =
    exportPlans.reduce(
      (
        total,
        plan
      ) =>
        total +
        plan.megapixels,
      0
    )

  return (
    <Modal
      title="Exportar design"
      description="Escolha o formato, qualidade e páginas."
      onClose={() =>
        editor
          .setExportOpen(
            false
          )
      }
    >
      <div className="mq-modal__body">
        <div className="mq-export-formats">
          {formatOptions.map(
            (
              format
            ) => (
              <button
                key={
                  format.value
                }
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
                  {format.description}
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
                    {options.quality}%
                  </output>
                </span>

                <input
                  type="range"
                  min="35"
                  max="100"
                  value={
                    options.quality
                  }
                  onChange={(event) =>
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

            {currentPlan ? (
              <div
                className={`mq-info-card${
                  reduced
                    ? ''
                    : ' mq-info-card--accent'
                }`}
              >
                <strong>
                  {options.format ===
                  'zip'
                    ? `${exportPlans.length} páginas preparadas`
                    : `${currentPlan.width} × ${currentPlan.height} píxeis`}
                </strong>

                <p>
                  {options.format ===
                  'zip'
                    ? `Carga estimada: ${totalMegapixels.toFixed(1)} megapíxeis, processados página a página.`
                    : `Escala efetiva: ${formatMAQuadroExportScale(currentPlan.scale)}x · ${currentPlan.megapixels.toFixed(1)} megapíxeis.`}
                </p>

                {reduced ? (
                  <p>
                    A resolução será
                    reduzida
                    automaticamente para
                    evitar bloquear ou
                    fechar o browser.
                  </p>
                ) : null}
              </div>
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

        {options.format ===
        'pdf' ? (
          <div className="mq-info-card">
            <strong>
              PDF para partilha e impressão
            </strong>

            <p>
              O tamanho físico dos
              projetos de impressão é
              preservado. O conteúdo é
              achatado numa imagem por
              página, por isso o texto não
              fica editável nem pesquisável.
            </p>
          </div>
        ) : null}

        {options.format ===
        'svg' ? (
          <div className="mq-info-card">
            <strong>
              Página atual em vetor
            </strong>

            <p>
              Formas e texto são exportados
              em SVG. Fotografias e outras
              imagens incorporadas continuam
              a ser rasterizadas.
            </p>
          </div>
        ) : null}

        <div className="mq-info-card mq-info-card--accent">
          <strong>
            Privacidade
          </strong>

          <p>
            A exportação é processada no
            browser. Os conteúdos do design
            não são enviados para a MA-Code.
          </p>
        </div>
      </div>

      <footer className="mq-modal__footer">
        <button
          type="button"
          className="mq-button mq-button--ghost"
          onClick={() =>
            editor
              .setExportOpen(
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
              .runExport()
          }
          disabled={
            editor.busy ||
            !editor.activePage
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
