import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent
} from 'react'

import {
  createPortal
} from 'react-dom'

import {
  createMAQuadroBulkProject,
  estimateMAQuadroBulkCharacters,
  findMAQuadroBulkPlaceholders,
  findMissingMAQuadroBulkColumns,
  MA_QUADRO_BULK_MAX_ESTIMATED_CHARACTERS,
  MA_QUADRO_BULK_MAX_FILE_BYTES,
  parseMAQuadroBulkCsv,
  type MAQuadroBulkCsv
} from '../../lib/maQuadro/bulkCreate'

import {
  analyseMAQuadroBulkImageReferences,
  applyMAQuadroBulkImages,
  findMAQuadroBulkImageBindings,
  MA_QUADRO_BULK_IMAGE_MAX_FILE_BYTES,
  MA_QUADRO_BULK_IMAGE_MAX_TOTAL_BYTES
} from '../../lib/maQuadro/bulkCreateImages'

import {
  useMAQuadroEditorContext
} from './editorContext'

import './maQuadroBulkCreate.css'
import './maQuadroBulkCreateImages.css'

function delimiterLabel(
  delimiter:
    MAQuadroBulkCsv['delimiter']
) {
  if (
    delimiter ===
    ';'
  ) {
    return 'Ponto e vírgula'
  }

  if (
    delimiter ===
    '\t'
  ) {
    return 'Tabulação'
  }

  return 'Vírgula'
}

function exampleCsv(
  placeholders:
    string[],

  imageColumns:
    string[]
) {
  const headers =
    placeholders.length >
    0
      ? placeholders
      : [
          'nome',
          'preco',
          'imagem'
        ]

  const values =
    headers.map(
      (
        header,
        index
      ) => {
        if (
          imageColumns.some(
            (
              column
            ) =>
              column.localeCompare(
                header,
                'pt-PT',
                {
                  sensitivity:
                    'base'
                }
              ) ===
              0
          )
        ) {
          return 'produto-01.jpg'
        }

        if (
          /pre[cç]o/i.test(
            header
          )
        ) {
          return '19,90 €'
        }

        if (
          /data/i.test(
            header
          )
        ) {
          return '23/08/2026'
        }

        return index ===
          0
          ? 'Exemplo A'
          : `Valor ${index + 1}`
      }
    )

  return `${headers.join(
    ';'
  )}\n${values.join(
    ';'
  )}`
}

function formatBytes(
  value:
    number
) {
  if (
    value <
    1024 *
      1024
  ) {
    return `${Math.max(
      1,
      Math.round(
        value /
        1024
      )
    )} KB`
  }

  return `${(
    value /
    1024 /
    1024
  ).toLocaleString(
    'pt-PT',
    {
      maximumFractionDigits:
        1
    }
  )} MB`
}

