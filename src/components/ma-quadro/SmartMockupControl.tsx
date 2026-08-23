import {
  useEffect,
  useState
} from 'react'

import {
  createPortal
} from 'react-dom'

import {
  downloadMAQuadroBlob
} from '../../lib/maQuadro/export'

import {
  safeMAQuadroFileName
} from '../../lib/maQuadro/project'

import {
  createMAQuadroSmartMockup,
  MA_QUADRO_SMART_MOCKUPS,
  type MAQuadroSmartMockupFit,
  type MAQuadroSmartMockupKind,
  type MAQuadroSmartMockupTheme
} from '../../lib/maQuadro/smartMockups'

import {
  useMAQuadroEditorContext
} from './editorContext'

import './maQuadroSmartMockups.css'

function suggestedMockup(
  width: number,
  height: number
): MAQuadroSmartMockupKind {
  const ratio =
    width /
    Math.max(
      1,
      height
    )

  if (
    ratio <
    0.8
  ) {
    return 'phone'
  }

  if (
    ratio >
    1.3
  ) {
    return 'laptop'
  }

  return 'card'
}

export default function SmartMockupControl() {
  const editor =
    useMAQuadroEditorContext()

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
    selected,
    setSelected
  ] =
    useState<MAQuadroSmartMockupKind>(
      'phone'
    )

  const [
    fit,
    setFit
  ] =
    useState<MAQuadroSmartMockupFit>(
      'contain'
    )

  const [
    theme,
    setTheme
  ] =
    useState<MAQuadroSmartMockupTheme>(
      'light'
    )

  const [
    message,
    setMessage
  ] = useState(
    ''
  )

  const locked =
    !editor.ready ||
    editor.busy ||
    editor.structureBusy ||
    editor.imageCropEditing ||
    preparing ||
    generating

  const brandColor =
    editor.brand.colors[0]
      ?.value

  useEffect(
    () => {
      if (
        !open
      ) {
        return
      }

      const previousOverflow =
        document.body.style
          .overflow

      document.body.style
        .overflow =
        'hidden'

      const handleKeyDown = (
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
        document.body.style
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

      try {
        const saved =
          await editor.saveProject(
            true
          )

        if (
          !saved
        ) {
          setMessage(
            'Não foi possível preparar o design para o mockup.'
          )

          return
        }

        setSelected(
          suggestedMockup(
            editor.activePage.width,
            editor.activePage.height
          )
        )

        setOpen(
          true
        )
      } finally {
        setPreparing(
          false
        )
      }
    }

  const generate =
    async (
      action:
        | 'add'
        | 'download'
    ) => {
      const page =
        editor.activePage

      const project =
        editor.project

      if (
        !page ||
        !project ||
        generating
      ) {
        return
      }

      setGenerating(
        true
      )

      setMessage(
        'A criar o mockup localmente…'
      )

      try {
        const blob =
          await createMAQuadroSmartMockup(
            page,
            selected,
            {
              fit,
              theme,
              brandColor
            }
          )

        const definition =
          MA_QUADRO_SMART_MOCKUPS.find(
            (
              item
            ) =>
              item.id ===
              selected
          )

        const baseName =
          `${safeMAQuadroFileName(
            project.name
          )}-mockup-${selected}`

        if (
          action ===
          'download'
        ) {
          downloadMAQuadroBlob(
            blob,
            `${baseName}.png`
          )

          setMessage(
            'Mockup criado e preparado para descarregar.'
          )

          return
        }

        const file =
          new File(
            [
              blob
            ],
            `${baseName}.png`,
            {
              type:
                'image/png',

              lastModified:
                Date.now()
            }
          )

        await editor.handleDroppedFiles(
          [
            file
          ]
        )

        setMessage(
          `${definition?.name || 'Mockup'} adicionado ao design.`
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
            : 'Não foi possível criar o mockup.'
        )
      } finally {
        setGenerating(
          false
        )
      }
    }

  const dialog =
    open
      ? createPortal(
          <div
            className="mq-smart-mockup-backdrop"
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
              className="mq-smart-mockup-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="mq-smart-mockup-title"
              aria-describedby="mq-smart-mockup-description"
            >
              <header className="mq-smart-mockup-dialog__header">
                <span
                  className="mq-smart-mockup-dialog__symbol"
                  aria-hidden="true"
                >
                  ▣
                </span>

                <span>
                  <strong id="mq-smart-mockup-title">
                    Mockups inteligentes
                  </strong>

                  <small id="mq-smart-mockup-description">
                    Coloque a página atual num dispositivo ou cenário sem enviar o design para nenhum servidor.
                  </small>
                </span>

                <button
                  type="button"
                  className="mq-smart-mockup-dialog__close"
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

              <div className="mq-smart-mockup-dialog__body">
                <div className="mq-smart-mockup-grid">
                  {MA_QUADRO_SMART_MOCKUPS.map(
                    (
                      mockup
                    ) => {
                      const active =
                        selected ===
                        mockup.id

                      return (
                        <button
                          key={
                            mockup.id
                          }
                          type="button"
                          className={`mq-smart-mockup-card is-${mockup.id}${
                            active
                              ? ' is-active'
                              : ''
                          }`}
                          disabled={
                            generating
                          }
                          aria-pressed={
                            active
                          }
                          onClick={() =>
                            setSelected(
                              mockup.id
                            )
                          }
                        >
                          <span
                            className="mq-smart-mockup-card__scene"
                            aria-hidden="true"
                          >
                            <span className="mq-smart-mockup-card__device">
                              <span />
                            </span>
                          </span>

                          <span className="mq-smart-mockup-card__copy">
                            <strong>
                              {
                                mockup.name
                              }
                            </strong>

                            <small>
                              {
                                mockup.description
                              }
                            </small>
                          </span>

                          <span
                            className="mq-smart-mockup-card__check"
                            aria-hidden="true"
                          >
                            {active
                              ? '✓'
                              : '+'}
                          </span>
                        </button>
                      )
                    }
                  )}
                </div>

                <aside className="mq-smart-mockup-settings">
                  <section>
                    <strong>
                      Enquadramento
                    </strong>

                    <small>
                      Escolha entre mostrar todo o design ou preencher completamente a área do mockup.
                    </small>

                    <div className="mq-smart-mockup-segmented">
                      <button
                        type="button"
                        className={
                          fit ===
                          'contain'
                            ? 'is-active'
                            : ''
                        }
                        disabled={
                          generating
                        }
                        aria-pressed={
                          fit ===
                          'contain'
                        }
                        onClick={() =>
                          setFit(
                            'contain'
                          )
                        }
                      >
                        Mostrar tudo
                      </button>

                      <button
                        type="button"
                        className={
                          fit ===
                          'cover'
                            ? 'is-active'
                            : ''
                        }
                        disabled={
                          generating
                        }
                        aria-pressed={
                          fit ===
                          'cover'
                        }
                        onClick={() =>
                          setFit(
                            'cover'
                          )
                        }
                      >
                        Preencher
                      </button>
                    </div>
                  </section>

                  <section>
                    <strong>
                      Ambiente
                    </strong>

                    <small>
                      O cenário é gerado localmente e não depende de fotografias de stock.
                    </small>

                    <div className="mq-smart-mockup-themes">
                      <button
                        type="button"
                        className={`is-light${
                          theme ===
                          'light'
                            ? ' is-active'
                            : ''
                        }`}
                        disabled={
                          generating
                        }
                        aria-pressed={
                          theme ===
                          'light'
                        }
                        onClick={() =>
                          setTheme(
                            'light'
                          )
                        }
                      >
                        <span />

                        Claro
                      </button>

                      <button
                        type="button"
                        className={`is-dark${
                          theme ===
                          'dark'
                            ? ' is-active'
                            : ''
                        }`}
                        disabled={
                          generating
                        }
                        aria-pressed={
                          theme ===
                          'dark'
                        }
                        onClick={() =>
                          setTheme(
                            'dark'
                          )
                        }
                      >
                        <span />

                        Escuro
                      </button>

                      <button
                        type="button"
                        className={`is-brand${
                          theme ===
                          'brand'
                            ? ' is-active'
                            : ''
                        }`}
                        disabled={
                          generating
                        }
                        aria-pressed={
                          theme ===
                          'brand'
                        }
                        onClick={() =>
                          setTheme(
                            'brand'
                          )
                        }
                      >
                        <span
                          style={{
                            background:
                              brandColor ||
                              '#7C3AED'
                          }}
                        />

                        Marca
                      </button>
                    </div>
                  </section>

                  <div className="mq-smart-mockup-note">
                    <span
                      aria-hidden="true"
                    >
                      i
                    </span>

                    <p>
                      O mockup é criado a partir de uma imagem da página atual e entra no design como uma nova camada PNG. O design original e os seus elementos continuam intactos.
                    </p>
                  </div>
                </aside>
              </div>

              {message ? (
                <p
                  className="mq-smart-mockup-message"
                  role="status"
                >
                  {
                    message
                  }
                </p>
              ) : null}

              <footer className="mq-smart-mockup-dialog__footer">
                <span>
                  Sem uploads · sem stock · processamento local
                </span>

                <div>
                  <button
                    type="button"
                    disabled={
                      generating
                    }
                    onClick={() =>
                      void generate(
                        'download'
                      )
                    }
                  >
                    Descarregar PNG
                  </button>

                  <button
                    type="button"
                    className="is-primary"
                    disabled={
                      generating
                    }
                    aria-busy={
                      generating
                    }
                    onClick={() =>
                      void generate(
                        'add'
                      )
                    }
                  >
                    {generating
                      ? 'A criar mockup…'
                      : 'Adicionar ao design'}
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
        className="mq-tool-discovery__button mq-smart-mockup-trigger"
        disabled={
          locked ||
          !editor.project ||
          !editor.activePage
        }
        aria-busy={
          preparing
        }
        title="Criar um mockup local a partir da página atual"
        onClick={() =>
          void openDialog()
        }
      >
        <span
          className="mq-tool-discovery__icon"
          aria-hidden="true"
        >
          ▣
        </span>

        <span>
          {preparing
            ? 'A preparar…'
            : 'Mockups'}
        </span>
      </button>

      {
        dialog
      }
    </>
  )
}
