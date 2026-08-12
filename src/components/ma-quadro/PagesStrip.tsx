import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent
} from 'react'

import type {
  MAQuadroPage
} from '../../types/maQuadro'

import {
  useMAQuadroEditorContext
} from './editorContext'

import './maQuadroPagesManager.css'

type PageViewMode =
  | 'cards'
  | 'compact'

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

function PageNameField({
  page,
  index,
  disabled,
  onCommit
}: {
  page:
    MAQuadroPage

  index:
    number

  disabled:
    boolean

  onCommit: (
    pageId: string,
    name: string
  ) => Promise<void>
}) {
  const [
    draft,
    setDraft
  ] = useState(
    page.name
  )

  const skipCommitRef =
    useRef(false)

  useEffect(() => {
    setDraft(
      page.name
    )

    skipCommitRef.current =
      false
  }, [
    page.id,
    page.name
  ])

  const commit =
    async () => {
      if (
        skipCommitRef.current
      ) {
        skipCommitRef.current =
          false

        setDraft(
          page.name
        )

        return
      }

      const next =
        draft.trim() ||
        `Página ${index + 1}`

      setDraft(next)

      if (
        next ===
        page.name
      ) {
        return
      }

      await onCommit(
        page.id,
        next
      )
    }

  const handleKeyDown = (
    event:
      KeyboardEvent<HTMLInputElement>
  ) => {
    if (
      event.key ===
      'Enter'
    ) {
      event.preventDefault()

      event.currentTarget
        .blur()

      return
    }

    if (
      event.key ===
      'Escape'
    ) {
      event.preventDefault()

      skipCommitRef.current =
        true

      setDraft(
        page.name
      )

      event.currentTarget
        .blur()
    }
  }

  return (
    <input
      type="text"
      value={draft}
      maxLength={180}
      disabled={disabled}
      onChange={(event) =>
        setDraft(
          event.target.value
        )
      }
      onBlur={() =>
        void commit()
      }
      onKeyDown={
        handleKeyDown
      }
      aria-label={`Nome da página ${index + 1}`}
    />
  )
}

