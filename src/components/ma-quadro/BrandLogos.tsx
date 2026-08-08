import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent
} from 'react'

import {
  deleteMAQuadroLogo,
  listMAQuadroLogos,
  saveMAQuadroLogo
} from '../../lib/maQuadro/db'

import {
  createMAQuadroStoredLogo,
  createMAQuadroStoredLogoPreviewUrl,
  MA_QUADRO_BRAND_LOGO_ACCEPT,
  MA_QUADRO_MAX_BRAND_LOGOS,
  maQuadroStoredLogoToFile
} from '../../lib/maQuadro/brandLogos'

import type {
  MAQuadroStoredLogo
} from '../../types/maQuadro'

import {
  useMAQuadroEditorContext
} from './editorContext'

import './maQuadroBrandLogos.css'

function BrandLogoCard({
  logo,
  disabled,
  onInsert,
  onDelete
}: {
  logo: MAQuadroStoredLogo
  disabled: boolean
  onInsert: (
    logo:
      MAQuadroStoredLogo
  ) => void
  onDelete: (
    logo:
      MAQuadroStoredLogo
  ) => void
}) {
  const [
    previewUrl,
    setPreviewUrl
  ] = useState(
    ''
  )

  useEffect(() => {
    const url =
      createMAQuadroStoredLogoPreviewUrl(
        logo
      )

    setPreviewUrl(
      url
    )

    return () => {
      URL.revokeObjectURL(
        url
      )
    }
  }, [
    logo
  ])

  return (
    <article className="mq-brand-logo-card">
      <button
        type="button"
        className="mq-brand-logo-card__insert"
        disabled={
          disabled
        }
        onClick={() =>
          onInsert(
            logo
          )
        }
        title={`Inserir ${logo.name}`}
      >
        <span className="mq-brand-logo-card__preview">
          {previewUrl ? (
            <img
              src={
                previewUrl
              }
              alt=""
            />
          ) : (
            <span aria-hidden="true">
              ◇
            </span>
          )}
        </span>

        <span className="mq-brand-logo-card__copy">
          <strong>
            {
              logo.name
            }
          </strong>

          <small>
            Inserir
          </small>
        </span>
      </button>

      <button
        type="button"
        className="mq-brand-logo-card__delete"
        disabled={
          disabled
        }
        onClick={() =>
          onDelete(
            logo
          )
        }
        aria-label={`Eliminar ${logo.name}`}
        title="Eliminar"
      >
        ×
      </button>
    </article>
  )
}

