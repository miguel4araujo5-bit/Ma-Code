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
  useMAQuadroEditorContext
} from './editorContext'

import './maQuadroBulkCreate.css'

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
    string[]
) {
  const headers =
    placeholders.length >
    0
      ? placeholders
      : [
          'nome',
          'preco',
          'data'
        ]

  const values =
    headers.map(
      (
        header,
        index
      ) => {
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

export default function BulkCreateControl() {
  const editor =
    useMAQuadroEditorContext()

  const inputRef =
    useRef<
      HTMLInputElement |
      null
    >(
      null
    )

  const [
    open,
    setOpen
  ] = useState(
    false
  )

  const [
    preparing,
    setPreparing
  ] = useState(
    false
  )

  const [
    generating,
    setGenerating
  ] = useState(
    false
  )

  const [
    csv,
    setCsv
  ] = useState<
    MAQuadroBulkCsv |
    null
  >(
    null
  )

  const [
    fileName,
    setFileName
  ] = useState(
    ''
  )

  const [
    message,
    setMessage
  ] = useState(
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

  const canGenerate =
    Boolean(
      csv &&
      csv.rows.length >
        0 &&
      placeholders.length >
        0 &&
      missingColumns.length ===
        0 &&
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

      setFileName(
        ''
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

        setFileName(
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

        setFileName(
          file.name
        )
      } catch (
        error
      ) {
        setCsv(
          null
        )

        setFileName(
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

        const serialized =
          JSON.stringify(
            generated
          )

        if (
          serialized.length >
          90_000_000
        ) {
          setMessage(
            'O projeto gerado ficaria demasiado grande. Reduza o número de linhas ou simplifique a página modelo.'
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
            value: ''
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
          'Não foi possível gerar o projeto. O design original não foi alterado.'
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
    ) ??
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
                    Criação em massa
                  </strong>

                  <small id="mq-bulk-create-description">
                    Use a página atual como modelo e gere uma página por linha de um CSV.
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
                        Prepare o design
                      </strong>

                      <small>
                        Escreva nomes de colunas entre chavetas nos textos ou campos serializados.
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

                  <pre className="mq-bulk-create-example">
                    {
                      exampleCsv(
                        placeholders
                      )
                    }
                  </pre>

                  <p className="mq-bulk-create-help">
                    Exemplo: se o design contém{' '}
                    <code>
                      {'{nome}'}
                    </code>{' '}
                    e{' '}
                    <code>
                      {'{preco}'}
                    </code>
                    , o CSV precisa de ter as colunas{' '}
                    <strong>
                      nome
                    </strong>{' '}
                    e{' '}
                    <strong>
                      preco
                    </strong>
                    . A correspondência ignora maiúsculas e acentos.
                  </p>
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
                        Vírgula, ponto e vírgula ou tabulação · máximo de 200 linhas · tudo processado localmente.
                      </small>
                    </div>
                  </div>

                  <input
                    ref={
                      inputRef
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
                      inputRef.current
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
                        {fileName ||
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

                  {estimatedCharacters >
                  MA_QUADRO_BULK_MAX_ESTIMATED_CHARACTERS ? (
                    <div className="mq-bulk-create-warning">
                      Este design é demasiado pesado para gerar tantas páginas de uma só vez. Reduza o número de linhas do CSV.
                    </div>
                  ) : null}
                </section>

                {csv ? (
                  <section className="mq-bulk-create-step">
                    <div className="mq-bulk-create-step__heading">
                      <span>
                        3
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

                <div className="mq-bulk-create-note">
                  <span
                    aria-hidden="true"
                  >
                    i
                  </span>

                  <p>
                    A primeira versão substitui valores serializados, sendo ideal para texto, preços, datas, códigos, URLs de QR e outros campos textuais. A associação automática de ficheiros de imagem por coluna ficará para uma evolução separada, para não introduzir uploads frágeis neste fluxo.
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
                        ? `Gerar ${csv.rows.length} página${
                            csv.rows.length ===
                            1
                              ? ''
                              : 's'
                          }`
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
        className="mq-tool-discovery__button mq-bulk-create-trigger"
        disabled={
          locked ||
          !editor.project ||
          !editor.activePage
        }
        aria-busy={
          preparing
        }
        title="Gerar várias páginas a partir de um CSV"
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
