import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useState
} from 'react'

import {
  createPortal
} from 'react-dom'

import {
  deleteMAQuadroBrandKit,
  listMAQuadroBrandKits,
  saveMAQuadroBrandKit
} from '../../lib/maQuadro/db'

import {
  createMAQuadroCustomBrandKit,
  createMAQuadroDefaultBrandKit,
  MA_QUADRO_DEFAULT_BRAND_KIT_ID,
  normalizeMAQuadroBrandKitName,
  touchMAQuadroBrandKit
} from '../../lib/maQuadro/brandKits'

import {
  MA_QUADRO_QUICK_STYLE_PRESETS,
  type MAQuadroQuickStylePreset
} from '../../lib/maQuadro/quickStylePresets'

import type {
  MAQuadroStoredBrandKit
} from '../../types/maQuadro'

import {
  useMAQuadroEditorContext
} from './editorContext'

import BrandLogos from './BrandLogos'

import './maQuadroBrandQuickStyles.css'

const ACTIVE_BRAND_KIT_STORAGE_KEY =
  'ma-quadro-active-brand-kit'

function targetLabel(
  count: number,
  role: string | null
) {
  if (
    count ===
    0
  ) {
    return 'fundo da página'
  }

  if (
    role ===
    'text'
  ) {
    return 'texto selecionado'
  }

  if (
    role ===
      'line' ||
    role ===
      'arrow'
  ) {
    return 'linha selecionada'
  }

  if (
    role ===
    'image'
  ) {
    return 'imagem selecionada'
  }

  return 'seleção atual'
}

