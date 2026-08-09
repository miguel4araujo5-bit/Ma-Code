import {
  useLayoutEffect,
  useMemo,
  useState
} from 'react'

import {
  createPortal
} from 'react-dom'

import {
  createMAQuadroLibraryElementDocument,
  createMAQuadroLibraryElementFile,
  createMAQuadroLibraryElementPreviewUrl,
  MA_QUADRO_ELEMENT_CATEGORIES,
  MA_QUADRO_ELEMENT_DEFAULT_COLOR,
  MA_QUADRO_LIBRARY_ELEMENTS,
  type MAQuadroElementCategory
} from '../../lib/maQuadro/elementLibrary'

import {
  useMAQuadroEditorContext
} from './editorContext'

type CategoryFilter =
  | 'all'
  | MAQuadroElementCategory

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

export default function ElementLibrary() {
  const editor =
    useMAQuadroEditorContext()

  const [
    host,
    setHost
  ] = useState<HTMLElement | null>(
    null
  )

  const [
    search,
    setSearch
  ] = useState('')

  const [
    category,
    setCategory
  ] = useState<CategoryFilter>(
    'all'
  )

  const [
    color,
    setColor
  ] = useState(
    editor.brand.colors[0]?.value ||
    MA_QUADRO_ELEMENT_DEFAULT_COLOR
  )

  const [
    insertingId,
    setInsertingId
  ] = useState<string | null>(
    null
  )

  const [
    message,
    setMessage
  ] = useState('')

  useLayoutEffect(() => {
    if (
      !editor.ready ||
      editor.activePanel !==
        'elements'
    ) {
      setHost(null)
      return
    }

    const elementGrid =
      document.querySelector<HTMLElement>(
        '.mq-left-panel .mq-element-grid'
      )

    if (!elementGrid) {
      setHost(null)
      return
    }

    const anchor =
      document.querySelector<HTMLElement>(
        '.mq-frame-builder-host'
      ) ||
      document.querySelector<HTMLElement>(
        '.mq-curved-text-builder-host'
      ) ||
      document.querySelector<HTMLElement>(
        '.mq-qr-builder-host'
      ) ||
      elementGrid

    const mount =
      document.createElement(
        'div'
      )

    mount.className =
      'mq-element-library-host'

    anchor.insertAdjacentElement(
      'afterend',
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

  const filteredElements =
    useMemo(() => {
      const query =
        normalizeSearch(
          search
        )

      return MA_QUADRO_LIBRARY_ELEMENTS.filter(
        (element) => {
          if (
            category !== 'all' &&
            element.category !==
              category
          ) {
            return false
          }

          if (!query) {
            return true
          }

          const haystack =
            normalizeSearch(
              [
                element.name,
                ...element.keywords
              ].join(' ')
            )

          return haystack.includes(
            query
          )
        }
      )
    }, [
      category,
      search
    ])

  if (!host) {
    return null
  }

  const locked =
    editor.busy ||
    editor.structureBusy ||
    editor.imageCropEditing ||
    insertingId !== null

  const insertElement =
    async (
      elementId: string
    ) => {
      if (locked) {
        return
      }

      setInsertingId(
        elementId
      )

      setMessage('')

      try {
        const document =
          createMAQuadroLibraryElementDocument(
            elementId,
            color
          )

        await editor
          .handleDroppedFiles([
            createMAQuadroLibraryElementFile(
              document
            )
          ])

        setMessage(
          'Elemento inserido.'
        )
      } catch {
        setMessage(
          'Não foi possível inserir o elemento.'
        )
      } finally {
        setInsertingId(
          null
        )
      }
    }

  return createPortal(
    <section
      className="mq-element-library"
      aria-label="Biblioteca de formas e ícones"
    >
      <div className="mq-element-library__heading">
        <div>
          <h3>
            Formas e ícones
          </h3>

          <small>
            Biblioteca local, pesquisável e sem serviços externos.
          </small>
        </div>

        <span>
          {
            MA_QUADRO_LIBRARY_ELEMENTS.length
          }
        </span>
      </div>

      <div className="mq-element-library__search-row">
        <label className="mq-element-library__search">
          <input
            type="search"
            aria-label="Pesquisar elementos"
            value={search}
            disabled={locked}
            placeholder="Pesquisar elementos…"
            onChange={(event) => {
              setSearch(
                event.target.value
              )

              setMessage('')
            }}
          />
        </label>

        <label className="mq-element-library__color">
          <span>
            Cor
          </span>

          <input
            type="color"
            value={color}
            disabled={locked}
            onChange={(event) => {
              setColor(
                event.target.value
              )

              setMessage('')
            }}
          />
        </label>
      </div>

      <div
        className="mq-element-library__categories"
        role="tablist"
        aria-label="Categorias de elementos"
      >
        {MA_QUADRO_ELEMENT_CATEGORIES.map(
          (item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={
                category ===
                item.id
              }
              className={
                category ===
                item.id
                  ? 'is-active'
                  : ''
              }
              disabled={locked}
              onClick={() =>
                setCategory(
                  item.id
                )
              }
            >
              {item.label}
            </button>
          )
        )}
      </div>

      {filteredElements.length > 0 ? (
        <div className="mq-element-library__grid">
          {filteredElements.map(
            (element) => {
              const document =
                createMAQuadroLibraryElementDocument(
                  element.id,
                  color
                )

              return (
                <button
                  key={element.id}
                  type="button"
                  disabled={locked}
                  title={`Inserir ${element.name}`}
                  aria-label={`Inserir ${element.name}`}
                  onClick={() =>
                    void insertElement(
                      element.id
                    )
                  }
                >
                  <span className="mq-element-library__preview">
                    <img
                      src={
                        createMAQuadroLibraryElementPreviewUrl(
                          document
                        )
                      }
                      alt=""
                    />
                  </span>

                  <small>
                    {element.name}
                  </small>
                </button>
              )
            }
          )}
        </div>
      ) : (
        <div className="mq-element-library__empty">
          Nenhum elemento corresponde à pesquisa.
        </div>
      )}

      <p className="mq-element-library__note">
        Depois de inserir, selecione o elemento para alterar a cor no painel da direita.
      </p>

      {message ? (
        <p
          className="mq-element-library__message"
          role="status"
        >
          {message}
        </p>
      ) : null}
    </section>,
    host
  )
}
