import {
  useEffect,
  useLayoutEffect,
  useState
} from 'react'

import {
  createPortal
} from 'react-dom'

import {
  createMAQuadroQRCodeFileFromDocument,
  createMAQuadroQRCodePreviewUrl,
  createMAQuadroQRCodeSvgFromDocument,
  DEFAULT_MA_QUADRO_QR_DOCUMENT,
  MA_QUADRO_QR_MAX_LENGTH,
  MA_QUADRO_QR_MAX_MARGIN,
  MA_QUADRO_QR_MIN_MARGIN,
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

export default function QRCodeBuilder() {
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
    qrDocument,
    setQrDocument
  ] = useState<
    MAQuadroQRCodeDocument
  >(
    DEFAULT_MA_QUADRO_QR_DOCUMENT
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
        '.mq-chart-builder-host'
      ) ||
      document.querySelector<
        HTMLElement
      >(
        '.mq-table-builder-host'
      ) ||
      elementGrid

    const mount =
      document.createElement(
        'div'
      )

    mount.className =
      'mq-qr-builder-host'

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

  useEffect(() => {
    let cancelled =
      false

    const timeout =
      window.setTimeout(
        () => {
          if (
            !qrDocument
              .value
              .trim()
          ) {
            setPreviewSvg(
              ''
            )

            setPreviewError(
              ''
            )

            return
          }

          void createMAQuadroQRCodeSvgFromDocument(
            qrDocument
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
    qrDocument
  ])

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
      qrDocument
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
    setQrDocument(
      (
        current
      ) =>
        updateMAQuadroQRCodeDocument(
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

  const insertQRCode =
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
        const file =
          await createMAQuadroQRCodeFileFromDocument(
            qrDocument
          )

        await editor
          .handleDroppedFiles([
            file
          ])

        setMessage(
          'QR Code inserido.'
        )
      } catch {
        setMessage(
          'Erro ao inserir o QR Code.'
        )
      } finally {
        setInserting(
          false
        )
      }
    }

  return createPortal(
    <section
      className="mq-qr-builder"
      aria-label="QR Code"
    >
      <div className="mq-section-title mq-qr-builder__title">
        <h3>
          QR Code
        </h3>

        <span>
          {
            qrDocument
              .errorCorrectionLevel
          }
        </span>
      </div>

      <label className="mq-qr-field">
        <span>
          Conteúdo
        </span>

        <textarea
          value={
            qrDocument.value
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
          placeholder="https://exemplo.pt"
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
            qrDocument
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
            qrDocument
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
            qrDocument
              .margin
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
            qrDocument
              .margin
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
              qrDocument
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
              qrDocument
                .lightColor
            }
            disabled={
              locked ||
              qrDocument
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
            qrDocument
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

      <small className="mq-qr-local-note">
        Gerado localmente no
        navegador.
      </small>

      <button
        type="button"
        className="mq-wide-action"
        disabled={
          locked ||
          !valid ||
          !previewSvg
        }
        onClick={() =>
          void insertQRCode()
        }
      >
        {inserting
          ? 'A inserir…'
          : '+ Inserir QR Code'}
      </button>

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
