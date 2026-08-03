import {
  useMAQuadroEditorContext
} from './editorContext'

export default function PagesStrip() {
  const editor =
    useMAQuadroEditorContext()

  const project =
    editor.project

  if (!project) {
    return null
  }

  return (
    <section
      className="mq-pages-strip"
      aria-label="Páginas do projeto"
    >
      <div className="mq-pages-strip__header">
        <span>
          <strong>
            Páginas
          </strong>

          <small>
            {project.pages.length}
          </small>
        </span>

        <div>
          <button
            type="button"
            onClick={() =>
              void editor
                .duplicateActivePage()
            }
            disabled={
              !editor.activePage
            }
          >
            Duplicar página
          </button>

          <button
            type="button"
            onClick={() =>
              void editor.addPage()
            }
          >
            + Adicionar página
          </button>
        </div>
      </div>

      <div className="mq-pages-list">
        {project.pages.map(
          (
            page,
            index
          ) => (
            <article
              key={page.id}
              className={`mq-page-card${
                project
                  .activePageId ===
                page.id
                  ? ' is-active'
                  : ''
              }`}
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
                aria-label={`Abrir ${page.name}`}
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

              <input
                type="text"
                value={page.name}
                onChange={(event) =>
                  editor.renamePage(
                    page.id,
                    event.target.value
                  )
                }
                aria-label={`Nome da página ${index + 1}`}
              />

              <div className="mq-page-card__actions">
                <button
                  type="button"
                  onClick={() =>
                    editor.movePage(
                      page.id,
                      'left'
                    )
                  }
                  disabled={
                    index === 0
                  }
                  title="Mover para a esquerda"
                >
                  ←
                </button>

                <button
                  type="button"
                  onClick={() =>
                    editor.movePage(
                      page.id,
                      'right'
                    )
                  }
                  disabled={
                    index ===
                    project.pages
                      .length -
                      1
                  }
                  title="Mover para a direita"
                >
                  →
                </button>

                {project
                  .activePageId ===
                page.id ? (
                  <button
                    type="button"
                    onClick={() =>
                      void editor
                        .deleteActivePage()
                    }
                    disabled={
                      project.pages
                        .length ===
                      1
                    }
                    title="Eliminar página"
                  >
                    ×
                  </button>
                ) : null}
              </div>
            </article>
          )
        )}
      </div>
    </section>
  )
}
