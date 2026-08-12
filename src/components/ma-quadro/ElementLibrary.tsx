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

type LibraryView =
  | 'all'
  | 'recent'
  | 'favourites'

type StoredElementPreferences = {
  favourites: string[]
  recent: string[]
}

const STORAGE_KEY =
  'ma-quadro-element-library-v1'

const MAX_RECENT_ELEMENTS = 12

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

function readPreferences(): StoredElementPreferences {
  if (
    typeof window ===
    'undefined'
  ) {
    return {
      favourites: [],
      recent: []
    }
  }

  try {
    const raw =
      window.localStorage.getItem(
        STORAGE_KEY
      )

    if (!raw) {
      return {
        favourites: [],
        recent: []
      }
    }

    const parsed =
      JSON.parse(raw) as
        Partial<StoredElementPreferences>

    return {
      favourites:
        Array.isArray(
          parsed.favourites
        )
          ? parsed.favourites.filter(
              (value): value is string =>
                typeof value ===
                'string'
            )
          : [],
      recent:
        Array.isArray(
          parsed.recent
        )
          ? parsed.recent.filter(
              (value): value is string =>
                typeof value ===
                'string'
            )
          : []
    }
  } catch {
    return {
      favourites: [],
      recent: []
    }
  }
}

function writePreferences(
  preferences: StoredElementPreferences
) {
  if (
    typeof window ===
    'undefined'
  ) {
    return
  }

  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(
        preferences
      )
    )
  } catch {
    // Preferências de navegação não podem bloquear o editor.
  }
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
    view,
    setView
  ] = useState<LibraryView>(
    'all'
  )

  const [
    preferences,
    setPreferences
  ] = useState<StoredElementPreferences>(
    readPreferences
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

  const favouriteSet =
    useMemo(
      () =>
        new Set(
          preferences.favourites
        ),
      [preferences.favourites]
    )

  const recentRank =
    useMemo(
      () =>
        new Map(
          preferences.recent.map(
            (id, index) => [
              id,
              index
            ]
          )
        ),
      [preferences.recent]
    )

  const filteredElements =
    useMemo(() => {
      const query =
        normalizeSearch(
          search
        )

      const filtered =
        MA_QUADRO_LIBRARY_ELEMENTS.filter(
          (element) => {
            if (
              category !== 'all' &&
              element.category !==
                category
            ) {
              return false
            }

            if (
              view ===
                'favourites' &&
              !favouriteSet.has(
                element.id
              )
            ) {
              return false
            }

            if (
              view ===
                'recent' &&
              !recentRank.has(
                element.id
              )
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

      if (view === 'recent') {
        return filtered.sort(
          (first, second) =>
            (recentRank.get(
              first.id
            ) ?? 999) -
            (recentRank.get(
              second.id
            ) ?? 999)
        )
      }

      return filtered
    }, [
      category,
      favouriteSet,
      recentRank,
      search,
      view
    ])

  if (!host) {
    return null
  }

  const locked =
    editor.busy ||
    editor.structureBusy ||
    editor.imageCropEditing ||
    insertingId !== null

  const persistPreferences = (
    next: StoredElementPreferences
  ) => {
    setPreferences(next)
    writePreferences(next)
  }

  const toggleFavourite = (
    elementId: string
  ) => {
    const exists =
      preferences.favourites.includes(
        elementId
      )

    const favourites = exists
      ? preferences.favourites.filter(
          (id) =>
            id !== elementId
        )
      : [
          elementId,
          ...preferences.favourites
        ]

    persistPreferences({
      ...preferences,
      favourites
    })
  }

  const markRecent = (
    elementId: string
  ) => {
    const recent = [
      elementId,
      ...preferences.recent.filter(
        (id) =>
          id !== elementId
      )
    ].slice(
      0,
      MAX_RECENT_ELEMENTS
    )

    persistPreferences({
      ...preferences,
      recent
    })
  }

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

        markRecent(
          elementId
        )

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

  const clearFilters = () => {
    setSearch('')
    setCategory('all')
    setView('all')
    setMessage('')
  }

  return createPortal(
    <section
      className="mq-element-library"
      aria-label="Biblioteca de formas, ícones e elementos gráficos"
    >
      <div className="mq-element-library__heading">
        <div>
          <h3>
            Biblioteca de elementos
          </h3>

          <small>
            Elementos locais, pesquisáveis e editáveis, sem serviços externos.
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
        className="mq-element-library__views"
        aria-label="Vista da biblioteca"
      >
        <button
          type="button"
          className={
            view === 'all'
              ? 'is-active'
              : ''
          }
          aria-pressed={
            view === 'all'
          }
          disabled={locked}
          onClick={() =>
            setView('all')
          }
        >
          Todos
        </button>

        <button
          type="button"
          className={
            view === 'recent'
              ? 'is-active'
              : ''
          }
          aria-pressed={
            view === 'recent'
          }
          disabled={locked}
          onClick={() =>
            setView('recent')
          }
        >
          Recentes
        </button>

        <button
          type="button"
          className={
            view === 'favourites'
              ? 'is-active'
              : ''
          }
          aria-pressed={
            view ===
            'favourites'
          }
          disabled={locked}
          onClick={() =>
            setView(
              'favourites'
            )
          }
        >
          ★ Favoritos
        </button>
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

              const favourite =
                favouriteSet.has(
                  element.id
                )

              return (
                <article
                  key={element.id}
                  className="mq-element-library__item"
                >
                  <button
                    type="button"
                    className="mq-element-library__insert"
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

                  <button
                    type="button"
                    className={`mq-element-library__favourite${
                      favourite
                        ? ' is-active'
                        : ''
                    }`}
                    disabled={locked}
                    aria-pressed={
                      favourite
                    }
                    aria-label={
                      favourite
                        ? `Remover ${element.name} dos favoritos`
                        : `Adicionar ${element.name} aos favoritos`
                    }
                    title={
                      favourite
                        ? 'Remover dos favoritos'
                        : 'Adicionar aos favoritos'
                    }
                    onClick={() =>
                      toggleFavourite(
                        element.id
                      )
                    }
                  >
                    {favourite
                      ? '★'
                      : '☆'}
                  </button>
                </article>
              )
            }
          )}
        </div>
      ) : (
        <div className="mq-element-library__empty">
          <strong>
            Nenhum elemento encontrado.
          </strong>

          <span>
            Ajuste a pesquisa, a categoria ou a vista.
          </span>

          <button
            type="button"
            disabled={locked}
            onClick={clearFilters}
          >
            Limpar filtros
          </button>
        </div>
      )}

      <p className="mq-element-library__note">
        Depois de inserir, selecione o elemento para alterar a cor e a espessura no painel da direita.
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
