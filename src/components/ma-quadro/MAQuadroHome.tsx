import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent
} from 'react'

import type {
  MAQuadroProject,
  MAQuadroProjectCategory
} from '../../types/maQuadro'

import {
  useMAQuadroEditorContext
} from './editorContext'

import './maQuadroHome.css'

const categoryLabels:
  Record<
    MAQuadroProjectCategory,
    string
  > = {
    social:
      'Redes sociais',
    story:
      'Vertical',
    presentation:
      'Apresentação',
    print:
      'Impressão',
    invitation:
      'Convite',
    custom:
      'Personalizado'
  }

function normalizeSearch(
  value: string
) {
  return value
    .trim()
    .toLocaleLowerCase(
      'pt-PT'
    )
    .normalize(
      'NFD'
    )
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
}

function formatUpdatedAt(
  value: string
) {
  const date =
    new Date(
      value
    )

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return 'Recentemente'
  }

  return new Intl.DateTimeFormat(
    'pt-PT',
    {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    }
  ).format(
    date
  )
}

function ProjectPreview({
  project
}: {
  project:
    MAQuadroProject
}) {
  const page =
    project.pages[0]

  if (
    page?.thumbnail
  ) {
    return (
      <img
        src={
          page.thumbnail
        }
        alt=""
      />
    )
  }

  return (
    <span className="mq-home-project__placeholder">
      MQ
    </span>
  )
}