export default function BulkCreateProControl() {
  const editor =
    useMAQuadroEditorContext()

  const csvInputRef =
    useRef<
      HTMLInputElement |
      null
    >(
      null
    )

  const imageInputRef =
    useRef<
      HTMLInputElement |
      null
    >(
      null
    )

  const [
    open,
    setOpen
  ] =
    useState(
      false
    )

  const [
    preparing,
    setPreparing
  ] =
    useState(
      false
    )

  const [
    generating,
    setGenerating
  ] =
    useState(
      false
    )

  const [
    csv,
    setCsv
  ] =
    useState<
      MAQuadroBulkCsv |
      null
    >(
      null
    )

  const [
    csvFileName,
    setCsvFileName
  ] =
    useState(
      ''
    )

  const [
    imageFiles,
    setImageFiles
  ] =
    useState<
      File[]
    >(
      []
    )

  const [
    message,
    setMessage
  ] =
    useState(
      ''
    )

  const placeholders =
    useMemo(
      () =>
        editor.activePage
          ? findMAQuadroBulkPlaceholders(
              editor.activePage
            )
          : [],
      [
        editor.activePage
      ]
    )

  const imageBindings =
    useMemo(
      () =>
        editor.activePage
          ? findMAQuadroBulkImageBindings(
              editor.activePage
            )
          : [],
      [
        editor.activePage
      ]
    )

  const imageColumns =
    useMemo(
      () =>
        Array.from(
          new Set(
            imageBindings.map(
              (
                binding
              ) =>
                binding.column
            )
          )
        ),
      [
        imageBindings
      ]
    )

  const missingColumns =
    useMemo(
      () =>
        csv
          ? findMissingMAQuadroBulkColumns(
              placeholders,
              csv.headers
            )
          : [],
      [
        csv,
        placeholders
      ]
    )

  const imageAnalysis =
    useMemo(
      () =>
        csv
          ? analyseMAQuadroBulkImageReferences(
              imageBindings,
              csv.rows,
              imageFiles
            )
          : {
              requested:
                0,

              matched:
                0,

              missing:
                [] as
                  string[],

              uniqueMatchedFiles:
                0
            },
      [
        csv,
        imageBindings,
        imageFiles
      ]
    )

  const imageTotalBytes =
    useMemo(
      () =>
        imageFiles.reduce(
          (
            total,
            file
          ) =>
            total +
            file.size,
          0
        ),
      [
        imageFiles
      ]
    )

  const estimatedCharacters =
    useMemo(
      () =>
        editor.activePage &&
        csv
          ? estimateMAQuadroBulkCharacters(
              editor.activePage,
              csv.rows.length
            )
          : 0,
      [
        csv,
        editor.activePage
      ]
    )

  const locked =
    !editor.ready ||
    editor.busy ||
    editor.structureBusy ||
    editor.imageCropEditing ||
    preparing ||
    generating

  const imageRequirementsReady =
    imageBindings.length ===
      0 ||
    (
      imageAnalysis.missing
        .length ===
        0 &&
      (
        imageAnalysis.requested ===
          0 ||
        imageFiles.length >
          0
      )
    )

  const canGenerate =
    Boolean(
      csv &&
      csv.rows.length >
        0 &&
      placeholders.length >
        0 &&
      missingColumns.length ===
        0 &&
      imageRequirementsReady &&
      imageTotalBytes <=
        MA_QUADRO_BULK_IMAGE_MAX_TOTAL_BYTES &&
      estimatedCharacters <=
        MA_QUADRO_BULK_MAX_ESTIMATED_CHARACTERS &&
      editor.project &&
      editor.activePage &&
      !editor.project.isTemplate &&
      !generating
    )

  useEffect(
    () => {
      if (
        !open
      ) {
        return
      }

      const previousOverflow =
        document.body
          .style
          .overflow

      document.body
        .style
        .overflow =
        'hidden'

      const handleKeyDown =
        (
          event:
            KeyboardEvent
        ) => {
          if (
            event.key ===
              'Escape' &&
            !generating
          ) {
            setOpen(
              false
            )
          }
        }

      window.addEventListener(
        'keydown',
        handleKeyDown
      )

      return () => {
        document.body
          .style
          .overflow =
          previousOverflow

        window.removeEventListener(
          'keydown',
          handleKeyDown
        )
      }
    },
    [
      generating,
      open
    ]
  )

  const openDialog =
    async () => {
      if (
        locked ||
        !editor.project ||
        !editor.activePage
      ) {
        return
      }

      setPreparing(
        true
      )

      setMessage(
        ''
      )

      setCsv(
        null
      )

      setCsvFileName(
        ''
      )

      setImageFiles(
        []
      )

      try {
        const saved =
          await editor.saveProject(
            true
          )

        setOpen(
          true
        )

        if (
          !saved
        ) {
          setMessage(
            'Não foi possível guardar o design antes de preparar a criação em massa.'
          )
        }
      } finally {
        setPreparing(
          false
        )
      }
    }

  const handleCsv =
    async (
      event:
        ChangeEvent<HTMLInputElement>
    ) => {
      const file =
        event.currentTarget
          .files?.[0]

      event.currentTarget
        .value =
        ''

      if (
        !file
      ) {
        return
      }

      setMessage(
        ''
      )

      if (
        file.size >
        MA_QUADRO_BULK_MAX_FILE_BYTES
      ) {
        setCsv(
          null
        )

        setCsvFileName(
          ''
        )

        setMessage(
          'O CSV ultrapassa o limite de 5 MB.'
        )

        return
      }

      try {
        const parsed =
          parseMAQuadroBulkCsv(
            await file.text()
          )

        setCsv(
          parsed
        )

        setCsvFileName(
          file.name
        )
      } catch (
        error
      ) {
        setCsv(
          null
        )

        setCsvFileName(
          ''
        )

        setMessage(
          error instanceof
            Error
            ? error.message
            : 'Não foi possível ler o CSV.'
        )
      }
    }

  const handleImages =
    (
      event:
        ChangeEvent<HTMLInputElement>
    ) => {
      /*
       * Snapshot primeiro:
       * Safari invalida FileList
       * depois de limpar o input.
       */
      const files =
        Array.from(
          event.currentTarget
            .files ||
          []
        )

      event.currentTarget
        .value =
        ''

      if (
        files.length ===
        0
      ) {
        return
      }

      const unsupported =
        files.find(
          (
            file
          ) =>
            !file.type
              .startsWith(
                'image/'
              )
        )

      if (
        unsupported
      ) {
        setMessage(
          `${unsupported.name} não é uma imagem suportada.`
        )

        return
      }

      const oversized =
        files.find(
          (
            file
          ) =>
            file.size >
            MA_QUADRO_BULK_IMAGE_MAX_FILE_BYTES
        )

      if (
        oversized
      ) {
        setMessage(
          `${oversized.name} ultrapassa o limite de 25 MB por imagem.`
        )

        return
      }

      const total =
        files.reduce(
          (
            sum,
            file
          ) =>
            sum +
            file.size,
          0
        )

      if (
        total >
        MA_QUADRO_BULK_IMAGE_MAX_TOTAL_BYTES
      ) {
        setMessage(
          'As imagens selecionadas ultrapassam 80 MB no total. Selecione apenas os ficheiros usados pelo CSV.'
        )

        return
      }

      setImageFiles(
        files
      )

      setMessage(
        ''
      )
    }

  const generate =
    async () => {
      const sourceProject =
        editor.project

      const templatePage =
        editor.activePage

      if (
        !sourceProject ||
        !templatePage ||
        !csv ||
        !canGenerate
      ) {
        return
      }

      setGenerating(
        true
      )

      setMessage(
        ''
      )

      try {
        const saved =
          await editor.saveProject(
            true
          )

        if (
          !saved
        ) {
          setMessage(
            'Não foi possível guardar o projeto antes da criação em massa.'
          )

          return
        }

        const generated =
          createMAQuadroBulkProject(
            sourceProject,
            templatePage.id,
            csv.rows
          )

        await applyMAQuadroBulkImages(
          generated,
          templatePage,
          csv.rows,
          imageFiles
        )

        const serialized =
          JSON.stringify(
            generated
          )

        if (
          serialized.length >
          90_000_000
        ) {
          setMessage(
            'O projeto gerado ficaria demasiado grande. Reduza o número de linhas, a resolução das fotografias ou simplifique a página modelo.'
          )

          return
        }

        const file =
          new File(
            [
              serialized
            ],
            `${generated.name}.ma-quadro.json`,
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

            value:
              ''
          }
        } as unknown as
          Parameters<
            typeof editor.importProject
          >[0]

        await editor.importProject(
          syntheticEvent
        )

        setOpen(
          false
        )
      } catch (
        error
      ) {
        console.error(
          error
        )

        setMessage(
          error instanceof
            Error
            ? error.message
            : 'Não foi possível gerar o projeto. O design original não foi alterado.'
        )
      } finally {
        setGenerating(
          false
        )
      }
    }

  const previewRows =
    csv?.rows.slice(
      0,
      3
    ) ||
    []

  const dialog =
    open
      ? createPortal(
          <div
            className="mq-bulk-create-backdrop"
            role="presentation"
            onMouseDown={(
              event
            ) => {
              if (
                event.target ===
                  event.currentTarget &&
                !generating
              ) {
                setOpen(
                  false
                )
              }
            }}
          >
            <section
              className="mq-bulk-create-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="mq-bulk-create-title"
              aria-describedby="mq-bulk-create-description"
            >
              <header className="mq-bulk-create-dialog__header">
                <span
                  className="mq-bulk-create-dialog__symbol"
                  aria-hidden="true"
                >
                  ≋
                </span>

                <span>
                  <strong id="mq-bulk-create-title">
                    Criação em massa Pro
                  </strong>

                  <small id="mq-bulk-create-description">
                    Gere uma página por linha do CSV, incluindo texto, QR e fotografias locais diferentes em cada página.
                  </small>
                </span>

                <button
                  type="button"
                  className="mq-bulk-create-dialog__close"
                  disabled={
                    generating
                  }
                  aria-label="Fechar"
                  title="Fechar"
                  onClick={() =>
                    setOpen(
                      false
                    )
                  }
                >
                  ×
                </button>
              </header>

              <div className="mq-bulk-create-dialog__body">
                <section className="mq-bulk-create-step">
                  <div className="mq-bulk-create-step__heading">
                    <span>
                      1
                    </span>

                    <div>
                      <strong>
                        Prepare o design-modelo
                      </strong>

                      <small>
                        Use {'{nome}'}, {'{preco}'}, etc. em texto. Para fotografias, renomeie a própria camada de imagem para {'{imagem}'} ou outro nome de coluna.
                      </small>
                    </div>
                  </div>

                  <div className="mq-bulk-create-placeholders">
                    {placeholders.length >
                    0 ? (
                      placeholders.map(
                        (
                          placeholder
                        ) => (
                          <code
                            key={
                              placeholder
                            }
                          >
                            {'{'}
                            {
                              placeholder
                            }
                            {'}'}
                          </code>
                        )
                      )
                    ) : (
                      <span>
                        Ainda não foram encontrados placeholders na página atual.
                      </span>
                    )}
                  </div>

                  {imageBindings.length >
                  0 ? (
                    <div className="mq-bulk-images-bindings">
                      <strong>
                        {imageBindings.length}{' '}
                        imagem
                        {imageBindings.length ===
                        1
                          ? ''
                          : 'ns'}{' '}
                        ligada
                        {imageBindings.length ===
                        1
                          ? ''
                          : 's'}{' '}
                        ao CSV
                      </strong>

                      <div>
                        {imageBindings.map(
                          (
                            binding
                          ) => (
                            <span
                              key={
                                binding.objectId
                              }
                            >
                              <code>
                                {
                                  binding.layerName
                                }
                              </code>

                              <small>
                                coluna{' '}
                                {
                                  binding.column
                                }{' '}
                                ·{' '}
                                {
                                  binding.templateWidth
                                }{' '}
                                ×{' '}
                                {
                                  binding.templateHeight
                                }
                              </small>
                            </span>
                          )
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="mq-bulk-images-hint">
                      <span
                        aria-hidden="true"
                      >
                        ▧
                      </span>

                      <p>
                        Para variar uma fotografia, adicione uma imagem-modelo e renomeie a camada em <strong>Camadas</strong> para, por exemplo, <code>{'{imagem}'}</code>. A coluna <strong>imagem</strong> do CSV deverá conter os nomes dos ficheiros.
                      </p>
                    </div>
                  )}

                  <pre className="mq-bulk-create-example">
                    {
                      exampleCsv(
                        placeholders,
                        imageColumns
                      )
                    }
                  </pre>
                </section>

                <section className="mq-bulk-create-step">
                  <div className="mq-bulk-create-step__heading">
                    <span>
                      2
                    </span>

                    <div>
                      <strong>
                        Escolha o CSV
                      </strong>

                      <small>
                        Vírgula, ponto e vírgula ou tabulação · máximo de 200 linhas · processamento local.
                      </small>
                    </div>
                  </div>

                  <input
                    ref={
                      csvInputRef
                    }
                    type="file"
                    accept=".csv,text/csv,text/plain"
                    disabled={
                      generating
                    }
                    onChange={(
                      event
                    ) =>
                      void handleCsv(
                        event
                      )
                    }
                    hidden
                  />

                  <button
                    type="button"
                    className="mq-bulk-create-upload"
                    disabled={
                      generating
                    }
                    onClick={() =>
                      csvInputRef.current
                        ?.click()
                    }
                  >
                    <span
                      aria-hidden="true"
                    >
                      ↑
                    </span>

                    <span>
                      <strong>
                        {csvFileName ||
                          'Importar CSV'}
                      </strong>

                      <small>
                        O ficheiro nunca sai deste dispositivo.
                      </small>
                    </span>
                  </button>

                  {csv ? (
                    <div className="mq-bulk-create-summary">
                      <span>
                        <strong>
                          {
                            csv.rows.length
                          }
                        </strong>

                        <small>
                          páginas a gerar
                        </small>
                      </span>

                      <span>
                        <strong>
                          {
                            csv.headers.length
                          }
                        </strong>

                        <small>
                          colunas
                        </small>
                      </span>

                      <span>
                        <strong>
                          {
                            delimiterLabel(
                              csv.delimiter
                            )
                          }
                        </strong>

                        <small>
                          separador
                        </small>
                      </span>
                    </div>
                  ) : null}

                  {missingColumns.length >
                  0 ? (
                    <div className="mq-bulk-create-warning">
                      <strong>
                        Faltam colunas no CSV:
                      </strong>

                      <span>
                        {
                          missingColumns.join(
                            ', '
                          )
                        }
                      </span>
                    </div>
                  ) : null}
                </section>

                {imageBindings.length >
                0 ? (
                  <section className="mq-bulk-create-step mq-bulk-images-step">
                    <div className="mq-bulk-create-step__heading">
                      <span>
                        3
                      </span>

                      <div>
                        <strong>
                          Selecione as fotografias
                        </strong>

                        <small>
                          Selecione de uma vez os ficheiros mencionados nas colunas de imagem do CSV. A correspondência é feita pelo nome do ficheiro.
                        </small>
                      </div>
                    </div>

                    <input
                      ref={
                        imageInputRef
                      }
                      type="file"
                      accept="image/*"
                      multiple
                      disabled={
                        generating
                      }
                      onChange={
                        handleImages
                      }
                      hidden
                    />

                    <button
                      type="button"
                      className="mq-bulk-create-upload mq-bulk-images-upload"
                      disabled={
                        generating
                      }
                      onClick={() =>
                        imageInputRef.current
                          ?.click()
                      }
                    >
                      <span
                        aria-hidden="true"
                      >
                        ▧
                      </span>

                      <span>
                        <strong>
                          {imageFiles.length >
                          0
                            ? `${imageFiles.length} ficheiro${imageFiles.length === 1 ? '' : 's'} selecionado${imageFiles.length === 1 ? '' : 's'}`
                            : 'Selecionar fotografias'}
                        </strong>

                        <small>
                          Até 25 MB por imagem e 80 MB no total selecionado.
                        </small>
                      </span>
                    </button>

                    {imageFiles.length >
                    0 ? (
                      <div className="mq-bulk-images-summary">
                        <span>
                          <strong>
                            {
                              imageAnalysis.matched
                            }
                            /
                            {
                              imageAnalysis.requested
                            }
                          </strong>

                          <small>
                            referências encontradas
                          </small>
                        </span>

                        <span>
                          <strong>
                            {
                              imageAnalysis.uniqueMatchedFiles
                            }
                          </strong>

                          <small>
                            ficheiros utilizados
                          </small>
                        </span>

                        <span>
                          <strong>
                            {
                              formatBytes(
                                imageTotalBytes
                              )
                            }
                          </strong>

                          <small>
                            selecionados
                          </small>
                        </span>
                      </div>
                    ) : null}

                    {csv &&
                    imageAnalysis.requested ===
                      0 ? (
                      <div className="mq-bulk-images-hint">
                        <span
                          aria-hidden="true"
                        >
                          i
                        </span>

                        <p>
                          As colunas de imagem estão vazias neste CSV. As páginas manterão a fotografia-modelo original.
                        </p>
                      </div>
                    ) : null}

                    {imageAnalysis.missing.length >
                    0 ? (
                      <div className="mq-bulk-create-warning">
                        <strong>
                          Faltam{' '}
                          {
                            imageAnalysis.missing.length
                          }{' '}
                          ficheiro
                          {imageAnalysis.missing.length ===
                          1
                            ? ''
                            : 's'}
                          :
                        </strong>

                        <span>
                          {imageAnalysis.missing
                            .slice(
                              0,
                              8
                            )
                            .join(
                              ', '
                            )}

                          {imageAnalysis.missing.length >
                          8
                            ? '…'
                            : ''}
                        </span>
                      </div>
                    ) : null}

                    <p className="mq-bulk-images-preserve">
                      Cada fotografia é preparada localmente com enquadramento <strong>Preencher</strong>. O MA-Quadro mantém a posição, tamanho, crop, filtros e moldura da imagem-modelo.
                    </p>
                  </section>
                ) : null}

                {csv ? (
                  <section className="mq-bulk-create-step">
                    <div className="mq-bulk-create-step__heading">
                      <span>
                        {imageBindings.length >
                        0
                          ? '4'
                          : '3'}
                      </span>

                      <div>
                        <strong>
                          Pré-visualização dos dados
                        </strong>

                        <small>
                          São mostradas apenas as primeiras três linhas.
                        </small>
                      </div>
                    </div>

                    <div className="mq-bulk-create-table-wrap">
                      <table className="mq-bulk-create-table">
                        <thead>
                          <tr>
                            {csv.headers.map(
                              (
                                header
                              ) => (
                                <th
                                  key={
                                    header
                                  }
                                >
                                  {
                                    header
                                  }
                                </th>
                              )
                            )}
                          </tr>
                        </thead>

                        <tbody>
                          {previewRows.map(
                            (
                              row,
                              index
                            ) => (
                              <tr
                                key={
                                  index
                                }
                              >
                                {csv.headers.map(
                                  (
                                    header
                                  ) => (
                                    <td
                                      key={`${index}-${header}`}
                                    >
                                      {
                                        row[
                                          header
                                        ]
                                      }
                                    </td>
                                  )
                                )}
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>
                ) : null}

                {estimatedCharacters >
                MA_QUADRO_BULK_MAX_ESTIMATED_CHARACTERS ? (
                  <div className="mq-bulk-create-warning">
                    Este design é demasiado pesado para gerar tantas páginas de uma só vez. Reduza o número de linhas do CSV.
                  </div>
                ) : null}

                <div className="mq-bulk-create-note">
                  <span
                    aria-hidden="true"
                  >
                    i
                  </span>

                  <p>
                    As fotografias são incorporadas apenas na nova cópia gerada. Não são enviadas para a MA-CODE, não entram numa biblioteca de stock e o design-modelo original permanece intacto.
                  </p>
                </div>

                {message ? (
                  <p
                    className="mq-bulk-create-message"
                    role="status"
                  >
                    {
                      message
                    }
                  </p>
                ) : null}
              </div>

              <footer className="mq-bulk-create-dialog__footer">
                <span>
                  O projeto original permanece intacto.
                </span>

                <div>
                  <button
                    type="button"
                    disabled={
                      generating
                    }
                    onClick={() =>
                      setOpen(
                        false
                      )
                    }
                  >
                    Cancelar
                  </button>

                  <button
                    type="button"
                    className="is-primary"
                    disabled={
                      !canGenerate
                    }
                    aria-busy={
                      generating
                    }
                    onClick={() =>
                      void generate()
                    }
                  >
                    {generating
                      ? 'A gerar páginas…'
                      : csv
                        ? `Gerar ${csv.rows.length} página${csv.rows.length === 1 ? '' : 's'}`
                        : 'Gerar páginas'}
                  </button>
                </div>
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
        className="mq-tool-discovery__button mq-bulk-create-trigger mq-bulk-create-pro-trigger"
        disabled={
          locked ||
          !editor.project ||
          !editor.activePage
        }
        aria-busy={
          preparing
        }
        title="Gerar várias páginas a partir de CSV, incluindo fotografias locais"
        onClick={() =>
          void openDialog()
        }
      >
        <span
          className="mq-tool-discovery__icon"
          aria-hidden="true"
        >
          ≋
        </span>

        <span>
          {preparing
            ? 'A preparar…'
            : 'Criar em massa'}
        </span>
      </button>

      {
        dialog
      }
    </>
  )
}
