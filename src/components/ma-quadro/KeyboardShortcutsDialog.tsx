import {
  useEffect,
  useRef
} from 'react'

type ShortcutItem = {
  keys: string[]
  description: string
}

type ShortcutGroup = {
  title: string
  items: ShortcutItem[]
}

const shortcutGroups:
  ShortcutGroup[] = [
    {
      title:
        'Edição',

      items: [
        {
          keys: [
            'Ctrl/Cmd',
            'Z'
          ],

          description:
            'Desfazer'
        },
        {
          keys: [
            'Ctrl/Cmd',
            'Shift',
            'Z'
          ],

          description:
            'Refazer'
        },
        {
          keys: [
            'Ctrl/Cmd',
            'Y'
          ],

          description:
            'Refazer'
        },
        {
          keys: [
            'Ctrl/Cmd',
            'C'
          ],

          description:
            'Copiar seleção'
        },
        {
          keys: [
            'Ctrl/Cmd',
            'V'
          ],

          description:
            'Colar seleção'
        },
        {
          keys: [
            'Ctrl/Cmd',
            'D'
          ],

          description:
            'Duplicar seleção'
        },
        {
          keys: [
            'Ctrl/Cmd',
            'Alt',
            'C'
          ],

          description:
            'Copiar estilo da seleção'
        },
        {
          keys: [
            'Ctrl/Cmd',
            'Alt',
            'V'
          ],

          description:
            'Colar estilo na seleção'
        },
        {
          keys: [
            'Delete'
          ],

          description:
            'Eliminar seleção'
        }
      ]
    },
    {
      title:
        'Seleção e movimento',

      items: [
        {
          keys: [
            'Ctrl/Cmd',
            'A'
          ],

          description:
            'Selecionar todos os elementos'
        },
        {
          keys: [
            'Alt/Option',
            'Arrastar'
          ],

          description:
            'Duplicar um elemento enquanto o arrasta'
        },
        {
          keys: [
            '←',
            '↑',
            '→',
            '↓'
          ],

          description:
            'Mover 1 píxel'
        },
        {
          keys: [
            'Shift',
            'Seta'
          ],

          description:
            'Mover 10 píxeis'
        },
        {
          keys: [
            'Shift',
            'F10'
          ],

          description:
            'Abrir o menu contextual da seleção'
        },
        {
          keys: [
            'Menu'
          ],

          description:
            'Abrir o menu contextual em teclados compatíveis'
        },
        {
          keys: [
            'Esc'
          ],

          description:
            'Desselecionar ou sair da ferramenta atual'
        }
      ]
    },
    {
      title:
        'Navegação',

      items: [
        {
          keys: [
            'Espaço',
            'Arrastar'
          ],

          description:
            'Mover a área de trabalho'
        },
        {
          keys: [
            'Roda central',
            'Arrastar'
          ],

          description:
            'Mover a área de trabalho'
        },
        {
          keys: [
            'Ctrl/Cmd',
            'Roda'
          ],

          description:
            'Aumentar ou diminuir o zoom'
        },
        {
          keys: [
            '?'
          ],

          description:
            'Abrir esta lista de atalhos'
        }
      ]
    },
    {
      title:
        'Projeto e imagens',

      items: [
        {
          keys: [
            'Ctrl/Cmd',
            'S'
          ],

          description:
            'Guardar projeto'
        },
        {
          keys: [
            'Enter'
          ],

          description:
            'Concluir recorte de imagem'
        },
        {
          keys: [
            'Esc'
          ],

          description:
            'Cancelar recorte de imagem'
        }
      ]
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

export default function KeyboardShortcutsDialog({
  open,
  onClose
}: {
  open: boolean
  onClose: () => void
}) {
  const dialogRef =
    useRef<
      HTMLElement |
      null
    >(
      null
    )

  const onCloseRef =
    useRef(
      onClose
    )

  useEffect(() => {
    onCloseRef.current =
      onClose
  }, [
    onClose
  ])

  useEffect(() => {
    if (!open) {
      return
    }

    const previousFocus =
      document.activeElement as
        HTMLElement |
        null

    const previousOverflow =
      document.body.style
        .overflow

    document.body.style
      .overflow =
      'hidden'

    const frame =
      window.requestAnimationFrame(
        () => {
          const dialog =
            dialogRef.current

          const first =
            dialog
              ?.querySelector<
                HTMLElement
              >(
                focusableSelector
              )

          ;(
            first ||
            dialog
          )?.focus()
        }
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
            element.getAttribute(
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
          active ===
            first ||
          !dialog.contains(
            active
          )
        )
      ) {
        event.preventDefault()

        last.focus()

        return
      }

      if (
        !event.shiftKey &&
        active ===
          last
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
      window.cancelAnimationFrame(
        frame
      )

      document.removeEventListener(
        'keydown',
        handleKeyDown,
        true
      )

      document.body.style
        .overflow =
        previousOverflow

      if (
        previousFocus &&
        document.contains(
          previousFocus
        )
      ) {
        previousFocus.focus({
          preventScroll:
            true
        })
      }
    }
  }, [
    open
  ])

  if (!open) {
    return null
  }

  return (
    <div
      className="mq-shortcuts-backdrop"
      role="presentation"
      onMouseDown={(
        event
      ) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onCloseRef.current()
        }
      }}
    >
      <section
        ref={
          dialogRef
        }
        className="mq-shortcuts-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mq-shortcuts-title"
        aria-describedby="mq-shortcuts-description"
        tabIndex={
          -1
        }
      >
        <header className="mq-shortcuts-dialog__header">
          <span>
            <strong id="mq-shortcuts-title">
              Atalhos de teclado
            </strong>

            <small id="mq-shortcuts-description">
              Trabalhe mais depressa no MA-Quadro sem ter de procurar cada ferramenta.
            </small>
          </span>

          <button
            type="button"
            onClick={() =>
              onCloseRef.current()
            }
            aria-label="Fechar atalhos"
            title="Fechar"
          >
            ×
          </button>
        </header>

        <div className="mq-shortcuts-dialog__body">
          {shortcutGroups.map(
            (
              group
            ) => (
              <section
                key={
                  group.title
                }
                className="mq-shortcut-group"
              >
                <h3>
                  {
                    group.title
                  }
                </h3>

                <div className="mq-shortcut-list">
                  {group.items.map(
                    (
                      item,
                      index
                    ) => (
                      <div
                        key={`${group.title}-${index}`}
                        className="mq-shortcut-row"
                      >
                        <span className="mq-shortcut-keys">
                          {item.keys.map(
                            (
                              key,
                              keyIndex
                            ) => (
                              <kbd
                                key={`${key}-${keyIndex}`}
                              >
                                {
                                  key
                                }
                              </kbd>
                            )
                          )}
                        </span>

                        <span>
                          {
                            item.description
                          }
                        </span>
                      </div>
                    )
                  )}
                </div>
              </section>
            )
          )}
        </div>

        <footer className="mq-shortcuts-dialog__footer">
          <span>
            Dica: prima{' '}
            <kbd>
              ?
            </kbd>{' '}
            em qualquer momento para voltar a abrir esta janela.
          </span>

          <button
            type="button"
            className="mq-button mq-button--primary"
            onClick={() =>
              onCloseRef.current()
            }
          >
            Fechar
          </button>
        </footer>
      </section>
    </div>
  )
}
