import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ChangeEvent
} from 'react'

import {
  createPortal
} from 'react-dom'

import {
  createMAQuadroCurvedTextFileFromDocument,
  createMAQuadroCurvedTextObjectName,
  createMAQuadroCurvedTextPreviewUrl,
  createMAQuadroCurvedTextSvgFromDocument,
  MA_QUADRO_CURVED_TEXT_MAX_CURVATURE,
  MA_QUADRO_CURVED_TEXT_MAX_FONT_SIZE,
  MA_QUADRO_CURVED_TEXT_MAX_LETTER_SPACING,
  MA_QUADRO_CURVED_TEXT_MAX_LENGTH,
  MA_QUADRO_CURVED_TEXT_MIN_CURVATURE,
  MA_QUADRO_CURVED_TEXT_MIN_FONT_SIZE,
  MA_QUADRO_CURVED_TEXT_MIN_LETTER_SPACING,
  readMAQuadroCurvedTextDocumentFromName,
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

function createFileChangeEvent(
  file: File
) {
  const files = {
    0:
      file,

    length:
      1,

    item: (
      index:
        number
    ) =>
      index ===
        0
        ? file
        : null
  } as unknown as
    FileList

  const input = {
    files,
    value:
      ''
  } as unknown as
    HTMLInputElement

  return {
    currentTarget:
      input,

    target:
      input
  } as unknown as
    ChangeEvent<
      HTMLInputElement
    >
}

export default function CurvedTextEditor() {
  const editor =
    useMAQuadroEditorContext()

  const sourceDocument =
    useMemo(
      () => {
        if (
          editor
            .selection
            .count !==
              1 ||
          editor
            .selection
            .role !==
              'image'
        ) {
          return null
        }

        return readMAQuadroCurvedTextDocumentFromName(
          editor
            .selection
            .name
        )
      },
      [
        editor.selection.count,
        editor.selection.name,
        editor.selection.role
      ]
    )

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
    draft,
    setDraft
  ] = useState<
    MAQuadroCurvedTextDocument |
    null
  >(
    null
  )

  const [
    saving,
    setSaving
  ] = useState(
    false
  )

  const [
    message,
    setMessage
  ] = useState(
    ''
  )

  useEffect(() => {
    setDraft(
      sourceDocument
    )

    setMessage(
      ''
    )
  }, [
    editor.activePage?.id,
    editor.project?.id,
    editor.selection.name,
    sourceDocument
  ])

  useLayoutEffect(() => {
    if (
      !editor.ready ||
      !sourceDocument
    ) {
      setHost(
        null
      )

      return
    }

    const scroll =
      document.querySelector<
        HTMLElement
      >(
        '.mq-properties-panel .mq-properties-panel__scroll'
      )

    if (
      !scroll
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
      'mq-curved-text-editor-host'

    scroll.prepend(
      mount
    )

    setHost(
      mount
    )

    return () => {
      mount.remove()
    }
  }, [
    editor.ready,
    editor.selection.name,
    sourceDocument
  ])

  const fontOptions =
    useMemo(
      () => {
        const seen =
          new Set<
            string
          >()

        const options =
          editor
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

        if (
          draft?.fontFamily &&
          !seen.has(
            draft.fontFamily
          )
        ) {
          options.unshift({
            name:
              draft.fontFamily,

            family:
              draft.fontFamily
          })
        }

        return options
      },
      [
        draft?.fontFamily,
        editor.availableFonts
      ]
    )

  if (
    !host ||
    !sourceDocument ||
    !draft
  ) {
    return null
  }

  const locked =
    editor.busy ||
    editor.structureBusy ||
    editor.imageCropEditing ||
    saving

  const dirty =
    JSON.stringify(
      draft
    ) !==
    JSON.stringify(
      sourceDocument
    )

  const valid =
    Boolean(
      draft
        .text
        .trim()
    )

  const svg =
    createMAQuadroCurvedTextSvgFromDocument(
      draft
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
    setDraft(
      (
        current
      ) =>
        current
          ? updateMAQuadroCurvedTextDocument(
              current,
              {
                [key]:
                  value
              }
            )
          : current
    )

    setMessage(
      ''
    )
  }

  const reset =
    () => {
      setDraft(
        sourceDocument
      )

      setMessage(
        ''
      )
    }

  const apply =
    async () => {
      if (
        locked ||
        !dirty ||
        !valid
      ) {
        return
      }

      setSaving(
        true
      )

      setMessage(
        ''
      )

      try {
        const file =
          createMAQuadroCurvedTextFileFromDocument(
            draft
          )

        editor.setSelectionName(
          createMAQuadroCurvedTextObjectName(
            draft
          )
        )

        await editor
          .replaceSelectedImage(
            createFileChangeEvent(
              file
            )
          )

        setMessage(
          'Texto curvo atualizado.'
        )
      } catch {
        setMessage(
          'Erro ao atualizar o texto curvo.'
        )
      } finally {
        setSaving(
          false
        )
      }
    }

  return createPortal(
    <section
      className="mq-curved-text-editor"
      aria-label="Editar texto curvo"
    >
      <div className="mq-curved-text-editor__heading">
        <span>
          <strong>
            Texto curvo
          </strong>

          <small>
            Curvatura{' '}
            {
              draft
                .curvature
            }
          </small>
        </span>

        {dirty ? (
          <span className="mq-curved-text-editor__dirty">
            Alterado
          </span>
        ) : null}
      </div>

      <label className="mq-curved-text-field">
        <span>
          Texto
        </span>

        <textarea
          value={
            draft.text
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
            draft
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
                draft
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
            draft
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
            draft
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
            draft
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
              draft
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
              draft
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
            draft
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
            draft
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
            draft
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
            draft
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
            draft
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

      <div className="mq-curved-text-editor__actions">
        <button
          type="button"
          disabled={
            locked ||
            !dirty
          }
          onClick={
            reset
          }
        >
          Repor
        </button>

        <button
          type="button"
          className="is-primary"
          disabled={
            locked ||
            !dirty ||
            !valid
          }
          onClick={() =>
            void apply()
          }
        >
          {saving
            ? 'A aplicar…'
            : 'Aplicar alterações'}
        </button>
      </div>

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
