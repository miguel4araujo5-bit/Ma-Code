import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type MouseEvent
} from 'react'

import {
  createPortal
} from 'react-dom'

import type {
  MAQuadroTextPreset
} from '../../types/maQuadro'

import {
  getMAQuadroAnimationCanvas
} from '../../lib/maQuadro/objectAnimations'

import {
  applyMAQuadroSelectedTextScript,
  removeMAQuadroPageNumber,
  upsertMAQuadroPageNumber,
  type MAQuadroPageNumberFormat,
  type MAQuadroPageNumberPosition,
  type MAQuadroTextScriptAction
} from '../../lib/maQuadro/typographyPro'

import {
  useMAQuadroEditorContext
} from './editorContext'

import './maQuadroTextDiscovery.css'
import './maQuadroTypographyPro.css'

type TextStarter = {
  preset: MAQuadroTextPreset
  label: string
  sample: string
  description: string
}

type FontFilter =
  | 'all'
  | 'system'
  | 'local'

const TEXT_STARTERS:
  TextStarter[] = [
    {
      preset: 'heading',
      label: 'Título',
      sample: 'O seu título',
      description:
        'Destaque principal'
    },
    {
      preset: 'subheading',
      label: 'Subtítulo',
      sample:
        'Um subtítulo claro',
      description:
        'Segundo nível'
    },
    {
      preset: 'body',
      label:
        'Corpo de texto',
      sample:
        'Adicione informação de forma clara e legível.',
      description:
        'Parágrafos e informação'
    },
    {
      preset: 'caption',
      label: 'Legenda',
      sample:
        'Legenda ou detalhe',
      description:
        'Notas e pequenos destaques'
    }
  ]

const TRACKING_PRESETS = [
  {
    value: -40,
    label: 'Compacto'
  },
  {
    value: 0,
    label: 'Normal'
  },
  {
    value: 120,
    label: 'Aberto'
  },
  {
    value: 240,
    label: 'Display'
  }
]

