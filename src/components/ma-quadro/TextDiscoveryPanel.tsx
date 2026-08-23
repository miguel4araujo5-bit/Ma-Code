import {
  useLayoutEffect,
  useMemo,
  useState
} from 'react'

import {
  createPortal
} from 'react-dom'

import type {
  MAQuadroTextPreset
} from '../../types/maQuadro'

import {
  useMAQuadroEditorContext
} from './editorContext'

import './maQuadroTextDiscovery.css'

type TextStarter = {
  preset: MAQuadroTextPreset
  label: string
  sample: string
  description: string
}

const TEXT_STARTERS: TextStarter[] = [
  {
    preset: 'heading',
    label: 'Título',
    sample: 'O seu título',
    description: 'Destaque principal'
  },
  {
    preset: 'subheading',
    label: 'Subtítulo',
    sample: 'Um subtítulo claro',
    description: 'Segundo nível'
  },
  {
    preset: 'body',
    label: 'Corpo de texto',
    sample:
      'Adicione informação de forma clara e legível.',
    description: 'Parágrafos e informação'
  },
  {
    preset: 'caption',
    label: 'Legenda',
    sample: 'Legenda ou detalhe',
    description: 'Notas e pequenos destaques'
  }
]

function openCurvedTextTool(
  setActivePanel: (
    panel: 'elements'
  ) => void
) {
  setActivePanel(
    'elements'
  )

  let attempts = 0

  const reveal = () => {
    const button =
      document.querySelector<HTMLButtonElement>(
        '[aria-controls="mq-element-tool-curved-text"]'
      )

    if (
      button &&
      !button.disabled
    ) {
      if (
        button.getAttribute(
          'aria-pressed'
        ) !== 'true'
      ) {
        button.click()
      }

      window.requestAnimationFrame(
        () => {
          const target =
            document.querySelector<HTMLElement>(
              '.mq-curved-text-builder-host'
            )

          target?.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
            inline: 'nearest'
          })
        }
      )

      return
    }

    attempts += 1

    if (
      attempts <
      30
    ) {
      window.requestAnimationFrame(
        reveal
      )
    }
  }

  window.requestAnimationFrame(
    reveal
  )
}

