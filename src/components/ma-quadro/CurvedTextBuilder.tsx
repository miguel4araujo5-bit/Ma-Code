import {
  useLayoutEffect,
  useMemo,
  useState
} from 'react'

import {
  createPortal
} from 'react-dom'

import {
  createMAQuadroCurvedTextDocument,
  createMAQuadroCurvedTextFileFromDocument,
  createMAQuadroCurvedTextPreviewUrl,
  createMAQuadroCurvedTextSvgFromDocument,
  MA_QUADRO_CURVED_TEXT_MAX_CURVATURE,
  MA_QUADRO_CURVED_TEXT_MAX_FONT_SIZE,
  MA_QUADRO_CURVED_TEXT_MAX_LETTER_SPACING,
  MA_QUADRO_CURVED_TEXT_MAX_LENGTH,
  MA_QUADRO_CURVED_TEXT_MIN_CURVATURE,
  MA_QUADRO_CURVED_TEXT_MIN_FONT_SIZE,
  MA_QUADRO_CURVED_TEXT_MIN_LETTER_SPACING,
  updateMAQuadroCurvedTextDocument,
  type MAQuadroCurvedTextDocument,
  type MAQuadroCurvedTextWeight
} from '../../lib/maQuadro/curvedTextSvg'

import {
  useMAQuadroEditorContext
} from './editorContext'

import './maQuadroCurvedText.css'

const WEIGHTS:
  Array<{
    value:
      MAQuadroCurvedTextWeight

    label:
      string
  }> = [
    {
      value:
        '400',

      label:
        'Regular'
    },
    {
      value:
        '500',

      label:
        'Médio'
    },
    {
      value:
        '600',

      label:
        'Semibold'
    },
    {
      value:
        '700',

      label:
        'Negrito'
    },
    {
      value:
        '800',

      label:
        'Extra negrito'
    },
    {
      value:
        '900',

      label:
        'Black'
    }
  ]

const CURVE_PRESETS = [
  {
    label:
      'Arco superior',

    value:
      60
  },
  {
    label:
      'Reto',

    value:
      0
  },
  {
    label:
      'Arco inferior',

    value:
      -60
  }
] as const