function normalizeSearch(
  value: string
) {
  return value
    .trim()
    .normalize(
      'NFD'
    )
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .toLocaleLowerCase(
      'pt-PT'
    )
}

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
        ) !==
        'true'
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
            behavior:
              'smooth',
            block:
              'start',
            inline:
              'nearest'
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
  ] =
    useState<HTMLElement | null>(
      null
    )

  const [
    fontSearch,
    setFontSearch
  ] =
    useState('')

  const [
    fontFilter,
    setFontFilter
  ] =
    useState<FontFilter>(
      'all'
    )

  const [
    scriptMessage,
    setScriptMessage
  ] =
    useState('')

  const [
    pageNumberWorking,
    setPageNumberWorking
  ] =
    useState(false)

  const [
    pageNumberMessage,
    setPageNumberMessage
  ] =
    useState('')

  const [
    pageNumberPosition,
    setPageNumberPosition
  ] =
    useState<MAQuadroPageNumberPosition>(
      'bottom-center'
    )

  const [
    pageNumberFormat,
    setPageNumberFormat
  ] =
    useState<MAQuadroPageNumberFormat>(
      'number'
    )

  const [
    pageNumberStart,
    setPageNumberStart
  ] =
    useState(1)

  const [
    pageNumberFont,
    setPageNumberFont
  ] =
    useState('')

  const [
    pageNumberColor,
    setPageNumberColor
  ] =
    useState(
      '#64748B'
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
      ) ??
      null

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

  useEffect(() => {
    if (
      pageNumberFont ||
      editor.availableFonts
        .length ===
        0
    ) {
      return
    }

    setPageNumberFont(
      editor.availableFonts[0]
        .family
    )
  }, [
    editor.availableFonts,
    pageNumberFont
  ])

  const localFamilies =
    useMemo(
      () =>
        new Set(
          editor.localFonts.map(
            (
              font
            ) =>
              normalizeSearch(
                font.family
              )
          )
        ),
      [
        editor.localFonts
      ]
    )

  const fonts =
    useMemo(
      () => {
        const query =
          normalizeSearch(
            fontSearch
          )

        return editor
          .availableFonts
          .filter(
            (
              font
            ) => {
              const local =
                localFamilies.has(
                  normalizeSearch(
                    font.family
                  )
                )

              if (
                fontFilter ===
                  'local' &&
                !local
              ) {
                return false
              }

              if (
                fontFilter ===
                  'system' &&
                local
              ) {
                return false
              }

              if (!query) {
                return true
              }

              return (
                normalizeSearch(
                  font.name
                ).includes(
                  query
                ) ||
                normalizeSearch(
                  font.family
                ).includes(
                  query
                )
              )
            }
          )
      },
      [
        editor.availableFonts,
        fontFilter,
        fontSearch,
        localFamilies
      ]
    )

  if (!host) {
    return null
  }

  const locked =
    editor.busy ||
    editor.structureBusy ||
    editor.imageCropEditing ||
    pageNumberWorking

  const textSelected =
    editor.selection.count ===
      1 &&
    editor.selection.role ===
      'text'

  const preserveTextSelection = (
    event:
      MouseEvent<HTMLButtonElement>
  ) => {
    event.preventDefault()
  }

  const runScriptAction =
    async (
      action:
        MAQuadroTextScriptAction
    ) => {
      if (locked) {
        return
      }

      const result =
        applyMAQuadroSelectedTextScript(
          action
        )

      setScriptMessage(
        result.message
      )

      if (
        result.changed
      ) {
        await editor.saveProject(
          true
        )
      }
    }

  const applyPageNumbers =
    async () => {
      const project =
        editor.project

      const activePage =
        editor.activePage

      if (
        !project ||
        !activePage ||
        pageNumberWorking
      ) {
        return
      }

      const pageIds =
        project.pages.map(
          (
            page
          ) =>
            page.id
        )

      const originalPageId =
        activePage.id

      const safeStart =
        Math.max(
          0,
          Math.round(
            Number.isFinite(
              pageNumberStart
            )
              ? pageNumberStart
              : 1
          )
        )

      const finalNumber =
        safeStart +
        pageIds.length -
        1

      setPageNumberWorking(
        true
      )

      setPageNumberMessage(
        'A numerar as páginas…'
      )

      try {
        const saved =
          await editor.saveProject(
            true
          )

        if (!saved) {
          throw new Error(
            'Não foi possível guardar o projeto antes de numerar as páginas.'
          )
        }

        for (
          let index = 0;
          index <
          pageIds.length;
          index += 1
        ) {
          const pageId =
            pageIds[index]

          await editor.setActivePage(
            pageId
          )

          const canvas =
            getMAQuadroAnimationCanvas()

          if (!canvas) {
            throw new Error(
              'Não foi possível aceder ao quadro para numerar uma das páginas.'
            )
          }

          upsertMAQuadroPageNumber(
            canvas,
            safeStart +
              index,
            finalNumber,
            {
              position:
                pageNumberPosition,

              format:
                pageNumberFormat,

              fontFamily:
                pageNumberFont ||
                editor.availableFonts[0]
                  ?.family ||
                'Arial',

              color:
                pageNumberColor
            }
          )

          const pageSaved =
            await editor.saveProject(
              true
            )

          if (!pageSaved) {
            throw new Error(
              'Não foi possível guardar uma das páginas numeradas.'
            )
          }
        }

        await editor.setActivePage(
          originalPageId
        )

        setPageNumberMessage(
          `${pageIds.length} página${
            pageIds.length === 1
              ? ''
              : 's'
          } numerada${
            pageIds.length === 1
              ? ''
              : 's'
          } automaticamente.`
        )
      } catch (
        error
      ) {
        console.error(
          error
        )

        try {
          await editor.setActivePage(
            originalPageId
          )
        } catch {}

        setPageNumberMessage(
          error instanceof
            Error
            ? error.message
            : 'Não foi possível concluir a numeração das páginas.'
        )
      } finally {
        setPageNumberWorking(
          false
        )
      }
    }

  const removePageNumbers =
    async () => {
      const project =
        editor.project

      const activePage =
        editor.activePage

      if (
        !project ||
        !activePage ||
        pageNumberWorking
      ) {
        return
      }

      const pageIds =
        project.pages.map(
          (
            page
          ) =>
            page.id
        )

      const originalPageId =
        activePage.id

      let removed = 0

      setPageNumberWorking(
        true
      )

      setPageNumberMessage(
        'A remover a numeração…'
      )

      try {
        const saved =
          await editor.saveProject(
            true
          )

        if (!saved) {
          throw new Error(
            'Não foi possível guardar o projeto antes de remover a numeração.'
          )
        }

        for (
          const pageId
          of pageIds
        ) {
          await editor.setActivePage(
            pageId
          )

          const canvas =
            getMAQuadroAnimationCanvas()

          if (!canvas) {
            continue
          }

          const pageRemoved =
            removeMAQuadroPageNumber(
              canvas
            )

          if (
            pageRemoved >
            0
          ) {
            removed +=
              pageRemoved

            await editor.saveProject(
              true
            )
          }
        }

        await editor.setActivePage(
          originalPageId
        )

        setPageNumberMessage(
          removed > 0
            ? 'Numeração automática removida do projeto.'
            : 'Este projeto não tem numeração automática.'
        )
      } catch (
        error
      ) {
        console.error(
          error
        )

        try {
          await editor.setActivePage(
            originalPageId
          )
        } catch {}

        setPageNumberMessage(
          'Não foi possível remover toda a numeração automática.'
        )
      } finally {
        setPageNumberWorking(
          false
        )
      }
    }

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
            (
              starter
            ) => (
              <button
                key={
                  starter.preset
                }
                type="button"
                className={`mq-text-starter mq-text-starter--${starter.preset}`}
                disabled={
                  locked
                }
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

      <section className="mq-text-discovery__section mq-typography-fonts">
        <div className="mq-text-discovery__section-heading">
          <span>
            <strong>
              Fontes
            </strong>

            <small>
              Pesquise e filtre todas as fontes disponíveis.
            </small>
          </span>

          <span className="mq-text-discovery__count">
            {
              fonts.length
            }
          </span>
        </div>

        <label className="mq-typography-font-search">
          <span
            aria-hidden="true"
          >
            ⌕
          </span>

          <input
            type="search"
            value={
              fontSearch
            }
            disabled={
              locked
            }
            placeholder="Pesquisar fontes"
            aria-label="Pesquisar fontes"
            onChange={(
              event
            ) =>
              setFontSearch(
                event.target.value
              )
            }
          />

          {fontSearch ? (
            <button
              type="button"
              disabled={
                locked
              }
              aria-label="Limpar pesquisa"
              title="Limpar pesquisa"
              onClick={() =>
                setFontSearch(
                  ''
                )
              }
            >
              ×
            </button>
          ) : null}
        </label>

        <div
          className="mq-typography-font-filter"
          role="group"
          aria-label="Filtrar fontes"
        >
          {([
            [
              'all',
              'Todas'
            ],
            [
              'system',
              'Incluídas'
            ],
            [
              'local',
              'Minhas'
            ]
          ] as const).map(
            (
              [
                value,
                label
              ]
            ) => (
              <button
                key={
                  value
                }
                type="button"
                className={
                  fontFilter ===
                  value
                    ? 'is-active'
                    : ''
                }
                disabled={
                  locked
                }
                aria-pressed={
                  fontFilter ===
                  value
                }
                onClick={() =>
                  setFontFilter(
                    value
                  )
                }
              >
                {
                  label
                }
              </button>
            )
          )}
        </div>

        {fonts.length >
        0 ? (
          <div className="mq-text-font-list mq-typography-font-list">
            {fonts.map(
              (
                font
              ) => {
                const active =
                  textSelected &&
                  editor.selection
                    .fontFamily ===
                    font.family

                const local =
                  localFamilies.has(
                    normalizeSearch(
                      font.family
                    )
                  )

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

                      {local ? (
                        <small className="mq-typography-font-local">
                          Fonte local
                        </small>
                      ) : null}
                    </span>
                  </button>
                )
              }
            )}
          </div>
        ) : (
          <p className="mq-text-discovery__note">
            Nenhuma fonte corresponde ao filtro atual.
          </p>
        )}

        {!textSelected ? (
          <p className="mq-text-discovery__hint">
            Selecione um texto no quadro para aplicar uma fonte.
          </p>
        ) : null}
      </section>

      {textSelected ? (
        <section className="mq-text-discovery__section mq-typography-pro">
          <div className="mq-text-discovery__section-heading">
            <span>
              <strong>
                Tipografia Pro
              </strong>

              <small>
                Tracking e formatação avançada da seleção.
              </small>
            </span>

            <span className="mq-typography-pro__badge">
              PRO
            </span>
          </div>

          <div className="mq-typography-pro__group">
            <span className="mq-typography-pro__label">
              Tracking
            </span>

            <div className="mq-typography-tracking">
              {TRACKING_PRESETS.map(
                (
                  preset
                ) => (
                  <button
                    key={
                      preset.value
                    }
                    type="button"
                    className={
                      editor.selection
                        .charSpacing ===
                      preset.value
                        ? 'is-active'
                        : ''
                    }
                    disabled={
                      locked
                    }
                    aria-pressed={
                      editor.selection
                        .charSpacing ===
                      preset.value
                    }
                    onClick={() =>
                      editor.setTextProperty(
                        'charSpacing',
                        preset.value
                      )
                    }
                  >
                    <strong>
                      {
                        preset.label
                      }
                    </strong>

                    <small>
                      {
                        preset.value >
                        0
                          ? `+${preset.value}`
                          : preset.value
                      }
                    </small>
                  </button>
                )
              )}
            </div>

            <p className="mq-typography-pro__note">
              O ajuste fino continua disponível no controlo “Espaçamento das letras” do painel de propriedades.
            </p>
          </div>

          <div className="mq-typography-pro__group">
            <span className="mq-typography-pro__label">
              Sobrescrito e subscrito
            </span>

            <div className="mq-typography-script-actions">
              <button
                type="button"
                disabled={
                  locked
                }
                onMouseDown={
                  preserveTextSelection
                }
                onClick={() =>
                  void runScriptAction(
                    'superscript'
                  )
                }
                title="Aplicar sobrescrito aos caracteres selecionados"
              >
                <span>
                  x
                  <sup>
                    2
                  </sup>
                </span>

                <small>
                  Sobrescrito
                </small>
              </button>

              <button
                type="button"
                disabled={
                  locked
                }
                onMouseDown={
                  preserveTextSelection
                }
                onClick={() =>
                  void runScriptAction(
                    'subscript'
                  )
                }
                title="Aplicar subscrito aos caracteres selecionados"
              >
                <span>
                  H
                  <sub>
                    2
                  </sub>
                  O
                </span>

                <small>
                  Subscrito
                </small>
              </button>

              <button
                type="button"
                disabled={
                  locked
                }
                onMouseDown={
                  preserveTextSelection
                }
                onClick={() =>
                  void runScriptAction(
                    'clear'
                  )
                }
                title="Remover sobrescrito ou subscrito da seleção"
              >
                <span>
                  Aa
                </span>

                <small>
                  Repor
                </small>
              </button>
            </div>

            <p className="mq-typography-pro__note">
              Entre em edição do texto, selecione os caracteres desejados e use um destes controlos.
            </p>

            {scriptMessage ? (
              <p
                className="mq-typography-pro__status"
                role="status"
              >
                {
                  scriptMessage
                }
              </p>
            ) : null}
          </div>

          <div className="mq-text-case-actions">
            <button
              type="button"
              disabled={
                locked
              }
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
              disabled={
                locked
              }
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
              disabled={
                locked
              }
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
                Os restantes estilos tipográficos e efeitos rápidos continuam disponíveis por cima do quadro e no painel de propriedades.
              </small>
            </span>
          </div>
        </section>
      ) : null}

      <section className="mq-text-discovery__section mq-page-numbering">
        <div className="mq-text-discovery__section-heading">
          <span>
            <strong>
              Numeração de páginas
            </strong>

            <small>
              Adicione números consistentes a todas as páginas do projeto.
            </small>
          </span>
        </div>

        <div className="mq-page-numbering__grid">
          <label>
            <span>
              Formato
            </span>

            <select
              value={
                pageNumberFormat
              }
              disabled={
                locked
              }
              onChange={(
                event
              ) =>
                setPageNumberFormat(
                  event.target
                    .value as
                    MAQuadroPageNumberFormat
                )
              }
            >
              <option value="number">
                1
              </option>

              <option value="page">
                Página 1
              </option>

              <option value="total">
                1 / 10
              </option>
            </select>
          </label>

          <label>
            <span>
              Posição
            </span>

            <select
              value={
                pageNumberPosition
              }
              disabled={
                locked
              }
              onChange={(
                event
              ) =>
                setPageNumberPosition(
                  event.target
                    .value as
                    MAQuadroPageNumberPosition
                )
              }
            >
              <option value="bottom-left">
                Inferior esquerda
              </option>

              <option value="bottom-center">
                Inferior centro
              </option>

              <option value="bottom-right">
                Inferior direita
              </option>
            </select>
          </label>

          <label>
            <span>
              Começar em
            </span>

            <input
              type="number"
              value={
                pageNumberStart
              }
              min={0}
              max={9999}
              step={1}
              disabled={
                locked
              }
              onChange={(
                event
              ) =>
                setPageNumberStart(
                  Number(
                    event.target
                      .value
                  )
                )
              }
            />
          </label>

          <label>
            <span>
              Cor
            </span>

            <input
              type="color"
              value={
                pageNumberColor
              }
              disabled={
                locked
              }
              aria-label="Cor da numeração"
              onChange={(
                event
              ) =>
                setPageNumberColor(
                  event.target
                    .value
                )
              }
            />
          </label>
        </div>

        <label className="mq-page-numbering__font">
          <span>
            Fonte
          </span>

          <select
            value={
              pageNumberFont
            }
            disabled={
              locked
            }
            onChange={(
              event
            ) =>
              setPageNumberFont(
                event.target
                  .value
              )
            }
          >
            {editor.availableFonts.map(
              (
                font
              ) => (
                <option
                  key={
                    font.family
                  }
                  value={
                    font.family
                  }
                >
                  {
                    font.name
                  }
                </option>
              )
            )}
          </select>
        </label>

        <div className="mq-page-numbering__actions">
          <button
            type="button"
            className="is-primary"
            disabled={
              locked ||
              !editor.project ||
              !editor.activePage
            }
            aria-busy={
              pageNumberWorking
            }
            onClick={() =>
              void applyPageNumbers()
            }
          >
            {pageNumberWorking
              ? 'A processar…'
              : 'Aplicar a todas'}
          </button>

          <button
            type="button"
            disabled={
              locked ||
              !editor.project ||
              !editor.activePage
            }
            onClick={() =>
              void removePageNumbers()
            }
          >
            Remover
          </button>
        </div>

        <p className="mq-typography-pro__note">
          A numeração é um texto normal do MA-Quadro, por isso pode ser selecionada e ajustada manualmente depois de aplicada.
        </p>

        {pageNumberMessage ? (
          <p
            className="mq-typography-pro__status"
            role="status"
          >
            {
              pageNumberMessage
            }
          </p>
        ) : null}
      </section>

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
          disabled={
            locked
          }
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
