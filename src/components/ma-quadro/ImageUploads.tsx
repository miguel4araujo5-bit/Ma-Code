import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent
} from 'react'

import {
  createPortal
} from 'react-dom'

import {
  deleteMAQuadroImage,
  listMAQuadroImages,
  saveMAQuadroImage
} from '../../lib/maQuadro/db'

import {
  createMAQuadroId
} from '../../lib/maQuadro/project'

import type {
  MAQuadroStoredImage
} from '../../types/maQuadro'

import {
  useMAQuadroEditorContext
} from './editorContext'

import './maQuadroImageUploads.css'

const IMAGE_MAX_BYTES =
  25 * 1024 * 1024

const ACCEPTED_IMAGE_TYPES =
  new Set([
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif'
  ])

function formatFileSize(
  bytes: number
) {
  if (
    bytes <
    1024 * 1024
  ) {
    return `${Math.max(
      1,
      Math.round(
        bytes / 1024
      )
    )} KB`
  }

  return `${(
    bytes /
    (1024 * 1024)
  ).toFixed(
    bytes <
    10 * 1024 * 1024
      ? 1
      : 0
  )} MB`
}

function normalizeSearch(
  value: string
) {
  return value
    .trim()
    .toLocaleLowerCase(
      'pt-PT'
    )
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
}

function getErrorMessage(
  error: unknown
) {
  if (
    error instanceof DOMException &&
    error.name ===
      'QuotaExceededError'
  ) {
    return 'Não existe espaço local suficiente para guardar mais imagens.'
  }

  if (
    error instanceof Error &&
    error.message
  ) {
    return error.message
  }

  return 'Não foi possível guardar a imagem.'
}

async function prepareStoredImage(
  file: File
): Promise<MAQuadroStoredImage> {
  if (
    !ACCEPTED_IMAGE_TYPES.has(
      file.type
    )
  ) {
    throw new Error(
      'Use imagens PNG, JPG, WebP ou GIF.'
    )
  }

  if (
    file.size >
    IMAGE_MAX_BYTES
  ) {
    throw new Error(
      `A imagem “${file.name}” ultrapassa o limite de 25 MB.`
    )
  }

  return {
    id: createMAQuadroId(
      'image'
    ),
    name: file.name,
    fileName: file.name,
    mimeType: file.type,
    data:
      await file.arrayBuffer(),
    size: file.size,
    createdAt:
      new Date().toISOString()
  }
}

function storedImageToFile(
  image: MAQuadroStoredImage
) {
  return new File(
    [image.data],
    image.fileName,
    {
      type: image.mimeType,
      lastModified:
        new Date(
          image.createdAt
        ).getTime()
    }
  )
}

function ImagePreview({
  image
}: {
  image: MAQuadroStoredImage
}) {
  const [
    url,
    setUrl
  ] = useState('')

  useEffect(() => {
    const nextUrl =
      URL.createObjectURL(
        new Blob(
          [image.data],
          {
            type:
              image.mimeType
          }
        )
      )

    setUrl(nextUrl)

    return () => {
      URL.revokeObjectURL(
        nextUrl
      )
    }
  }, [
    image.data,
    image.mimeType
  ])

  if (!url) {
    return (
      <span className="mq-image-library-card__placeholder">
        Imagem
      </span>
    )
  }

  return (
    <img
      src={url}
      alt=""
      draggable={false}
    />
  )
}