export default function MAQuadroHome({
  onEnterEditor
}: {
  onEnterEditor:
    () => void
}) {
  const editor =
    useMAQuadroEditorContext()

  const importInputRef =
    useRef<HTMLInputElement | null>(
      null
    )

  const customStartProjectRef =
    useRef<string | null>(
      null
    )

  const [
    search,
    setSearch
  ] = useState(
    ''
  )

  const [
    actionId,
    setActionId
  ] = useState<
    string |
    null
  >(
    null
  )

  const [
    waitingForCustom,
    setWaitingForCustom
  ] = useState(
    false
  )

  const locked =
    editor.busy ||
    editor.structureBusy ||
    editor.imageCropEditing ||
    actionId !== null

  const query =
    normalizeSearch(
      search
    )

  const projects =
    useMemo(
      () =>
        editor.projects
          .filter(
            (project) =>
              !project.isTemplate
          )
          .sort(
            (
              first,
              second
            ) =>
              second.updatedAt.localeCompare(
                first.updatedAt
              )
          ),
      [
        editor.projects
      ]
    )

  const templates =
    useMemo(
      () =>
        editor.projects
          .filter(
            (project) =>
              project.isTemplate
          )
          .sort(
            (
              first,
              second
            ) =>
              second.updatedAt.localeCompare(
                first.updatedAt
              )
          ),
      [
        editor.projects
      ]
    )

  const matchingProjects =
    useMemo(
      () => {
        const filtered =
          query
            ? projects.filter(
                (
                  project
                ) =>
                  normalizeSearch(
                    [
                      project.name,
                      categoryLabels[
                        project.category
                      ]
                    ].join(
                      ' '
                    )
                  ).includes(
                    query
                  )
              )
            : projects

        return filtered.slice(
          0,
          query
            ? 8
            : 6
        )
      },
      [
        projects,
        query
      ]
    )

  const matchingTemplates =
    useMemo(
      () => {
        const filtered =
          query
            ? templates.filter(
                (
                  template
                ) =>
                  normalizeSearch(
                    [
                      template.name,
                      categoryLabels[
                        template.category
                      ]
                    ].join(
                      ' '
                    )
                  ).includes(
                    query
                  )
              )
            : templates

        return filtered.slice(
          0,
          6
        )
      },
      [
        query,
        templates
      ]
    )

  const matchingPresets =
    useMemo(
      () => {
        const filtered =
          query
            ? editor.presets.filter(
                (
                  preset
                ) =>
                  normalizeSearch(
                    [
                      preset.name,
                      preset.description,
                      categoryLabels[
                        preset.category
                      ]
                    ].join(
                      ' '
                    )
                  ).includes(
                    query
                  )
              )
            : editor.presets

        return filtered.slice(
          0,
          6
        )
      },
      [
        editor.presets,
        query
      ]
    )

  useEffect(() => {
    if (
      !waitingForCustom ||
      editor.newDesignOpen
    ) {
      return
    }

    const currentId =
      editor.project?.id ||
      null

    if (
      currentId !==
      customStartProjectRef.current
    ) {
      onEnterEditor()
    }

    setWaitingForCustom(
      false
    )
  }, [
    editor.newDesignOpen,
    editor.project?.id,
    onEnterEditor,
    waitingForCustom
  ])

  const openProject =
    async (
      projectId: string
    ) => {
      if (locked) {
        return
      }

      setActionId(
        `project:${projectId}`
      )

      try {
        await editor.openProject(
          projectId
        )

        onEnterEditor()
      } finally {
        setActionId(
          null
        )
      }
    }

  const createFromPreset =
    async (
      presetId: string
    ) => {
      if (locked) {
        return
      }

      const preset =
        editor.presets.find(
          (
            item
          ) =>
            item.id ===
            presetId
        )

      if (!preset) {
        return
      }

      setActionId(
        `preset:${preset.id}`
      )

      try {
        await editor.createFromPreset(
          preset
        )

        onEnterEditor()
      } finally {
        setActionId(
          null
        )
      }
    }

  const openCustomDesign =
    () => {
      if (locked) {
        return
      }

      customStartProjectRef.current =
        editor.project?.id ||
        null

      setWaitingForCustom(
        true
      )

      editor.setNewDesignOpen(
        true
      )
    }

  const handleImport =
    async (
      event:
        ChangeEvent<HTMLInputElement>
    ) => {
      const file =
        event.currentTarget
          .files?.[0]

      if (
        !file ||
        locked
      ) {
        return
      }

      setActionId(
        'import'
      )

      try {
        await editor.importProject(
          event
        )

        onEnterEditor()
      } finally {
        setActionId(
          null
        )
      }
    }

  const continueProject =
    editor.project &&
    !editor.project.isTemplate
      ? editor.project
      : projects[0] ||
        null

  const hasSearchResults =
    matchingProjects.length >
      0 ||
    matchingTemplates.length >
      0 ||
    matchingPresets.length >
      0

  return (
    <main className="mq-home">
      <header className="mq-home-header">
        <div className="mq-home-header__brand">
          <a
            href="/produtos"
            className="mq-home-header__back"
            aria-label="Voltar aos produtos"
            title="Voltar aos produtos"
          >
            ←
          </a>

          <a
            href="/"
            className="mq-home-brand"
            aria-label="MA-Code.pt"
          >
            <img
              src="/ma-code.png"
              alt=""
            />

            <span>
              <strong>
                MA-Quadro
              </strong>

              <small>
                Estúdio de design
                local
              </small>
            </span>
          </a>
        </div>

        <div className="mq-home-header__actions">
          <button
            type="button"
            className="mq-home-button mq-home-button--ghost"
            disabled={locked}
            onClick={() =>
              importInputRef
                .current
                ?.click()
            }
          >
            Importar projeto
          </button>

          <button
            type="button"
            className="mq-home-button mq-home-button--primary"
            disabled={locked}
            onClick={
              openCustomDesign
            }
          >
            + Criar design
          </button>

          <input
            ref={
              importInputRef
            }
            type="file"
            accept="application/json,.json"
            disabled={locked}
            onChange={(event) =>
              void handleImport(
                event
              )
            }
            hidden
          />
        </div>
      </header>

      <div className="mq-home-scroll">
        <section className="mq-home-hero">
          <div className="mq-home-hero__copy">
            <span className="mq-home-eyebrow">
              MA-QUADRO
            </span>

            <h1>
              O que pretende criar?
            </h1>

            <p>
              Comece num formato,
              utilize um modelo ou
              continue um projeto
              guardado neste
              dispositivo.
            </p>
          </div>

          <label className="mq-home-search">
            <span
              aria-hidden="true"
            >
              ⌕
            </span>

            <input
              type="search"
              value={search}
              placeholder="Pesquisar projetos, modelos e formatos…"
              aria-label="Pesquisar projetos, modelos e formatos"
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
            />

            {search ? (
              <button
                type="button"
                aria-label="Limpar pesquisa"
                onClick={() =>
                  setSearch(
                    ''
                  )
                }
              >
                ×
              </button>
            ) : null}
          </label>
        </section>

        {!query &&
        continueProject ? (
          <section className="mq-home-continue">
            <button
              type="button"
              disabled={locked}
              onClick={() =>
                onEnterEditor()
              }
            >
              <span className="mq-home-continue__preview">
                <ProjectPreview
                  project={
                    continueProject
                  }
                />
              </span>

              <span className="mq-home-continue__copy">
                <small>
                  Continuar a trabalhar
                </small>

                <strong>
                  {
                    continueProject.name
                  }
                </strong>

                <span>
                  {
                    categoryLabels[
                      continueProject
                        .category
                    ]
                  }
                  {' · '}
                  {
                    continueProject
                      .pages.length
                  }{' '}
                  {continueProject
                    .pages.length ===
                  1
                    ? 'página'
                    : 'páginas'}
                  {' · '}
                  Atualizado{' '}
                  {formatUpdatedAt(
                    continueProject
                      .updatedAt
                  )}
                </span>
              </span>

              <span className="mq-home-continue__action">
                Abrir editor
                <b>→</b>
              </span>
            </button>
          </section>
        ) : null}

        {matchingPresets.length >
        0 ? (
          <section className="mq-home-section">
            <div className="mq-home-section__heading">
              <span>
                <h2>
                  Criar um design
                </h2>

                <p>
                  Formatos prontos para
                  começar rapidamente.
                </p>
              </span>

              {!query ? (
                <button
                  type="button"
                  disabled={locked}
                  onClick={
                    openCustomDesign
                  }
                >
                  Tamanho personalizado
                </button>
              ) : null}
            </div>

            <div className="mq-home-presets">
              {matchingPresets.map(
                (
                  preset
                ) => (
                  <button
                    key={
                      preset.id
                    }
                    type="button"
                    className="mq-home-preset"
                    disabled={locked}
                    onClick={() =>
                      void createFromPreset(
                        preset.id
                      )
                    }
                  >
                    <span
                      className="mq-home-preset__visual"
                      data-category={
                        preset.category
                      }
                    >
                      <span>
                        {preset.width}
                        {' × '}
                        {preset.height}
                      </span>
                    </span>

                    <strong>
                      {preset.name}
                    </strong>

                    <small>
                      {
                        preset.description
                      }
                    </small>
                  </button>
                )
              )}

              {!query ? (
                <button
                  type="button"
                  className="mq-home-preset mq-home-preset--custom"
                  disabled={locked}
                  onClick={
                    openCustomDesign
                  }
                >
                  <span className="mq-home-preset__custom-icon">
                    +
                  </span>

                  <strong>
                    Personalizado
                  </strong>

                  <small>
                    Defina largura,
                    altura e categoria.
                  </small>
                </button>
              ) : null}
            </div>
          </section>
        ) : null}

        {matchingProjects.length >
        0 ? (
          <section className="mq-home-section">
            <div className="mq-home-section__heading">
              <span>
                <h2>
                  {query
                    ? 'Projetos encontrados'
                    : 'Projetos recentes'}
                </h2>

                <p>
                  Os projetos ficam
                  guardados localmente
                  neste dispositivo.
                </p>
              </span>

              {!query &&
              projects.length > 6 ? (
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => {
                    editor.setActivePanel(
                      'projects'
                    )

                    onEnterEditor()
                  }}
                >
                  Ver todos
                </button>
              ) : null}
            </div>

            <div className="mq-home-project-grid">
              {matchingProjects.map(
                (
                  project
                ) => (
                  <button
                    key={
                      project.id
                    }
                    type="button"
                    className="mq-home-project"
                    disabled={locked}
                    onClick={() =>
                      void openProject(
                        project.id
                      )
                    }
                  >
                    <span className="mq-home-project__preview">
                      <ProjectPreview
                        project={
                          project
                        }
                      />
                    </span>

                    <span className="mq-home-project__copy">
                      <strong>
                        {
                          project.name
                        }
                      </strong>

                      <small>
                        {
                          categoryLabels[
                            project
                              .category
                          ]
                        }
                        {' · '}
                        {
                          project
                            .pages
                            .length
                        }{' '}
                        {project
                          .pages
                          .length ===
                        1
                          ? 'página'
                          : 'páginas'}
                      </small>

                      <span>
                        {formatUpdatedAt(
                          project.updatedAt
                        )}
                      </span>
                    </span>
                  </button>
                )
              )}
            </div>
          </section>
        ) : null}

        {matchingTemplates.length >
        0 ? (
          <section className="mq-home-section">
            <div className="mq-home-section__heading">
              <span>
                <h2>
                  Modelos
                </h2>

                <p>
                  Utilize um modelo
                  existente sem alterar
                  o original.
                </p>
              </span>

              {!query ? (
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => {
                    editor.setActivePanel(
                      'templates'
                    )

                    onEnterEditor()
                  }}
                >
                  Explorar modelos
                </button>
              ) : null}
            </div>

            <div className="mq-home-template-grid">
              {matchingTemplates.map(
                (
                  template
                ) => (
                  <button
                    key={
                      template.id
                    }
                    type="button"
                    className="mq-home-template"
                    disabled={locked}
                    onClick={() =>
                      void openProject(
                        template.id
                      )
                    }
                  >
                    <span className="mq-home-template__preview">
                      <ProjectPreview
                        project={
                          template
                        }
                      />
                    </span>

                    <span>
                      <strong>
                        {
                          template.name
                        }
                      </strong>

                      <small>
                        {
                          categoryLabels[
                            template
                              .category
                          ]
                        }
                      </small>
                    </span>
                  </button>
                )
              )}
            </div>
          </section>
        ) : null}

        {query &&
        !hasSearchResults ? (
          <section className="mq-home-empty">
            <strong>
              Nenhum resultado
              encontrado.
            </strong>

            <span>
              Experimente outro termo
              ou limpe a pesquisa.
            </span>

            <button
              type="button"
              onClick={() =>
                setSearch(
                  ''
                )
              }
            >
              Limpar pesquisa
            </button>
          </section>
        ) : null}

        <footer className="mq-home-footer">
          <span>
            Projetos guardados no
            dispositivo
          </span>

          <span>
            Autosave ativo
          </span>

          <span>
            Sem conta obrigatória
          </span>
        </footer>
      </div>
    </main>
  )
}