export default function BrandLogos() {
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
    logos,
    setLogos
  ] = useState<
    MAQuadroStoredLogo[]
  >([])

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

  const loadLogos =
    useCallback(
      async () => {
        try {
          setLogos(
            await listMAQuadroLogos()
          )
        } catch {
          setMessage(
            'Erro ao carregar os logótipos.'
          )
        }
      },
      []
    )

  useEffect(() => {
    void loadLogos()
  }, [
    loadLogos
  ])

  const locked =
    editor.busy ||
    editor.structureBusy ||
    editor.imageCropEditing ||
    localBusy

  const handleUpload =
    async (
      event:
        ChangeEvent<HTMLInputElement>
    ) => {
      const files =
        Array.from(
          event
            .currentTarget
            .files ||
          []
        )

      event.currentTarget.value =
        ''

      if (
        files.length ===
        0
      ) {
        return
      }

      const availableSlots =
        Math.max(
          0,
          MA_QUADRO_MAX_BRAND_LOGOS -
          logos.length
        )

      if (
        availableSlots ===
        0
      ) {
        setMessage(
          `Limite de ${MA_QUADRO_MAX_BRAND_LOGOS} logótipos atingido.`
        )

        return
      }

      const acceptedFiles =
        files.slice(
          0,
          availableSlots
        )

      setLocalBusy(
        true
      )

      setMessage(
        ''
      )

      let saved = 0
      let failed = 0

      try {
        for (
          const file of
          acceptedFiles
        ) {
          try {
            const logo =
              await createMAQuadroStoredLogo(
                file
              )

            await saveMAQuadroLogo(
              logo
            )

            saved += 1
          } catch {
            failed += 1
          }
        }

        await loadLogos()

        const ignored =
          files.length -
          acceptedFiles.length

        const parts:
          string[] = []

        if (
          saved > 0
        ) {
          parts.push(
            saved === 1
              ? 'Logótipo adicionado.'
              : `${saved} logótipos adicionados.`
          )
        }

        if (
          failed > 0
        ) {
          parts.push(
            failed === 1
              ? '1 ficheiro não foi aceite.'
              : `${failed} ficheiros não foram aceites.`
          )
        }

        if (
          ignored > 0
        ) {
          parts.push(
            `Limite de ${MA_QUADRO_MAX_BRAND_LOGOS} atingido.`
          )
        }

        setMessage(
          parts.join(
            ' '
          )
        )
      } finally {
        setLocalBusy(
          false
        )
      }
    }

  const insertLogo =
    async (
      logo:
        MAQuadroStoredLogo
    ) => {
      if (locked) {
        return
      }

      setLocalBusy(
        true
      )

      setMessage(
        ''
      )

      try {
        await editor
          .handleDroppedFiles([
            maQuadroStoredLogoToFile(
              logo
            )
          ])
      } catch {
        setMessage(
          'Erro ao inserir o logótipo.'
        )
      } finally {
        setLocalBusy(
          false
        )
      }
    }

  const deleteLogo =
    async (
      logo:
        MAQuadroStoredLogo
    ) => {
      if (locked) {
        return
      }

      const confirmed =
        window.confirm(
          `Eliminar “${logo.name}”?`
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
        await deleteMAQuadroLogo(
          logo.id
        )

        setLogos(
          (
            current
          ) =>
            current.filter(
              (
                item
              ) =>
                item.id !==
                logo.id
            )
        )

        setMessage(
          'Logótipo eliminado.'
        )
      } catch {
        setMessage(
          'Erro ao eliminar o logótipo.'
        )
      } finally {
        setLocalBusy(
          false
        )
      }
    }

  return (
    <section
      className="mq-brand-logos"
      aria-label="Logótipos"
    >
      <div className="mq-brand-logos__heading">
        <div>
          <strong>
            Logótipos
          </strong>

          <small>
            PNG, JPEG,
            WebP ou SVG
          </small>
        </div>

        <button
          type="button"
          disabled={
            locked ||
            logos.length >=
              MA_QUADRO_MAX_BRAND_LOGOS
          }
          onClick={() =>
            inputRef
              .current
              ?.click()
          }
        >
          + Adicionar
        </button>
      </div>

      <input
        ref={
          inputRef
        }
        type="file"
        multiple
        hidden
        disabled={
          locked
        }
        accept={
          MA_QUADRO_BRAND_LOGO_ACCEPT
        }
        onChange={(
          event
        ) =>
          void handleUpload(
            event
          )
        }
      />

      {logos.length >
      0 ? (
        <div className="mq-brand-logos__grid">
          {logos.map(
            (
              logo
            ) => (
              <BrandLogoCard
                key={
                  logo.id
                }
                logo={
                  logo
                }
                disabled={
                  locked
                }
                onInsert={(
                  item
                ) =>
                  void insertLogo(
                    item
                  )
                }
                onDelete={(
                  item
                ) =>
                  void deleteLogo(
                    item
                  )
                }
              />
            )
          )}
        </div>
      ) : (
        <div className="mq-brand-logos__empty">
          <strong>
            Sem logótipos
          </strong>

          <span>
            Adicione o
            primeiro logótipo.
          </span>
        </div>
      )}

      <div className="mq-brand-logos__footer">
        <span>
          {
            logos.length
          }
          {' / '}
          {
            MA_QUADRO_MAX_BRAND_LOGOS
          }
        </span>

        <small>
          Máx. 10 MB
        </small>
      </div>

      {message ? (
        <p
          className="mq-brand-logos__message"
          role="status"
        >
          {message}
        </p>
      ) : null}
    </section>
  )
}
