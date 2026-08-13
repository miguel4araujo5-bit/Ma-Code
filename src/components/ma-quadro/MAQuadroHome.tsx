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
import './maQuadroHomeProjects.css'

const categoryLabels:
  Record<
    MAQuadroProjectCategory,
    string
  > = {
    social: 'Redes sociais',
    story: 'Vertical',
    presentation: 'Apresentação',
    print: 'Impressão',
    invitation: 'Convite',
    custom: 'Personalizado'
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

function ProjectActionsMenu({
  project,
  locked,
  onOpen,
  onDuplicate,
  onRename,
  onSaveAsTemplate,
  onDelete
}: {
  project:
    MAQuadroProject
  locked:
    boolean
  onOpen:
    () => void
  onDuplicate:
    () => void
  onRename:
    () => void
  onSaveAsTemplate:
    () => void
  onDelete:
    () => void
}) {
  const detailsRef =
    useRef<HTMLDetailsElement | null>(
      null
    )

  useEffect(() => {
    const handlePointerDown = (
      event:
        PointerEvent
    ) => {
      const details =
        detailsRef.current

      if (
        !details?.open ||
        !(event.target instanceof Node) ||
        details.contains(
          event.target
        )
      ) {
        return
      }

      details.open =
        false
    }

    document.addEventListener(
      'pointerdown',
      handlePointerDown
    )

    return () => {
      document.removeEventListener(
        'pointerdown',
        handlePointerDown
      )
    }
  }, [])

  const run = (
    action:
      () => void
  ) => {
    if (locked) {
      return
    }

    if (
      detailsRef.current
    ) {
      detailsRef.current.open =
        false
    }

    action()
  }

  return (
    <details
      ref={
        detailsRef
      }
      className="mq-home-project-actions"
    >
      <summary
        aria-label={`Ações de ${project.name}`}
        title="Mais ações"
        onClick={(event) => {
          if (locked) {
            event.preventDefault()
          }
        }}
      >
        ⋯
      </summary>

      <div className="mq-home-project-actions__panel">
        <button
          type="button"
          disabled={locked}
          onClick={() =>
            run(
              onOpen
            )
          }
        >
          Abrir
        </button>

        <button
          type="button"
          disabled={locked}
          onClick={() =>
            run(
              onDuplicate
            )
          }
        >
          Duplicar
        </button>

        <button
          type="button"
          disabled={locked}
          onClick={() =>
            run(
              onRename
            )
          }
        >
          Renomear
        </button>

        <button
          type="button"
          disabled={locked}
          onClick={() =>
            run(
              onSaveAsTemplate
            )
          }
        >
          Guardar como modelo
        </button>

        <div className="mq-home-project-actions__separator" />

        <button
          type="button"
          className="is-danger"
          disabled={locked}
          onClick={() =>
            run(
              onDelete
            )
          }
        >
          Eliminar
        </button>
      </div>
    </details>
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

  const [
    renameProject,
    setRenameProject
  ] = useState<
    MAQuadroProject |
    null
  >(
    null
  )

  const [
    renameDraft,
    setRenameDraft
  ] = useState(
    ''
  )

  const [
    renameError,
    setRenameError
  ] = useState(
    ''
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
      projectId:
        string
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

  const duplicateProject =
    async (
      project:
        MAQuadroProject
    ) => {
      if (locked) {
        return
      }

      setActionId(
        `duplicate:${project.id}`
      )

      try {
        await editor.duplicateProject(
          project.id
        )
      } finally {
        setActionId(
          null
        )
      }
    }

  const beginRename =
    (
      project:
        MAQuadroProject
    ) => {
      if (locked) {
        return
      }

      setRenameProject(
        project
      )

      setRenameDraft(
        project.name
      )

      setRenameError(
        ''
      )
    }

  const closeRename =
    () => {
      if (
        actionId?.startsWith(
          'rename:'
        )
      ) {
        return
      }

      setRenameProject(
        null
      )

      setRenameDraft(
        ''
      )

      setRenameError(
        ''
      )
    }

  const commitRename =
    async () => {
      if (
        !renameProject ||
        locked
      ) {
        return
      }

      const nextName =
        renameDraft.trim()

      if (!nextName) {
        setRenameError(
          'Introduza um nome para o projeto.'
        )

        return
      }

      if (
        nextName ===
        renameProject.name
      ) {
        closeRename()

        return
      }

      setActionId(
        `rename:${renameProject.id}`
      )

      setRenameError(
        ''
      )

      try {
        if (
          editor.project?.id !==
          renameProject.id
        ) {
          await editor.openProject(
            renameProject.id
          )
        }

        editor.setProjectName(
          nextName
        )

        const saved =
          await editor.saveProject(
            true
          )

        if (!saved) {
          setRenameError(
            'Não foi possível guardar o novo nome.'
          )

          return
        }

        setRenameProject(
          null
        )

        setRenameDraft(
          ''
        )
      } catch {
        setRenameError(
          'Não foi possível renomear o projeto.'
        )
      } finally {
        setActionId(
          null
        )
      }
    }

  const saveAsTemplate =
    async (
      project:
        MAQuadroProject
    ) => {
      if (locked) {
        return
      }

      setActionId(
        `template:${project.id}`
      )

      try {
        if (
          editor.project?.id !==
          project.id
        ) {
          await editor.openProject(
            project.id
          )
        }

        await editor
          .saveProjectAsTemplate()
      } finally {
        setActionId(
          null
        )
      }
    }

  const deleteProject =
    async (
      project:
        MAQuadroProject
    ) => {
      if (locked) {
        return
      }

      setActionId(
        `delete:${project.id}`
      )

      try {
        await editor.deleteProject(
          project.id
        )
      } finally {
        setActionId(
          null
        )
      }
    }

  const createFromPreset =
    async (
      presetId:
        string
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
                  Abra ou faça a gestão
                  dos projetos guardados
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
                  <article
                    key={
                      project.id
                    }
                    className="mq-home-project-shell"
                  >
                    <button
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

                    <ProjectActionsMenu
                      project={
                        project
                      }
                      locked={
                        locked
                      }
                      onOpen={() =>
                        void openProject(
                          project.id
                        )
                      }
                      onDuplicate={() =>
                        void duplicateProject(
                          project
                        )
                      }
                      onRename={() =>
                        beginRename(
                          project
                        )
                      }
                      onSaveAsTemplate={() =>
                        void saveAsTemplate(
                          project
                        )
                      }
                      onDelete={() =>
                        void deleteProject(
                          project
                        )
                      }
                    />
                  </article>
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

      {renameProject ? (
        <div
          className="mq-home-project-modal-backdrop"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeRename()
            }
          }}
        >
          <section
            className="mq-home-project-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mq-home-project-rename-title"
          >
            <div className="mq-home-project-modal__heading">
              <span>
                <h2 id="mq-home-project-rename-title">
                  Renomear projeto
                </h2>

                <p>
                  Escolha um novo nome
                  para este design.
                </p>
              </span>

              <button
                type="button"
                disabled={
                  actionId?.startsWith(
                    'rename:'
                  )
                }
                aria-label="Fechar"
                onClick={
                  closeRename
                }
              >
                ×
              </button>
            </div>

            <label className="mq-home-project-modal__field">
              <span>
                Nome
              </span>

              <input
                autoFocus
                type="text"
                value={
                  renameDraft
                }
                maxLength={180}
                disabled={
                  actionId?.startsWith(
                    'rename:'
                  )
                }
                onChange={(event) => {
                  setRenameDraft(
                    event.target.value
                  )

                  setRenameError(
                    ''
                  )
                }}
                onKeyDown={(event) => {
                  if (
                    event.key ===
                    'Enter'
                  ) {
                    event.preventDefault()

                    void commitRename()
                  }

                  if (
                    event.key ===
                    'Escape'
                  ) {
                    event.preventDefault()

                    closeRename()
                  }
                }}
              />
            </label>

            {renameError ? (
              <p
                className="mq-home-project-modal__error"
                role="alert"
              >
                {renameError}
              </p>
            ) : null}

            <div className="mq-home-project-modal__actions">
              <button
                type="button"
                className="is-secondary"
                disabled={
                  actionId?.startsWith(
                    'rename:'
                  )
                }
                onClick={
                  closeRename
                }
              >
                Cancelar
              </button>

              <button
                type="button"
                className="is-primary"
                disabled={
                  actionId?.startsWith(
                    'rename:'
                  ) ||
                  !renameDraft.trim()
                }
                onClick={() =>
                  void commitRename()
                }
              >
                {actionId?.startsWith(
                  'rename:'
                )
                  ? 'A guardar…'
                  : 'Guardar nome'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  )
}