export default function BrandQuickStyles() {
  const editor =
    useMAQuadroEditorContext()

  const [
    host,
    setHost
  ] = useState<
    HTMLElement |
    null
  >(
    null
  )

  const [
    customKits,
    setCustomKits
  ] = useState<
    MAQuadroStoredBrandKit[]
  >([])

  const [
    kitsLoaded,
    setKitsLoaded
  ] = useState(
    false
  )

  const [
    activeKitId,
    setActiveKitId
  ] = useState(
    () => {
      try {
        return (
          localStorage.getItem(
            ACTIVE_BRAND_KIT_STORAGE_KEY
          ) ||
          MA_QUADRO_DEFAULT_BRAND_KIT_ID
        )
      } catch {
        return MA_QUADRO_DEFAULT_BRAND_KIT_ID
      }
    }
  )

  const [
    nameDraft,
    setNameDraft
  ] = useState(
    ''
  )

  const [
    localBusy,
    setLocalBusy
  ] = useState(
    false
  )

  const [
    message,
    setMessage
  ] = useState(
    ''
  )

  const defaultKit =
    useMemo(
      () =>
        createMAQuadroDefaultBrandKit(
          editor.brand
        ),
      [
        editor.brand
      ]
    )

  const kits =
    useMemo(
      () => [
        defaultKit,
        ...customKits
      ],
      [
        customKits,
        defaultKit
      ]
    )

  const activeKit =
    kits.find(
      (
        kit
      ) =>
        kit.id ===
        activeKitId
    ) ||
    defaultKit

  const customActive =
    activeKit.id !==
    MA_QUADRO_DEFAULT_BRAND_KIT_ID

  useEffect(() => {
    if (
      !editor.ready
    ) {
      return
    }

    let cancelled =
      false

    void listMAQuadroBrandKits()
      .then(
        (
          items
        ) => {
          if (
            !cancelled
          ) {
            setCustomKits(
              items
            )

            setKitsLoaded(
              true
            )
          }
        }
      )
      .catch(
        () => {
          if (
            !cancelled
          ) {
            setMessage(
              'Erro ao carregar as marcas.'
            )

            setKitsLoaded(
              true
            )
          }
        }
      )

    return () => {
      cancelled =
        true
    }
  }, [
    editor.ready
  ])

  useEffect(() => {
    if (
      kitsLoaded &&
      activeKitId !==
        MA_QUADRO_DEFAULT_BRAND_KIT_ID &&
      !customKits.some(
        (
          kit
        ) =>
          kit.id ===
          activeKitId
      )
    ) {
      setActiveKitId(
        MA_QUADRO_DEFAULT_BRAND_KIT_ID
      )
    }
  }, [
    activeKitId,
    customKits,
    kitsLoaded
  ])

  useEffect(() => {
    setNameDraft(
      activeKit.name
    )
  }, [
    activeKit.id,
    activeKit.name
  ])

  useEffect(() => {
    if (
      !kitsLoaded
    ) {
      return
    }

    try {
      localStorage.setItem(
        ACTIVE_BRAND_KIT_STORAGE_KEY,
        activeKit.id
      )
    } catch {
      return
    }
  }, [
    activeKit.id,
    kitsLoaded
  ])

  useLayoutEffect(() => {
    if (
      !editor.ready ||
      editor.activePanel !==
        'brand'
    ) {
      setHost(
        null
      )

      return
    }

    const colorGrid =
      document.querySelector<
        HTMLElement
      >(
        '.mq-left-panel .mq-color-grid'
      )

    if (
      !colorGrid
    ) {
      setHost(
        null
      )

      return
    }

    const paletteHeading =
      colorGrid
        .previousElementSibling as
        | HTMLElement
        | null

    const panelHeading =
      colorGrid
        .parentElement
        ?.querySelector<
          HTMLElement
        >(
          '.mq-panel-heading'
        ) ||
      null

    const mount =
      document.createElement(
        'div'
      )

    mount.className =
      'mq-brand-quick-styles-host'

    colorGrid.classList.add(
      'mq-brand-base-palette--hidden'
    )

    paletteHeading
      ?.classList
      .add(
        'mq-brand-base-palette-heading--hidden'
      )

    panelHeading
      ?.classList
      .add(
        'mq-brand-panel-heading--hidden'
      )

    colorGrid.insertAdjacentElement(
      'afterend',
      mount
    )

    setHost(
      mount
    )

    return () => {
      mount.remove()

      colorGrid
        .classList
        .remove(
          'mq-brand-base-palette--hidden'
        )

      paletteHeading
        ?.classList
        .remove(
          'mq-brand-base-palette-heading--hidden'
        )

      panelHeading
        ?.classList
        .remove(
          'mq-brand-panel-heading--hidden'
        )
    }
  }, [
    editor.activePanel,
    editor.ready
  ])

  const locked =
    editor.busy ||
    editor.structureBusy ||
    editor.imageCropEditing ||
    localBusy

  const imageSelected =
    editor.selection.count >
      0 &&
    editor.selection.role ===
      'image'

  const applyColor = (
    color: string
  ) => {
    if (
      locked ||
      imageSelected
    ) {
      return
    }

    if (
      editor.selection.role ===
        'line' ||
      editor.selection.role ===
        'arrow'
    ) {
      editor.setSelectionStroke(
        color
      )

      return
    }

    editor.applyBrandColor(
      color
    )
  }

  const applyFont = (
    family: string
  ) => {
    if (
      locked ||
      editor.selection.role !==
        'text'
    ) {
      return
    }

    editor.setTextProperty(
      'fontFamily',
      family
    )
  }

  const applyPreset = (
    preset:
      MAQuadroQuickStylePreset
  ) => {
    if (
      locked ||
      imageSelected
    ) {
      return
    }

    if (
      editor.selection.count ===
      0
    ) {
      editor.setBackground({
        type:
          'solid',

        color:
          preset.background
      })

      return
    }

    if (
      editor.selection.role ===
        'line' ||
      editor.selection.role ===
        'arrow'
    ) {
      editor.setSelectionStroke(
        preset.primary
      )

      return
    }

    editor.applyBrandColor(
      preset.primary
    )

    if (
      editor.selection.role ===
      'text'
    ) {
      editor.setTextProperty(
        'fontFamily',
        preset.fontFamily
      )

      editor.setTextProperty(
        'fontWeight',
        preset.fontWeight
      )

      if (
        preset.shadow
      ) {
        editor.setShadow(
          preset.shadow
        )
      }
    }
  }

  const refreshKits =
    async (
      preferredId?: string
    ) => {
      const next =
        await listMAQuadroBrandKits()

      setCustomKits(
        next
      )

      if (
        preferredId
      ) {
        setActiveKitId(
          preferredId
        )
      }
    }

  const createKit =
    async () => {
      if (
        locked
      ) {
        return
      }

      setLocalBusy(
        true
      )

      setMessage(
        ''
      )

      try {
        const kit =
          createMAQuadroCustomBrandKit(
            activeKit,
            `Marca ${
              customKits.length +
              1
            }`
          )

        await saveMAQuadroBrandKit(
          kit
        )

        await refreshKits(
          kit.id
        )

        setMessage(
          'Marca criada.'
        )
      } catch {
        setMessage(
          'Erro ao criar a marca.'
        )
      } finally {
        setLocalBusy(
          false
        )
      }
    }

  const updateCustomKit =
    async (
      next:
        MAQuadroStoredBrandKit
    ) => {
      if (
        locked ||
        next.id ===
          MA_QUADRO_DEFAULT_BRAND_KIT_ID
      ) {
        return
      }

      const updated =
        touchMAQuadroBrandKit(
          next
        )

      setCustomKits(
        (
          current
        ) =>
          current.map(
            (
              kit
            ) =>
              kit.id ===
              updated.id
                ? updated
                : kit
          )
      )

      try {
        await saveMAQuadroBrandKit(
          updated
        )
      } catch {
        setMessage(
          'Erro ao guardar a marca.'
        )

        await refreshKits(
          updated.id
        )
      }
    }

  const commitName =
    async () => {
      if (
        !customActive
      ) {
        setNameDraft(
          activeKit.name
        )

        return
      }

      const name =
        normalizeMAQuadroBrandKitName(
          nameDraft
        )

      setNameDraft(
        name
      )

      if (
        name ===
        activeKit.name
      ) {
        return
      }

      await updateCustomKit({
        ...activeKit,
        name
      })
    }

  const changeColor =
    async (
      index: number,
      value: string
    ) => {
      if (
        !customActive
      ) {
        return
      }

      await updateCustomKit({
        ...activeKit,

        colors:
          activeKit.colors.map(
            (
              color,
              colorIndex
            ) =>
              colorIndex ===
              index
                ? {
                    ...color,
                    value
                  }
                : color
          )
      })
    }

  const changeFont =
    async (
      index: number,
      family: string
    ) => {
      if (
        !customActive
      ) {
        return
      }

      const chosen =
        editor.availableFonts.find(
          (
            font
          ) =>
            font.family ===
            family
        )

      if (
        !chosen
      ) {
        return
      }

      await updateCustomKit({
        ...activeKit,

        fonts:
          activeKit.fonts.map(
            (
              font,
              fontIndex
            ) =>
              fontIndex ===
              index
                ? {
                    ...font,

                    name:
                      chosen.name,

                    family:
                      chosen.family,

                    fallback:
                      chosen.fallback
                  }
                : font
          )
      })
    }

  const deleteKit =
    async () => {
      if (
        locked ||
        !customActive
      ) {
        return
      }

      const confirmed =
        window.confirm(
          `Eliminar “${activeKit.name}” e os logótipos desta marca?`
        )

      if (
        !confirmed
      ) {
        return
      }

      setLocalBusy(
        true
      )

      setMessage(
        ''
      )

      try {
        await deleteMAQuadroBrandKit(
          activeKit.id
        )

        await refreshKits()

        setActiveKitId(
          MA_QUADRO_DEFAULT_BRAND_KIT_ID
        )

        setMessage(
          'Marca eliminada.'
        )
      } catch {
        setMessage(
          'Erro ao eliminar a marca.'
        )
      } finally {
        setLocalBusy(
          false
        )
      }
    }

  if (
    !host
  ) {
    return null
  }

  return createPortal(
    <section
      className="mq-brand-quick-styles"
      aria-label="Marca"
    >
      <div className="mq-brand-kits-title">
        <div>
          <h2>
            Marca
          </h2>

          <p>
            Cores, fontes e
            logótipos organizados
            por marca.
          </p>
        </div>

        <span>
          {
            kits.length
          }
        </span>
      </div>

      <div className="mq-brand-kit-toolbar">
        <label>
          <span>
            Marca ativa
          </span>

          <select
            value={
              activeKit.id
            }
            disabled={
              locked
            }
            onChange={(
              event
            ) => {
              setActiveKitId(
                event.target.value
              )

              setMessage(
                ''
              )
            }}
          >
            {kits.map(
              (
                kit
              ) => (
                <option
                  key={
                    kit.id
                  }
                  value={
                    kit.id
                  }
                >
                  {
                    kit.name
                  }
                </option>
              )
            )}
          </select>
        </label>

        <button
          type="button"
          disabled={
            locked
          }
          onClick={() =>
            void createKit()
          }
        >
          + Nova
        </button>
      </div>

      <div className="mq-brand-kit-card">
        <div className="mq-brand-kit-card__name">
          <label>
            <span>
              Nome
            </span>

            <input
              type="text"
              value={
                nameDraft
              }
              maxLength={
                80
              }
              readOnly={
                !customActive
              }
              disabled={
                locked
              }
              onChange={(
                event
              ) =>
                setNameDraft(
                  event.target.value
                )
              }
              onBlur={() =>
                void commitName()
              }
              onKeyDown={(
                event
              ) => {
                if (
                  event.key ===
                  'Enter'
                ) {
                  event.preventDefault()

                  event
                    .currentTarget
                    .blur()
                }
              }}
            />
          </label>

          {customActive ? (
            <button
              type="button"
              className="is-danger"
              disabled={
                locked
              }
              onClick={() =>
                void deleteKit()
              }
            >
              Eliminar
            </button>
          ) : (
            <span className="mq-brand-kit-card__system">
              Principal
            </span>
          )}
        </div>

        <div className="mq-brand-kit-subsection">
          <strong>
            Paleta
          </strong>

          <div className="mq-brand-kit-colors">
            {activeKit.colors.map(
              (
                color,
                index
              ) => (
                <div
                  key={`${activeKit.id}-${index}`}
                  className="mq-brand-kit-color"
                >
                  <button
                    type="button"
                    disabled={
                      locked ||
                      imageSelected
                    }
                    onClick={() =>
                      applyColor(
                        color.value
                      )
                    }
                    title={`Aplicar ${color.name}`}
                    aria-label={`Aplicar ${color.name}`}
                    style={{
                      background:
                        color.value
                    }}
                  />

                  {customActive ? (
                    <input
                      type="color"
                      value={
                        color.value
                      }
                      disabled={
                        locked
                      }
                      aria-label={`Editar ${color.name}`}
                      onChange={(
                        event
                      ) =>
                        void changeColor(
                          index,
                          event.target.value
                        )
                      }
                    />
                  ) : null}
                </div>
              )
            )}
          </div>
        </div>

        <div className="mq-brand-kit-subsection">
          <strong>
            Fontes da marca
          </strong>

          <div className="mq-brand-kit-fonts">
            {activeKit.fonts.map(
              (
                font,
                index
              ) => (
                <div
                  key={`${activeKit.id}-font-${index}`}
                  className="mq-brand-kit-font"
                >
                  <button
                    type="button"
                    disabled={
                      locked ||
                      editor
                        .selection
                        .role !==
                        'text'
                    }
                    onClick={() =>
                      applyFont(
                        font.family
                      )
                    }
                    style={{
                      fontFamily:
                        `${font.family}, ${
                          font.fallback ||
                          'sans-serif'
                        }`
                    }}
                  >
                    Aa
                  </button>

                  {customActive ? (
                    <select
                      value={
                        font.family
                      }
                      disabled={
                        locked
                      }
                      aria-label={`Fonte ${index + 1}`}
                      onChange={(
                        event
                      ) =>
                        void changeFont(
                          index,
                          event.target.value
                        )
                      }
                    >
                      {editor
                        .availableFonts
                        .map(
                          (
                            availableFont
                          ) => (
                            <option
                              key={
                                availableFont.family
                              }
                              value={
                                availableFont.family
                              }
                            >
                              {
                                availableFont.name
                              }
                            </option>
                          )
                        )}
                    </select>
                  ) : (
                    <span>
                      {
                        font.name
                      }
                    </span>
                  )}
                </div>
              )
            )}
          </div>
        </div>
      </div>

      <BrandLogos
        brandKitId={
          activeKit.id
        }
      />

      <div className="mq-brand-quick-styles__heading">
        <div>
          <strong>
            Estilos rápidos
          </strong>

          <small>
            Aplicar a{' '}
            {targetLabel(
              editor.selection.count,
              editor.selection.role
            )}
            .
          </small>
        </div>

        <span>
          {
            MA_QUADRO_QUICK_STYLE_PRESETS
              .length
          }
        </span>
      </div>

      {imageSelected ? (
        <div className="mq-brand-quick-styles__notice">
          As paletas não
          alteram imagens.
        </div>
      ) : null}

      <div className="mq-brand-quick-styles__grid">
        {MA_QUADRO_QUICK_STYLE_PRESETS.map(
          (
            preset
          ) => (
            <article
              key={
                preset.id
              }
              className="mq-brand-quick-style-card"
            >
              <button
                type="button"
                className="mq-brand-quick-style-card__main"
                disabled={
                  locked ||
                  imageSelected
                }
                onClick={() =>
                  applyPreset(
                    preset
                  )
                }
                title={`Aplicar estilo ${preset.name}`}
              >
                <span className="mq-brand-quick-style-card__swatches">
                  {preset.colors.map(
                    (
                      color,
                      index
                    ) => (
                      <span
                        key={`${preset.id}-${color}-${index}`}
                        style={{
                          background:
                            color
                        }}
                      />
                    )
                  )}
                </span>

                <span className="mq-brand-quick-style-card__copy">
                  <strong>
                    {
                      preset.name
                    }
                  </strong>

                  <small>
                    {
                      preset.description
                    }
                  </small>
                </span>
              </button>

              <div className="mq-brand-quick-style-card__colors">
                {preset.colors.map(
                  (
                    color,
                    index
                  ) => (
                    <button
                      key={`${preset.id}-color-${color}-${index}`}
                      type="button"
                      disabled={
                        locked ||
                        imageSelected
                      }
                      style={{
                        background:
                          color
                      }}
                      onClick={() =>
                        applyColor(
                          color
                        )
                      }
                      aria-label={`Aplicar ${color}`}
                      title={`Aplicar ${color}`}
                    />
                  )
                )}
              </div>
            </article>
          )
        )}
      </div>

      {message ? (
        <p
          className="mq-brand-kit-message"
          role="status"
        >
          {message}
        </p>
      ) : null}
    </section>,
    host
  )
}