export default function CurvedTextBuilder() {
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
    curvedText,
    setCurvedText
  ] = useState<
    MAQuadroCurvedTextDocument
  >(
    () =>
      createMAQuadroCurvedTextDocument({
        fontFamily:
          editor
            .brand
            .fonts[
              0
            ]
            ?.family ||
          editor
            .availableFonts[
              0
            ]
            ?.family ||
          'Arial'
      })
  )

  const [
    inserting,
    setInserting
  ] = useState(
    false
  )

  const [
    message,
    setMessage
  ] = useState(
    ''
  )

  useLayoutEffect(() => {
    if (
      !editor.ready ||
      editor.activePanel !==
        'elements'
    ) {
      setHost(
        null
      )

      return
    }

    const elementGrid =
      document.querySelector<
        HTMLElement
      >(
        '.mq-left-panel .mq-element-grid'
      )

    if (
      !elementGrid
    ) {
      setHost(
        null
      )

      return
    }

    const anchor =
      document.querySelector<
        HTMLElement
      >(
        '.mq-qr-builder-host'
      ) ||
      document.querySelector<
        HTMLElement
      >(
        '.mq-chart-builder-host'
      ) ||
      document.querySelector<
        HTMLElement
      >(
        '.mq-table-builder-host'
      ) ||
      elementGrid

    const mount =
      window.document
        .createElement(
          'div'
        )

    mount.className =
      'mq-curved-text-builder-host'

    anchor
      .insertAdjacentElement(
        'afterend',
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

  const fontOptions =
    useMemo(
      () => {
        const seen =
          new Set<
            string
          >()

        return editor
          .availableFonts
          .filter(
            (
              font
            ) => {
              if (
                seen.has(
                  font.family
                )
              ) {
                return false
              }

              seen.add(
                font.family
              )

              return true
            }
          )
      },
      [
        editor.availableFonts
      ]
    )

  const svg =
    useMemo(
      () =>
        createMAQuadroCurvedTextSvgFromDocument(
          curvedText
        ),
      [
        curvedText
      ]
    )

  if (
    !host
  ) {
    return null
  }

  const locked =
    editor.busy ||
    editor.structureBusy ||
    editor.imageCropEditing ||
    inserting

  const valid =
    Boolean(
      curvedText
        .text
        .trim()
    )

  const update = <
    Key extends
      keyof MAQuadroCurvedTextDocument
  >(
    key:
      Key,

    value:
      MAQuadroCurvedTextDocument[
        Key
      ]
  ) => {
    setCurvedText(
      (
        current
      ) =>
        updateMAQuadroCurvedTextDocument(
          current,
          {
            [key]:
              value
          }
        )
    )

    setMessage(
      ''
    )
  }

  const insert =
    async () => {
      if (
        locked ||
        !valid
      ) {
        return
      }

      setInserting(
        true
      )

      setMessage(
        ''
      )

      try {
        await editor
          .handleDroppedFiles([
            createMAQuadroCurvedTextFileFromDocument(
              curvedText
            )
          ])

        setMessage(
          'Texto curvo inserido.'
        )
      } catch {
        setMessage(
          'Erro ao inserir o texto curvo.'
        )
      } finally {
        setInserting(
          false
        )
      }
    }

  return createPortal(
    <section
      className="mq-curved-text-builder"
      aria-label="Texto curvo"
    >
      <div className="mq-section-title mq-curved-text-builder__title">
        <h3>
          Texto curvo
        </h3>

        <span>
          {
            curvedText
              .curvature
          }
        </span>
      </div>

      <label className="mq-curved-text-field">
        <span>
          Texto
        </span>

        <textarea
          value={
            curvedText.text
          }
          disabled={
            locked
          }
          maxLength={
            MA_QUADRO_CURVED_TEXT_MAX_LENGTH
          }
          rows={
            3
          }
          placeholder="Escreva o texto"
          onChange={(
            event
          ) =>
            update(
              'text',
              event
                .target
                .value
            )
          }
        />

        <small>
          {
            curvedText
              .text
              .length
          }
          {' / '}
          {
            MA_QUADRO_CURVED_TEXT_MAX_LENGTH
          }
        </small>
      </label>

      <div className="mq-curved-text-presets">
        {CURVE_PRESETS.map(
          (
            preset
          ) => (
            <button
              key={
                preset.label
              }
              type="button"
              disabled={
                locked
              }
              className={
                curvedText
                  .curvature ===
                preset.value
                  ? 'is-active'
                  : ''
              }
              onClick={() =>
                update(
                  'curvature',
                  preset.value
                )
              }
            >
              {
                preset.label
              }
            </button>
          )
        )}
      </div>

      <label className="mq-curved-text-range-field">
        <span>
          Curvatura:{' '}
          {
            curvedText
              .curvature
          }
        </span>

        <input
          type="range"
          min={
            MA_QUADRO_CURVED_TEXT_MIN_CURVATURE
          }
          max={
            MA_QUADRO_CURVED_TEXT_MAX_CURVATURE
          }
          step={
            1
          }
          value={
            curvedText
              .curvature
          }
          disabled={
            locked
          }
          onChange={(
            event
          ) =>
            update(
              'curvature',
              Number(
                event
                  .target
                  .value
              )
            )
          }
        />
      </label>

      <label className="mq-curved-text-field">
        <span>
          Fonte
        </span>

        <select
          value={
            curvedText
              .fontFamily
          }
          disabled={
            locked
          }
          onChange={(
            event
          ) =>
            update(
              'fontFamily',
              event
                .target
                .value
            )
          }
        >
          {!fontOptions.some(
            (
              font
            ) =>
              font.family ===
              curvedText
                .fontFamily
          ) ? (
            <option
              value={
                curvedText
                  .fontFamily
              }
            >
              {
                curvedText
                  .fontFamily
              }
            </option>
          ) : null}

          {fontOptions.map(
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

      <div className="mq-curved-text-two-columns">
        <label className="mq-curved-text-field">
          <span>
            Peso
          </span>

          <select
            value={
              curvedText
                .fontWeight
            }
            disabled={
              locked
            }
            onChange={(
              event
            ) =>
              update(
                'fontWeight',
                event
                  .target
                  .value as
                  MAQuadroCurvedTextWeight
              )
            }
          >
            {WEIGHTS.map(
              (
                weight
              ) => (
                <option
                  key={
                    weight.value
                  }
                  value={
                    weight.value
                  }
                >
                  {
                    weight.label
                  }
                </option>
              )
            )}
          </select>
        </label>

        <label className="mq-curved-text-color-field">
          <span>
            Cor
          </span>

          <input
            type="color"
            value={
              curvedText
                .color
            }
            disabled={
              locked
            }
            onChange={(
              event
            ) =>
              update(
                'color',
                event
                  .target
                  .value
              )
            }
          />
        </label>
      </div>

      <label className="mq-curved-text-range-field">
        <span>
          Tamanho:{' '}
          {
            curvedText
              .fontSize
          }
        </span>

        <input
          type="range"
          min={
            MA_QUADRO_CURVED_TEXT_MIN_FONT_SIZE
          }
          max={
            MA_QUADRO_CURVED_TEXT_MAX_FONT_SIZE
          }
          step={
            1
          }
          value={
            curvedText
              .fontSize
          }
          disabled={
            locked
          }
          onChange={(
            event
          ) =>
            update(
              'fontSize',
              Number(
                event
                  .target
                  .value
              )
            )
          }
        />
      </label>

      <label className="mq-curved-text-range-field">
        <span>
          Espaçamento:{' '}
          {
            curvedText
              .letterSpacing
          }
        </span>

        <input
          type="range"
          min={
            MA_QUADRO_CURVED_TEXT_MIN_LETTER_SPACING
          }
          max={
            MA_QUADRO_CURVED_TEXT_MAX_LETTER_SPACING
          }
          step={
            0.5
          }
          value={
            curvedText
              .letterSpacing
          }
          disabled={
            locked
          }
          onChange={(
            event
          ) =>
            update(
              'letterSpacing',
              Number(
                event
                  .target
                  .value
              )
            )
          }
        />
      </label>

      <label className="mq-curved-text-toggle">
        <input
          type="checkbox"
          checked={
            curvedText
              .fontStyle ===
            'italic'
          }
          disabled={
            locked
          }
          onChange={(
            event
          ) =>
            update(
              'fontStyle',
              event
                .target
                .checked
                ? 'italic'
                : 'normal'
            )
          }
        />

        <span>
          Itálico
        </span>
      </label>

      <div className="mq-curved-text-preview">
        <img
          src={
            createMAQuadroCurvedTextPreviewUrl(
              svg
            )
          }
          alt="Pré-visualização do texto curvo"
        />
      </div>

      <button
        type="button"
        className="mq-wide-action"
        disabled={
          locked ||
          !valid
        }
        onClick={() =>
          void insert()
        }
      >
        {inserting
          ? 'A inserir…'
          : '+ Inserir texto curvo'}
      </button>

      {message ? (
        <p
          className="mq-curved-text-message"
          role="status"
        >
          {
            message
          }
        </p>
      ) : null}
    </section>,
    host
  )
}