export default function ImageUploads() {
  const editor =
    useMAQuadroEditorContext()

  const inputRef =
    useRef<HTMLInputElement | null>(
      null
    )

  const [
    host,
    setHost
  ] = useState<HTMLElement | null>(
    null
  )

  const [
    images,
    setImages
  ] = useState<MAQuadroStoredImage[]>(
    []
  )

  const [
    search,
    setSearch
  ] = useState('')

  const [
    processing,
    setProcessing
  ] = useState(false)

  const [
    addingId,
    setAddingId
  ] = useState<string | null>(
    null
  )

  const [
    deletingId,
    setDeletingId
  ] = useState<string | null>(
    null
  )

  const [
    message,
    setMessage
  ] = useState('')

  const refreshImages =
    useCallback(
      async () => {
        const nextImages =
          await listMAQuadroImages()

        setImages(
          nextImages
        )
      },
      []
    )

  useLayoutEffect(() => {
    if (
      !editor.ready ||
      editor.activePanel !==
        'uploads'
    ) {
      setHost(null)

      return
    }

    const panelScroll =
      document.querySelector<HTMLElement>(
        '.mq-left-panel .mq-left-panel__scroll'
      )

    const uploadZone =
      panelScroll?.querySelector<HTMLElement>(
        '.mq-upload-zone'
      ) ?? null

    if (
      !panelScroll ||
      !uploadZone
    ) {
      setHost(null)

      return
    }

    const mount =
      document.createElement(
        'div'
      )

    mount.className =
      'mq-image-uploads-host'

    uploadZone.insertAdjacentElement(
      'beforebegin',
      mount
    )

    setHost(mount)

    return () => {
      mount.remove()
    }
  }, [
    editor.activePanel,
    editor.ready
  ])

  useEffect(() => {
    if (
      !editor.ready ||
      editor.activePanel !==
        'uploads'
    ) {
      return
    }

    void refreshImages()
      .catch(() => {
        setMessage(
          'Não foi possível abrir a biblioteca local de imagens.'
        )
      })
  }, [
    editor.activePanel,
    editor.ready,
    refreshImages
  ])

  const query =
    normalizeSearch(search)

  const visibleImages =
    useMemo(
      () =>
        images.filter(
          (image) =>
            !query ||
            normalizeSearch(
              image.name
            ).includes(
              query
            )
        ),
      [
        images,
        query
      ]
    )

  if (!host) {
    return null
  }

  const locked =
    editor.busy ||
    editor.structureBusy ||
    editor.imageCropEditing ||
    processing ||
    addingId !== null ||
    deletingId !== null

  const addStoredImage =
    async (
      image:
        MAQuadroStoredImage
    ) => {
      if (locked) {
        return
      }

      setAddingId(
        image.id
      )

      setMessage('')

      try {
        await editor.handleDroppedFiles([
          storedImageToFile(
            image
          )
        ])

        setMessage(
          'Imagem adicionada ao design.'
        )
      } catch (error) {
        setMessage(
          getErrorMessage(
            error
          )
        )
      } finally {
        setAddingId(
          null
        )
      }
    }

  const handleImageChange =
    async (
      event:
        ChangeEvent<HTMLInputElement>
    ) => {
      const files =
        Array.from(
          event.currentTarget.files ||
          []
        )

      event.currentTarget.value =
        ''

      if (
        files.length === 0 ||
        locked
      ) {
        return
      }

      setProcessing(true)
      setMessage('')

      const savedFiles: File[] =
        []

      const savedImages:
        MAQuadroStoredImage[] =
        []

      let failed = 0
      let lastError = ''

      try {
        for (
          const file of files
        ) {
          try {
            const stored =
              await prepareStoredImage(
                file
              )

            await saveMAQuadroImage(
              stored
            )

            savedFiles.push(
              file
            )

            savedImages.push(
              stored
            )
          } catch (error) {
            failed += 1

            lastError =
              getErrorMessage(
                error
              )
          }
        }

        if (
          savedImages.length ===
          0
        ) {
          setMessage(
            lastError ||
            'Não foi possível guardar as imagens selecionadas.'
          )

          return
        }

        setImages(
          (current) => [
            ...savedImages,
            ...current.filter(
              (image) =>
                !savedImages.some(
                  (saved) =>
                    saved.id ===
                    image.id
                )
            )
          ]
        )

        await editor.handleDroppedFiles(
          savedFiles
        )

        if (failed > 0) {
          setMessage(
            `${savedImages.length} imagem${
              savedImages.length === 1
                ? ''
                : 'ns'
            } guardada${
              savedImages.length === 1
                ? ''
                : 's'
            }; ${failed} não foi${
              failed === 1
                ? ''
                : 'ram'
            } guardada${
              failed === 1
                ? ''
                : 's'
            }. ${lastError}`
          )
        } else {
          setMessage(
            savedImages.length === 1
              ? 'Imagem guardada localmente e adicionada ao design.'
              : `${savedImages.length} imagens guardadas localmente e adicionadas ao design.`
          )
        }
      } finally {
        setProcessing(false)
      }
    }

  const deleteStoredImage =
    async (
      image:
        MAQuadroStoredImage
    ) => {
      if (locked) {
        return
      }

      const confirmed =
        window.confirm(
          `Eliminar “${image.name}” da biblioteca local? As imagens já usadas nos designs não serão removidas.`
        )

      if (!confirmed) {
        return
      }

      setDeletingId(
        image.id
      )

      setMessage('')

      try {
        await deleteMAQuadroImage(
          image.id
        )

        setImages(
          (current) =>
            current.filter(
              (item) =>
                item.id !==
                image.id
            )
        )

        setMessage(
          'Imagem removida da biblioteca local.'
        )
      } catch (error) {
        setMessage(
          getErrorMessage(
            error
          )
        )
      } finally {
        setDeletingId(
          null
        )
      }
    }

  return createPortal(
    <section
      className="mq-image-uploads"
      aria-label="Imagens"
    >
      <div className="mq-section-title mq-image-uploads__title">
        <span>
          <h3>
            Imagens
          </h3>

          <small>
            Biblioteca local reutilizável
          </small>
        </span>

        <span className="mq-image-uploads__count">
          {images.length}
        </span>
      </div>

      <button
        type="button"
        className="mq-image-upload-button"
        disabled={locked}
        aria-busy={processing}
        onClick={() =>
          inputRef.current?.click()
        }
      >
        <span
          className="mq-image-upload-button__icon"
          aria-hidden="true"
        >
          ↑
        </span>

        <span className="mq-image-upload-button__copy">
          <strong>
            {processing
              ? 'A guardar imagens…'
              : 'Carregar imagens'}
          </strong>

          <small>
            PNG, JPG, WebP ou GIF · até 25 MB cada
          </small>
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp,image/gif"
        disabled={locked}
        onChange={(event) =>
          void handleImageChange(
            event
          )
        }
        hidden
      />

      {images.length > 0 ? (
        <label className="mq-image-library-search">
          <span aria-hidden="true">
            ⌕
          </span>

          <input
            type="search"
            value={search}
            disabled={locked}
            placeholder="Pesquisar imagens"
            aria-label="Pesquisar imagens"
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
          />

          {search ? (
            <button
              type="button"
              disabled={locked}
              aria-label="Limpar pesquisa"
              title="Limpar pesquisa"
              onClick={() =>
                setSearch('')
              }
            >
              ×
            </button>
          ) : null}
        </label>
      ) : null}

      {visibleImages.length > 0 ? (
        <div className="mq-image-library">
          {visibleImages.map(
            (image) => (
              <article
                key={image.id}
                className="mq-image-library-card"
              >
                <button
                  type="button"
                  className="mq-image-library-card__preview"
                  disabled={locked}
                  aria-label={`Adicionar ${image.name} ao design`}
                  title={`Adicionar ${image.name}`}
                  onClick={() =>
                    void addStoredImage(
                      image
                    )
                  }
                >
                  <ImagePreview
                    image={image}
                  />

                  <span className="mq-image-library-card__add-overlay">
                    + Adicionar
                  </span>
                </button>

                <div className="mq-image-library-card__meta">
                  <span>
                    <strong
                      title={image.name}
                    >
                      {image.name}
                    </strong>

                    <small>
                      {formatFileSize(
                        image.size
                      )}
                    </small>
                  </span>

                  <button
                    type="button"
                    className="mq-image-library-card__delete"
                    disabled={locked}
                    aria-label={`Eliminar ${image.name} da biblioteca`}
                    title="Eliminar da biblioteca"
                    onClick={() =>
                      void deleteStoredImage(
                        image
                      )
                    }
                  >
                    {deletingId ===
                    image.id
                      ? '…'
                      : '×'}
                  </button>
                </div>
              </article>
            )
          )}
        </div>
      ) : images.length > 0 ? (
        <div className="mq-image-library-empty">
          <strong>
            Nenhuma imagem corresponde à pesquisa.
          </strong>

          <button
            type="button"
            disabled={locked}
            onClick={() =>
              setSearch('')
            }
          >
            Limpar pesquisa
          </button>
        </div>
      ) : (
        <div className="mq-image-library-empty">
          <strong>
            A biblioteca ainda está vazia.
          </strong>

          <p>
            As imagens carregadas aqui ficam guardadas apenas neste dispositivo e podem ser reutilizadas noutros designs.
          </p>
        </div>
      )}

      <div className="mq-image-local-note">
        <strong>
          Local e privado
        </strong>

        <span>
          Os ficheiros não são enviados para a MA-Code. Eliminar uma imagem desta biblioteca não remove cópias já incorporadas nos seus designs.
        </span>
      </div>

      {message ? (
        <p
          className="mq-image-uploads__message"
          role="status"
        >
          {message}
        </p>
      ) : null}
    </section>,
    host
  )
}