export default function TextDiscoveryPanel() {
  const editor =
    useMAQuadroEditorContext()

  const [
    host,
    setHost
  ] = useState<HTMLElement | null>(
    null
  )

  useLayoutEffect(() => {
    if (
      !editor.ready ||
      editor.activePanel !==
        'text'
    ) {
      setHost(
        null
      )

      return
    }

    const panel =
      document.querySelector<HTMLElement>(
        '.mq-left-panel .mq-left-panel__scroll'
      )

    const originalPresets =
      panel?.querySelector<HTMLElement>(
        '.mq-text-presets'
      ) ?? null

    if (
      !panel ||
      !originalPresets
    ) {
      setHost(
        null
      )

      return
    }

    const mount =
      document.createElement(
        'div'
      )

    mount.className =
      'mq-text-discovery-host'

    originalPresets.insertAdjacentElement(
      'beforebegin',
      mount
    )

    setHost(
      mount
    )

    return () => {
      mount.remove()
    }
  }, [
    editor.activePanel,
    editor.ready
  ])

  const fonts =
    useMemo(
      () =>
        editor.availableFonts.slice(
          0,
          8
        ),
      [
        editor.availableFonts
      ]
    )

  if (!host) {
    return null
  }

  const locked =
    editor.busy ||
    editor.structureBusy ||
    editor.imageCropEditing

  const textSelected =
    editor.selection.count ===
      1 &&
    editor.selection.role ===
      'text'

  return createPortal(
    <div className="mq-text-discovery">
      <section className="mq-text-discovery__section">
        <div className="mq-text-discovery__section-heading">
          <span>
            <strong>
              Adicionar texto
            </strong>

            <small>
              Comece pela hierarquia certa.
            </small>
          </span>
        </div>

        <div className="mq-text-starter-list">
          {TEXT_STARTERS.map(
            (starter) => (
              <button
                key={
                  starter.preset
                }
                type="button"
                className={`mq-text-starter mq-text-starter--${starter.preset}`}
                disabled={locked}
                onClick={() =>
                  editor.addText(
                    starter.preset
                  )
                }
              >
                <span className="mq-text-starter__preview">
                  {
                    starter.sample
                  }
                </span>

                <span className="mq-text-starter__copy">
                  <strong>
                    {
                      starter.label
                    }
                  </strong>

                  <small>
                    {
                      starter.description
                    }
                  </small>
                </span>

                <span
                  className="mq-text-starter__add"
                  aria-hidden="true"
                >
                  +
                </span>
              </button>
            )
          )}
        </div>
      </section>

      <section className="mq-text-discovery__section">
        <div className="mq-text-discovery__section-heading">
          <span>
            <strong>
              Fontes
            </strong>

            <small>
              Fontes disponíveis neste projeto.
            </small>
          </span>

          <span className="mq-text-discovery__count">
            {editor.availableFonts.length}
          </span>
        </div>

        {fonts.length >
        0 ? (
          <div className="mq-text-font-list">
            {fonts.map(
              (font) => {
                const active =
                  textSelected &&
                  editor.selection
                    .fontFamily ===
                    font.family

                return (
                  <button
                    key={
                      font.family
                    }
                    type="button"
                    className={`mq-text-font-card${
                      active
                        ? ' is-active'
                        : ''
                    }`}
                    disabled={
                      locked ||
                      !textSelected
                    }
                    aria-pressed={
                      active
                    }
                    title={
                      textSelected
                        ? `Aplicar ${font.name}`
                        : 'Selecione primeiro um texto.'
                    }
                    onClick={() =>
                      editor.setTextProperty(
                        'fontFamily',
                        font.family
                      )
                    }
                  >
                    <span
                      className="mq-text-font-card__preview"
                      style={{
                        fontFamily:
                          `${font.family}, ${
                            font.fallback ||
                            'sans-serif'
                          }`
                      }}
                      aria-hidden="true"
                    >
                      Aa
                    </span>

                    <span className="mq-text-font-card__copy">
                      <strong>
                        {
                          font.name
                        }
                      </strong>

                      <small>
                        {
                          font.family
                        }
                      </small>
                    </span>
                  </button>
                )
              }
            )}
          </div>
        ) : (
          <p className="mq-text-discovery__note">
            Ainda não existem fontes disponíveis.
          </p>
        )}

        {!textSelected ? (
          <p className="mq-text-discovery__hint">
            Selecione um texto no quadro para aplicar uma fonte.
          </p>
        ) : null}
      </section>

      {textSelected ? (
        <section className="mq-text-discovery__section">
          <div className="mq-text-discovery__section-heading">
            <span>
              <strong>
                Texto selecionado
              </strong>

              <small>
                Alterações rápidas.
              </small>
            </span>
          </div>

          <div className="mq-text-case-actions">
            <button
              type="button"
              disabled={locked}
              onClick={() =>
                editor.transformTextCase(
                  'upper'
                )
              }
            >
              ABC
            </button>

            <button
              type="button"
              disabled={locked}
              onClick={() =>
                editor.transformTextCase(
                  'lower'
                )
              }
            >
              abc
            </button>

            <button
              type="button"
              disabled={locked}
              onClick={() =>
                editor.transformTextCase(
                  'title'
                )
              }
            >
              Título
            </button>
          </div>

          <div className="mq-text-discovery__tip">
            <span
              aria-hidden="true"
            >
              ✦
            </span>

            <span>
              <strong>
                Estilos e efeitos
              </strong>

              <small>
                Com um texto selecionado, os estilos tipográficos e efeitos rápidos aparecem automaticamente por cima do quadro.
              </small>
            </span>
          </div>
        </section>
      ) : null}

      <section className="mq-text-discovery__section">
        <div className="mq-text-discovery__section-heading">
          <span>
            <strong>
              Texto especial
            </strong>

            <small>
              Ferramentas adicionais.
            </small>
          </span>
        </div>

        <button
          type="button"
          className="mq-text-special-action"
          disabled={locked}
          onClick={() =>
            openCurvedTextTool(
              () =>
                editor.setActivePanel(
                  'elements'
                )
            )
          }
        >
          <span
            className="mq-text-special-action__icon"
            aria-hidden="true"
          >
            ⌒
          </span>

          <span>
            <strong>
              Texto curvo
            </strong>

            <small>
              Criar texto em arco ou curva.
            </small>
          </span>

          <span
            aria-hidden="true"
          >
            →
          </span>
        </button>
      </section>
    </div>,
    host
  )
}
