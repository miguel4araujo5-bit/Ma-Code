import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent
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
  createMAQuadroImageCollection,
  deleteMAQuadroImageCollection,
  listMAQuadroImageCollections,
  renameMAQuadroImageCollection,
  type MAQuadroImageCollection
} from '../../lib/maQuadro/imageCollections'

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
import './maQuadroImageCollections.css'

const IMAGE_MAX_BYTES =
  25 * 1024 * 1024

const ACCEPTED_IMAGE_TYPES =
  new Set([
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif'
  ])

const ALL_COLLECTIONS =
  'all'

const UNASSIGNED_COLLECTION =
  'unassigned'

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
  file: File,
  collectionId?: string
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
    collectionId,
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

  const newCollectionInputRef =
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
    collections,
    setCollections
  ] = useState<MAQuadroImageCollection[]>(
    []
  )

  const [
    activeCollection,
    setActiveCollection
  ] = useState<string>(
    ALL_COLLECTIONS
  )

  const [
    creatingCollection,
    setCreatingCollection
  ] = useState(false)

  const [
    newCollectionName,
    setNewCollectionName
  ] = useState('')

  const [
    selectedIds,
    setSelectedIds
  ] = useState<string[]>(
    []
  )

  const [
    moveTarget,
    setMoveTarget
  ] = useState<string>(
    UNASSIGNED_COLLECTION
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
    organizing,
    setOrganizing
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

  const refreshCollections =
    useCallback(
      () => {
        setCollections(
          listMAQuadroImageCollections()
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

    refreshCollections()

    void refreshImages()
      .catch(() => {
        setMessage(
          'Não foi possível abrir a biblioteca local de imagens.'
        )
      })
  }, [
    editor.activePanel,
    editor.ready,
    refreshCollections,
    refreshImages
  ])

  useEffect(() => {
    if (!creatingCollection) {
      return
    }

    window.requestAnimationFrame(
      () => {
        newCollectionInputRef.current
          ?.focus()
      }
    )
  }, [
    creatingCollection
  ])

  const knownCollectionIds =
    useMemo(
      () =>
        new Set(
          collections.map(
            (collection) =>
              collection.id
          )
        ),
      [collections]
    )

  const collectionById =
    useMemo(
      () =>
        new Map(
          collections.map(
            (collection) => [
              collection.id,
              collection
            ] as const)
        ),
      [collections]
    )

  const activeCollectionObject =
    activeCollection !==
      ALL_COLLECTIONS &&
    activeCollection !==
      UNASSIGNED_COLLECTION
      ? collectionById.get(
          activeCollection
        ) || null
      : null

  const imageIsUnassigned =
    useCallback(
      (
        image:
          MAQuadroStoredImage
      ) =>
        !image.collectionId ||
        !knownCollectionIds.has(
          image.collectionId
        ),
      [knownCollectionIds]
    )

  const collectionCount =
    useCallback(
      (
        collectionId:
          string
      ) => {
        if (
          collectionId ===
          ALL_COLLECTIONS
        ) {
          return images.length
        }

        if (
          collectionId ===
          UNASSIGNED_COLLECTION
        ) {
          return images.filter(
            imageIsUnassigned
          ).length
        }

        return images.filter(
          (image) =>
            image.collectionId ===
            collectionId
        ).length
      },
      [
        imageIsUnassigned,
        images
      ]
    )

  const query =
    normalizeSearch(search)

  const visibleImages =
    useMemo(
      () =>
        images.filter(
          (image) => {
            const collectionMatches =
              activeCollection ===
              ALL_COLLECTIONS
                ? true
                : activeCollection ===
                    UNASSIGNED_COLLECTION
                  ? imageIsUnassigned(
                      image
                    )
                  : image.collectionId ===
                    activeCollection

            if (!collectionMatches) {
              return false
            }

            if (!query) {
              return true
            }

            return (
              normalizeSearch(
                image.name
              ).includes(
                query
              ) ||
              normalizeSearch(
                image.fileName
              ).includes(
                query
              )
            )
          }
        ),
      [
        activeCollection,
        imageIsUnassigned,
        images,
        query
      ]
    )

  const selectedSet =
    useMemo(
      () =>
        new Set(
          selectedIds
        ),
      [selectedIds]
    )

  const visibleSelectedCount =
    useMemo(
      () =>
        visibleImages.filter(
          (image) =>
            selectedSet.has(
              image.id
            )
        ).length,
      [
        selectedSet,
        visibleImages
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
    organizing ||
    addingId !== null ||
    deletingId !== null

  const uploadCollectionId =
    activeCollectionObject
      ?.id

  const uploadCollectionName =
    activeCollectionObject
      ?.name ||
    'Sem coleção'

  const changeActiveCollection =
    (
      nextCollection:
        string
    ) => {
      setActiveCollection(
        nextCollection
      )

      setSelectedIds([])
      setMoveTarget(
        UNASSIGNED_COLLECTION
      )
      setMessage('')
    }

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
                file,
                uploadCollectionId
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
              ? `Imagem guardada localmente em “${uploadCollectionName}” e adicionada ao design.`
              : `${savedImages.length} imagens guardadas localmente em “${uploadCollectionName}” e adicionadas ao design.`
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

        setSelectedIds(
          (current) =>
            current.filter(
              (imageId) =>
                imageId !==
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

  const toggleSelected =
    (
      imageId:
        string
    ) => {
      if (locked) {
        return
      }

      setSelectedIds(
        (current) =>
          current.includes(
            imageId
          )
            ? current.filter(
                (id) =>
                  id !==
                  imageId
              )
            : [
                ...current,
                imageId
              ]
      )
    }

  const selectVisible =
    () => {
      if (locked) {
        return
      }

      setSelectedIds(
        visibleImages.map(
          (image) =>
            image.id
        )
      )
    }

  const createCollection =
    (
      event:
        FormEvent<HTMLFormElement>
    ) => {
      event.preventDefault()

      if (locked) {
        return
      }

      setMessage('')

      try {
        const created =
          createMAQuadroImageCollection(
            newCollectionName
          )

        refreshCollections()
        setNewCollectionName('')
        setCreatingCollection(false)
        setActiveCollection(
          created.id
        )
        setMoveTarget(
          created.id
        )
        setSelectedIds([])

        setMessage(
          `Coleção “${created.name}” criada localmente.`
        )
      } catch (error) {
        setMessage(
          getErrorMessage(
            error
          )
        )
      }
    }

  const renameActiveCollection =
    () => {
      if (
        locked ||
        !activeCollectionObject
      ) {
        return
      }

      const requested =
        window.prompt(
          'Novo nome da coleção:',
          activeCollectionObject.name
        )

      if (
        requested ===
        null
      ) {
        return
      }

      setMessage('')

      try {
        const renamed =
          renameMAQuadroImageCollection(
            activeCollectionObject.id,
            requested
          )

        refreshCollections()

        setMessage(
          `Coleção renomeada para “${renamed.name}”.`
        )
      } catch (error) {
        setMessage(
          getErrorMessage(
            error
          )
        )
      }
    }

  const deleteActiveCollection =
    async () => {
      if (
        locked ||
        !activeCollectionObject
      ) {
        return
      }

      const imagesInCollection =
        images.filter(
          (image) =>
            image.collectionId ===
            activeCollectionObject.id
        )

      const confirmed =
        window.confirm(
          `Eliminar a coleção “${activeCollectionObject.name}”? ${
            imagesInCollection.length > 0
              ? `As ${imagesInCollection.length} imagem${imagesInCollection.length === 1 ? '' : 'ns'} passam para “Sem coleção” e não serão apagadas.`
              : 'Nenhuma imagem será apagada.'
          }`
        )

      if (!confirmed) {
        return
      }

      setOrganizing(true)
      setMessage('')

      try {
        const updatedImages =
          images.map(
            (image) =>
              image.collectionId ===
              activeCollectionObject.id
                ? {
                    ...image,
                    collectionId:
                      undefined
                  }
                : image
          )

        for (
          const image of updatedImages
        ) {
          if (
            image.collectionId ===
              undefined &&
            images.find(
              (current) =>
                current.id === image.id
            )?.collectionId ===
              activeCollectionObject.id
          ) {
            await saveMAQuadroImage(
              image
            )
          }
        }

        deleteMAQuadroImageCollection(
          activeCollectionObject.id
        )

        setImages(
          updatedImages
        )

        refreshCollections()
        setActiveCollection(
          UNASSIGNED_COLLECTION
        )
        setMoveTarget(
          UNASSIGNED_COLLECTION
        )
        setSelectedIds([])

        setMessage(
          `Coleção “${activeCollectionObject.name}” eliminada. As imagens ficaram em “Sem coleção”.`
        )
      } catch (error) {
        setMessage(
          getErrorMessage(
            error
          )
        )
      } finally {
        setOrganizing(false)
      }
    }

  const moveSelectedImages =
    async () => {
      if (
        locked ||
        selectedIds.length ===
        0
      ) {
        return
      }

      const nextCollectionId =
        moveTarget ===
        UNASSIGNED_COLLECTION
          ? undefined
          : moveTarget

      if (
        nextCollectionId &&
        !collectionById.has(
          nextCollectionId
        )
      ) {
        setMessage(
          'A coleção de destino já não existe neste dispositivo.'
        )

        return
      }

      setOrganizing(true)
      setMessage('')

      try {
        const selected =
          new Set(
            selectedIds
          )

        const changed =
          images
            .filter(
              (image) =>
                selected.has(
                  image.id
                ) &&
                image.collectionId !==
                  nextCollectionId
            )
            .map(
              (image) => ({
                ...image,
                collectionId:
                  nextCollectionId
              })
            )

        for (
          const image of changed
        ) {
          await saveMAQuadroImage(
            image
          )
        }

        if (
          changed.length ===
          0
        ) {
          setMessage(
            'As imagens selecionadas já estão nessa coleção.'
          )

          return
        }

        const changedById =
          new Map(
            changed.map(
              (image) => [
                image.id,
                image
              ] as const)
          )

        setImages(
          (current) =>
            current.map(
              (image) =>
                changedById.get(
                  image.id
                ) ||
                image
            )
        )

        const destinationName =
          nextCollectionId
            ? collectionById.get(
                nextCollectionId
              )?.name ||
              'coleção'
            : 'Sem coleção'

        setSelectedIds([])

        setMessage(
          `${changed.length} imagem${changed.length === 1 ? '' : 'ns'} movida${changed.length === 1 ? '' : 's'} para “${destinationName}”.`
        )
      } catch (error) {
        setMessage(
          getErrorMessage(
            error
          )
        )
      } finally {
        setOrganizing(false)
      }
    }

  const collectionNameForImage =
    (
      image:
        MAQuadroStoredImage
    ) => {
      if (
        !image.collectionId
      ) {
        return 'Sem coleção'
      }

      return collectionById.get(
        image.collectionId
      )?.name ||
      'Sem coleção'
    }

  const emptyTitle =
    search
      ? 'Nenhuma imagem corresponde à pesquisa.'
      : activeCollectionObject
        ? 'Esta coleção ainda está vazia.'
        : activeCollection ===
            UNASSIGNED_COLLECTION
          ? 'Não existem imagens sem coleção.'
          : 'A biblioteca ainda está vazia.'

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

      <p className="mq-image-upload-target">
        Novos uploads ficam em{' '}
        <strong>
          {uploadCollectionName}
        </strong>
        .
      </p>

      <div
        className="mq-image-collections"
        aria-label="Coleções locais"
      >
        <div className="mq-image-collections__header">
          <span>
            <strong>
              Coleções
            </strong>

            <small>
              Organização guardada apenas neste browser
            </small>
          </span>

          <button
            type="button"
            className="mq-image-collections__new"
            disabled={locked}
            onClick={() => {
              setCreatingCollection(
                true
              )
              setNewCollectionName(
                ''
              )
            }}
          >
            + Nova
          </button>
        </div>

        {creatingCollection ? (
          <form
            className="mq-image-collection-create"
            onSubmit={
              createCollection
            }
          >
            <input
              ref={newCollectionInputRef}
              type="text"
              value={newCollectionName}
              maxLength={60}
              disabled={locked}
              placeholder="Nome da coleção"
              aria-label="Nome da nova coleção"
              onChange={(event) =>
                setNewCollectionName(
                  event.target.value
                )
              }
            />

            <button
              type="submit"
              className="is-primary"
              disabled={
                locked ||
                !newCollectionName.trim()
              }
            >
              Criar
            </button>

            <button
              type="button"
              disabled={locked}
              onClick={() => {
                setCreatingCollection(
                  false
                )
                setNewCollectionName(
                  ''
                )
              }}
            >
              Cancelar
            </button>
          </form>
        ) : null}

        <div className="mq-image-collections__filter">
          <select
            value={activeCollection}
            disabled={locked}
            aria-label="Filtrar por coleção"
            onChange={(event) =>
              changeActiveCollection(
                event.target.value
              )
            }
          >
            <option
              value={ALL_COLLECTIONS}
            >
              Todas as imagens ({images.length})
            </option>

            <option
              value={UNASSIGNED_COLLECTION}
            >
              Sem coleção ({collectionCount(UNASSIGNED_COLLECTION)})
            </option>

            {collections.map(
              (collection) => (
                <option
                  key={collection.id}
                  value={collection.id}
                >
                  {collection.name} ({collectionCount(collection.id)})
                </option>
              )
            )}
          </select>

          <div className="mq-image-collections__actions">
            <button
              type="button"
              disabled={
                locked ||
                !activeCollectionObject
              }
              aria-label="Renomear coleção"
              title="Renomear coleção"
              onClick={
                renameActiveCollection
              }
            >
              ✎
            </button>

            <button
              type="button"
              className="is-delete"
              disabled={
                locked ||
                !activeCollectionObject
              }
              aria-label="Eliminar coleção"
              title="Eliminar coleção sem eliminar imagens"
              onClick={() =>
                void deleteActiveCollection()
              }
            >
              ×
            </button>
          </div>
        </div>
      </div>

      {images.length > 0 ? (
        <label className="mq-image-library-search">
          <span aria-hidden="true">
            ⌕
          </span>

          <input
            type="search"
            value={search}
            disabled={locked}
            placeholder="Pesquisar nesta coleção"
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
        <div className="mq-image-selection-tools">
          <span>
            {visibleImages.length}{' '}
            {visibleImages.length === 1
              ? 'visível'
              : 'visíveis'}
            {visibleSelectedCount > 0
              ? ` · ${visibleSelectedCount} selecionada${visibleSelectedCount === 1 ? '' : 's'}`
              : ''}
          </span>

          <button
            type="button"
            disabled={
              locked ||
              visibleSelectedCount ===
                visibleImages.length
            }
            onClick={
              selectVisible
            }
          >
            Selecionar visíveis
          </button>
        </div>
      ) : null}

      {selectedIds.length > 0 ? (
        <div
          className="mq-image-selection-bar"
          aria-label="Organizar imagens selecionadas"
        >
          <div className="mq-image-selection-bar__heading">
            <strong>
              {selectedIds.length} imagem{selectedIds.length === 1 ? '' : 'ns'} selecionada{selectedIds.length === 1 ? '' : 's'}
            </strong>

            <button
              type="button"
              disabled={locked}
              onClick={() =>
                setSelectedIds([])
              }
            >
              Limpar
            </button>
          </div>

          <div className="mq-image-selection-bar__move">
            <select
              value={moveTarget}
              disabled={locked}
              aria-label="Mover imagens para coleção"
              onChange={(event) =>
                setMoveTarget(
                  event.target.value
                )
              }
            >
              <option
                value={UNASSIGNED_COLLECTION}
              >
                Sem coleção
              </option>

              {collections.map(
                (collection) => (
                  <option
                    key={collection.id}
                    value={collection.id}
                  >
                    {collection.name}
                  </option>
                )
              )}
            </select>

            <button
              type="button"
              disabled={locked}
              onClick={() =>
                void moveSelectedImages()
              }
            >
              Mover
            </button>
          </div>
        </div>
      ) : null}

      {visibleImages.length > 0 ? (
        <div className="mq-image-library">
          {visibleImages.map(
            (image) => {
              const selected =
                selectedSet.has(
                  image.id
                )

              return (
                <article
                  key={image.id}
                  className={`mq-image-library-card${selected ? ' is-selected' : ''}`}
                >
                  <label
                    className="mq-image-library-card__selector"
                    title={
                      selected
                        ? `Desmarcar ${image.name}`
                        : `Selecionar ${image.name}`
                    }
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      disabled={locked}
                      aria-label={
                        selected
                          ? `Desmarcar ${image.name}`
                          : `Selecionar ${image.name}`
                      }
                      onChange={() =>
                        toggleSelected(
                          image.id
                        )
                      }
                    />
                  </label>

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

                      <small
                        className="mq-image-library-card__collection"
                        title={
                          collectionNameForImage(
                            image
                          )
                        }
                      >
                        {collectionNameForImage(
                          image
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
            }
          )}
        </div>
      ) : images.length > 0 ? (
        <div className="mq-image-library-empty">
          <strong>
            {emptyTitle}
          </strong>

          {search ? (
            <button
              type="button"
              disabled={locked}
              onClick={() =>
                setSearch('')
              }
            >
              Limpar pesquisa
            </button>
          ) : activeCollection !==
            ALL_COLLECTIONS ? (
            <button
              type="button"
              disabled={locked}
              onClick={() =>
                changeActiveCollection(
                  ALL_COLLECTIONS
                )
              }
            >
              Ver todas as imagens
            </button>
          ) : null}
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
          As imagens ficam no IndexedDB deste browser. As coleções guardam apenas organização local. Nenhum ficheiro é enviado para a MA-CODE, para Cloudflare ou para qualquer servidor.
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