export default function PagesStrip() {
  const editor =
    useMAQuadroEditorContext()

  const [
    dragPageId,
    setDragPageId
  ] = useState<
    string | null
  >(null)

  const [
    dragOverPageId,
    setDragOverPageId
  ] = useState<
    string | null
  >(null)

  const [
    reorderBusy,
    setReorderBusy
  ] = useState(false)

  const [
    search,
    setSearch
  ] = useState('')

  const [
    viewMode,
    setViewMode
  ] = useState<PageViewMode>(
    'cards'
  )

  const project =
    editor.project

  const activePageId =
    project?.activePageId ||
    null

  useEffect(() => {
    if (!activePageId) {
      return
    }

    const card =
      document.querySelector<HTMLElement>(
        `[data-ma-quadro-page-id="${CSS.escape(activePageId)}"]`
      )

    card?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'nearest'
    })
  }, [
    activePageId,
    viewMode
  ])

  const filteredPages =
    useMemo(() => {
      if (!project) {
        return []
      }

      const query =
        normalizeSearch(
          search
        )

      return project.pages
        .map((page, index) => ({
          page,
          index
        }))
        .filter(({ page, index }) => {
          if (!query) {
            return true
          }

          return normalizeSearch(
            `${page.name} pagina ${index + 1}`
          ).includes(query)
        })
    }, [
      project,
      search
    ])

  if (!project) {
    return null
  }

  const locked =
    editor.structureBusy ||
    editor.busy ||
    editor.imageCropEditing ||
    reorderBusy

  const activeIndex =
    project.pages.findIndex(
      (page) =>
        page.id ===
        project.activePageId
    )

  const movePageToIndex =
    async (
      pageId: string,
      targetIndex: number
    ) => {
      if (
        locked
      ) {
        return
      }

      const sourceIndex =
        project.pages
          .findIndex(
            (page) =>
              page.id ===
              pageId
          )

      if (
        sourceIndex < 0 ||
        targetIndex < 0 ||
        targetIndex >=
          project.pages.length ||
        sourceIndex ===
          targetIndex
      ) {
        return
      }

      setReorderBusy(
        true
      )

      try {
        if (
          sourceIndex <
          targetIndex
        ) {
          for (
            let index =
              sourceIndex;
            index <
              targetIndex;
            index += 1
          ) {
            await editor.movePage(
              pageId,
              'right'
            )
          }
        } else {
          for (
            let index =
              sourceIndex;
            index >
              targetIndex;
            index -= 1
          ) {
            await editor.movePage(
              pageId,
              'left'
            )
          }
        }
      } finally {
        setReorderBusy(
          false
        )

        setDragPageId(
          null
        )

        setDragOverPageId(
          null
        )
      }
    }

  const duplicatePageById =
    async (
      pageId: string
    ) => {
      if (locked) {
        return
      }

      if (
        project.activePageId !==
        pageId
      ) {
        await editor.setActivePage(
          pageId
        )
      }

      await editor
        .duplicateActivePage()
    }

  const openPreviousPage =
    async () => {
      if (
        locked ||
        activeIndex <= 0
      ) {
        return
      }

      await editor.setActivePage(
        project.pages[
          activeIndex - 1
        ].id
      )
    }

  const openNextPage =
    async () => {
      if (
        locked ||
        activeIndex < 0 ||
        activeIndex >=
          project.pages.length - 1
      ) {
        return
      }

      await editor.setActivePage(
        project.pages[
          activeIndex + 1
        ].id
      )
    }

  return (
    <section
      className={`mq-pages-strip mq-pages-strip--managed mq-pages-strip--${viewMode}`}
      aria-label="Páginas do projeto"
      aria-busy={locked}
    >
      <div className="mq-pages-strip__header mq-pages-manager__header">
        <span className="mq-pages-strip__title">
          <strong>
            Páginas
          </strong>

          <small>
            {
              project.pages
                .length
            }
          </small>

          <span className="mq-pages-strip__hint">
            Arraste ⋮⋮ para
            reordenar
          </span>
        </span>

        <div className="mq-pages-manager__primary-actions">
          <button
            type="button"
            onClick={() =>
              void editor
                .duplicateActivePage()
            }
            disabled={
              locked ||
              !editor.activePage
            }
          >
            Duplicar página
          </button>

          <button
            type="button"
            onClick={() =>
              void editor
                .addPage()
            }
            disabled={locked}
          >
            + Adicionar página
          </button>
        </div>
      </div>

      <div className="mq-pages-manager__toolbar">
        <label className="mq-pages-manager__search">
          <span aria-hidden="true">
            ⌕
          </span>

          <input
            type="search"
            value={search}
            disabled={locked}
            placeholder="Pesquisar páginas…"
            aria-label="Pesquisar páginas"
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
              aria-label="Limpar pesquisa de páginas"
              title="Limpar pesquisa"
              onClick={() =>
                setSearch('')
              }
            >
              ×
            </button>
          ) : null}
        </label>

        <div
          className="mq-pages-manager__navigator"
          aria-label="Navegação entre páginas"
        >
          <button
            type="button"
            disabled={
              locked ||
              activeIndex <= 0
            }
            title="Página anterior"
            aria-label="Abrir página anterior"
            onClick={() =>
              void openPreviousPage()
            }
          >
            ←
          </button>

          <span>
            {activeIndex >= 0
              ? activeIndex + 1
              : 0}
            {' / '}
            {project.pages.length}
          </span>

          <button
            type="button"
            disabled={
              locked ||
              activeIndex < 0 ||
              activeIndex >=
                project.pages.length - 1
            }
            title="Página seguinte"
            aria-label="Abrir página seguinte"
            onClick={() =>
              void openNextPage()
            }
          >
            →
          </button>
        </div>

        <div
          className="mq-pages-manager__view-switch"
          aria-label="Modo de apresentação das páginas"
        >
          <button
            type="button"
            className={
              viewMode ===
              'cards'
                ? 'is-active'
                : ''
            }
            disabled={locked}
            aria-pressed={
              viewMode ===
              'cards'
            }
            title="Miniaturas grandes"
            onClick={() =>
              setViewMode(
                'cards'
              )
            }
          >
            ▦
          </button>

          <button
            type="button"
            className={
              viewMode ===
              'compact'
                ? 'is-active'
                : ''
            }
            disabled={locked}
            aria-pressed={
              viewMode ===
              'compact'
            }
            title="Miniaturas compactas"
            onClick={() =>
              setViewMode(
                'compact'
              )
            }
          >
            ☷
          </button>
        </div>
      </div>

      {filteredPages.length > 0 ? (
        <div className="mq-pages-list mq-pages-manager__list">
          {filteredPages.map(
            ({
              page,
              index
            }) => {
              const active =
                project
                  .activePageId ===
                page.id

              const dragging =
                dragPageId ===
                page.id

              const dragOver =
                dragOverPageId ===
                  page.id &&
                dragPageId !==
                  page.id

              return (
                <article
                  key={page.id}
                  data-ma-quadro-page-id={page.id}
                  className={`mq-page-card${
                    active
                      ? ' is-active'
                      : ''
                  }${
                    dragging
                      ? ' is-dragging'
                      : ''
                  }${
                    dragOver
                      ? ' is-drag-over'
                      : ''
                  }`}
                  onDragOver={(event) => {
                    if (
                      locked ||
                      !dragPageId ||
                      dragPageId ===
                        page.id
                    ) {
                      return
                    }

                    event.preventDefault()

                    event.dataTransfer
                      .dropEffect =
                      'move'

                    setDragOverPageId(
                      page.id
                    )
                  }}
                  onDrop={(event) => {
                    event.preventDefault()

                    if (locked) {
                      return
                    }

                    const sourceId =
                      dragPageId ||
                      event.dataTransfer
                        .getData(
                          'application/x-ma-quadro-page'
                        ) ||
                      event.dataTransfer
                        .getData(
                          'text/plain'
                        )

                    setDragOverPageId(
                      null
                    )

                    if (
                      !sourceId ||
                      sourceId ===
                        page.id
                    ) {
                      setDragPageId(
                        null
                      )

                      return
                    }

                    void movePageToIndex(
                      sourceId,
                      index
                    )
                  }}
                >
                  <button
                    type="button"
                    className="mq-page-card__preview"
                    onClick={() =>
                      void editor
                        .setActivePage(
                          page.id
                        )
                    }
                    disabled={
                      locked ||
                      active
                    }
                    aria-label={`Abrir ${page.name}`}
                    aria-current={
                      active
                        ? 'page'
                        : undefined
                    }
                  >
                    <span className="mq-page-card__number">
                      {index + 1}
                    </span>

                    {page.thumbnail ? (
                      <img
                        src={
                          page.thumbnail
                        }
                        alt=""
                        draggable={false}
                      />
                    ) : (
                      <span
                        className="mq-page-card__blank"
                        style={{
                          background:
                            page.background
                              .type ===
                            'transparent'
                              ? 'repeating-conic-gradient(#E2E8F0 0 25%, #FFFFFF 0 50%) 50% / 14px 14px'
                              : page.background
                                  .type ===
                                'gradient'
                                ? `linear-gradient(${page.background.gradientAngle}deg, ${page.background.gradientFrom}, ${page.background.gradientTo})`
                                : page.background
                                    .color
                        }}
                      />
                    )}
                  </button>

                  <PageNameField
                    page={page}
                    index={index}
                    disabled={locked}
                    onCommit={
                      editor.renamePage
                    }
                  />

                  <div className="mq-page-card__actions mq-pages-manager__card-actions">
                    <button
                      type="button"
                      className="mq-page-card__drag-handle"
                      draggable={!locked}
                      disabled={locked}
                      onDragStart={(event) => {
                        if (locked) {
                          event.preventDefault()

                          return
                        }

                        setDragPageId(
                          page.id
                        )

                        setDragOverPageId(
                          null
                        )

                        event.dataTransfer
                          .effectAllowed =
                          'move'

                        event.dataTransfer
                          .setData(
                            'application/x-ma-quadro-page',
                            page.id
                          )

                        event.dataTransfer
                          .setData(
                            'text/plain',
                            page.id
                          )
                      }}
                      onDragEnd={() => {
                        setDragPageId(
                          null
                        )

                        setDragOverPageId(
                          null
                        )
                      }}
                      onClick={(event) => {
                        event.preventDefault()
                      }}
                      title="Arrastar para reordenar"
                      aria-label={`Arrastar ${page.name} para reordenar`}
                    >
                      ⋮⋮
                    </button>

                    <button
                      type="button"
                      disabled={locked}
                      title={`Duplicar ${page.name}`}
                      aria-label={`Duplicar ${page.name}`}
                      onClick={() =>
                        void duplicatePageById(
                          page.id
                        )
                      }
                    >
                      ⧉
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        void editor
                          .movePage(
                            page.id,
                            'left'
                          )
                      }
                      disabled={
                        locked ||
                        index === 0
                      }
                      title="Mover para a esquerda"
                      aria-label={`Mover ${page.name} para a esquerda`}
                    >
                      ←
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        void editor
                          .movePage(
                            page.id,
                            'right'
                          )
                      }
                      disabled={
                        locked ||
                        index ===
                          project.pages
                            .length - 1
                      }
                      title="Mover para a direita"
                      aria-label={`Mover ${page.name} para a direita`}
                    >
                      →
                    </button>

                    {active ? (
                      <button
                        type="button"
                        onClick={() =>
                          void editor
                            .deleteActivePage()
                        }
                        disabled={
                          locked ||
                          project.pages
                            .length === 1
                        }
                        title="Eliminar página"
                        aria-label={`Eliminar ${page.name}`}
                      >
                        ×
                      </button>
                    ) : null}
                  </div>
                </article>
              )
            }
          )}
        </div>
      ) : (
        <div className="mq-pages-manager__empty">
          <strong>
            Nenhuma página encontrada.
          </strong>

          <span>
            Experimente outro nome ou limpe a pesquisa.
          </span>

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
      )}
    </section>
  )
}
