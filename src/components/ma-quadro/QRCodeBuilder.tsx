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
  createMAQuadroQRCodeFileFromDocument,
  createMAQuadroQRCodeObjectName,
  createMAQuadroQRCodePreviewUrl,
  createMAQuadroQRCodeSvgFromDocument,
  MA_QUADRO_QR_MAX_LENGTH,
  MA_QUADRO_QR_MAX_MARGIN,
  MA_QUADRO_QR_MIN_MARGIN,
  readMAQuadroQRCodeDocumentFromName,
  updateMAQuadroQRCodeDocument,
  type MAQuadroQRCodeDocument,
  type MAQuadroQRCodeErrorCorrection
} from '../../lib/maQuadro/qrCodeSvg'

import {
  useMAQuadroEditorContext
} from './editorContext'

import './maQuadroQRCode.css'

const ERROR_CORRECTION_OPTIONS:
  Array<{
    value:
      MAQuadroQRCodeErrorCorrection
    label:
      string
  }> = [
    {
      value: 'L',
      label: 'Baixa'
    },
    {
      value: 'M',
      label: 'Normal'
    },
    {
      value: 'Q',
      label: 'Alta'
    },
    {
      value: 'H',
      label: 'Máxima'
    }
  ]

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
    value: ''
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

export default function QRCodeEditor() {
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

        return readMAQuadroQRCodeDocumentFromName(
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
    MAQuadroQRCodeDocument |
    null
  >(
    null
  )

  const [
    previewSvg,
    setPreviewSvg
  ] = useState(
    ''
  )

  const [
    previewError,
    setPreviewError
  ] = useState(
    ''
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
      'mq-qr-editor-host'

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

  useEffect(() => {
    let cancelled =
      false

    if (
      !draft ||
      !draft.value.trim()
    ) {
      setPreviewSvg(
        ''
      )

      setPreviewError(
        ''
      )

      return
    }

    const timeout =
      window.setTimeout(
        () => {
          void createMAQuadroQRCodeSvgFromDocument(
            draft
          )
            .then(
              (
                svg
              ) => {
                if (
                  cancelled
                ) {
                  return
                }

                setPreviewSvg(
                  svg
                )

                setPreviewError(
                  ''
                )
              }
            )
            .catch(
              () => {
                if (
                  cancelled
                ) {
                  return
                }

                setPreviewSvg(
                  ''
                )

                setPreviewError(
                  'O conteúdo é demasiado grande ou não pode ser convertido.'
                )
              }
            )
        },
        120
      )

    return () => {
      cancelled =
        true

      window.clearTimeout(
        timeout
      )
    }
  }, [
    draft
  ])

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
        .value
        .trim()
    ) &&
    !previewError

  const update = <
    Key extends
      keyof MAQuadroQRCodeDocument
  >(
    key:
      Key,
    value:
      MAQuadroQRCodeDocument[
        Key
      ]
  ) => {
    setDraft(
      (
        current
      ) =>
        current
          ? updateMAQuadroQRCodeDocument(
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
          await createMAQuadroQRCodeFileFromDocument(
            draft
          )

        editor.setSelectionName(
          createMAQuadroQRCodeObjectName(
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
          'QR Code atualizado.'
        )
      } catch {
        setMessage(
          'Erro ao atualizar o QR Code.'
        )
      } finally {
        setSaving(
          false
        )
      }
    }

  return createPortal(
    <section
      className="mq-qr-editor"
      aria-label="Editar QR Code"
    >
      <div className="mq-qr-editor__heading">
        <span>
          <strong>
            QR Code
          </strong>

          <small>
            {
              draft
                .errorCorrectionLevel
            }
          </small>
        </span>

        {dirty ? (
          <span className="mq-qr-editor__dirty">
            Alterado
          </span>
        ) : null}
      </div>

      <label className="mq-qr-field">
        <span>
          Conteúdo
        </span>

        <textarea
          value={
            draft.value
          }
          disabled={
            locked
          }
          maxLength={
            MA_QUADRO_QR_MAX_LENGTH
          }
          rows={
            4
          }
          onChange={(
            event
          ) =>
            update(
              'value',
              event
                .target
                .value
            )
          }
        />

        <small>
          {
            draft
              .value
              .length
          }
          {' / '}
          {
            MA_QUADRO_QR_MAX_LENGTH
          }
        </small>
      </label>

      <label className="mq-qr-field">
        <span>
          Correção de erros
        </span>

        <select
          value={
            draft
              .errorCorrectionLevel
          }
          disabled={
            locked
          }
          onChange={(
            event
          ) =>
            update(
              'errorCorrectionLevel',
              event
                .target
                .value as
                MAQuadroQRCodeErrorCorrection
            )
          }
        >
          {ERROR_CORRECTION_OPTIONS.map(
            (
              option
            ) => (
              <option
                key={
                  option.value
                }
                value={
                  option.value
                }
              >
                {
                  option.value
                }
                {' — '}
                {
                  option.label
                }
              </option>
            )
          )}
        </select>
      </label>

      <label className="mq-qr-range-field">
        <span>
          Margem:{' '}
          {
            draft.margin
          }
        </span>

        <input
          type="range"
          min={
            MA_QUADRO_QR_MIN_MARGIN
          }
          max={
            MA_QUADRO_QR_MAX_MARGIN
          }
          step={
            1
          }
          value={
            draft.margin
          }
          disabled={
            locked
          }
          onChange={(
            event
          ) =>
            update(
              'margin',
              Number(
                event
                  .target
                  .value
              )
            )
          }
        />
      </label>

      <div className="mq-qr-color-grid">
        <label>
          <span>
            Código
          </span>

          <input
            type="color"
            value={
              draft
                .darkColor
            }
            disabled={
              locked
            }
            onChange={(
              event
            ) =>
              update(
                'darkColor',
                event
                  .target
                  .value
              )
            }
          />
        </label>

        <label>
          <span>
            Fundo
          </span>

          <input
            type="color"
            value={
              draft
                .lightColor
            }
            disabled={
              locked ||
              draft
                .transparentBackground
            }
            onChange={(
              event
            ) =>
              update(
                'lightColor',
                event
                  .target
                  .value
              )
            }
          />
        </label>
      </div>

      <label className="mq-qr-toggle">
        <input
          type="checkbox"
          checked={
            draft
              .transparentBackground
          }
          disabled={
            locked
          }
          onChange={(
            event
          ) =>
            update(
              'transparentBackground',
              event
                .target
                .checked
            )
          }
        />

        <span>
          Fundo transparente
        </span>
      </label>

      <div className="mq-qr-preview">
        {previewSvg ? (
          <img
            src={
              createMAQuadroQRCodePreviewUrl(
                previewSvg
              )
            }
            alt="Pré-visualização do QR Code"
          />
        ) : (
          <span>
            QR
          </span>
        )}
      </div>

      {previewError ? (
        <p
          className="mq-qr-error"
          role="alert"
        >
          {
            previewError
          }
        </p>
      ) : null}

      <div className="mq-qr-editor__actions">
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
            !valid ||
            !previewSvg
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
          className="mq-qr-message"
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
