import {
  useCallback,
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

import type {
  MAQuadroProjectFolder,
  MAQuadroProjectFolderCollection
} from '../../lib/maQuadro/projectFolders'

import {
  MA_QUADRO_PROJECT_FOLDERS_STORAGE_KEY,
  MA_QUADRO_UNFILED_FOLDER_ID,
  createMAQuadroProjectFolderId,
  hasMAQuadroProjectFolderName,
  normalizeMAQuadroProjectFolderName,
  readMAQuadroProjectFolderCollection,
  writeMAQuadroProjectFolderCollection
} from '../../lib/maQuadro/projectFolders'

import {
  useMAQuadroEditorContext
} from './editorContext'

import ProjectFoldersPanel, {
  type MAQuadroProjectFolderActionResult
} from './ProjectFoldersPanel'

import './maQuadroHome.css'
import './maQuadroHomeProjects.css'
import './maQuadroHomeFilters.css'
import './maQuadroHomeFavourites.css'

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

type HomeViewFilter =
  | 'recent'
  | 'favourites'
  | 'all'
  | 'templates'

type FavouriteCollection = {
  templates: string[]
  projects: string[]
}

const FAVOURITES_STORAGE_KEY =
  'ma-quadro-favourites-v1'

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

function readFavouriteCollection():
  FavouriteCollection {
  if (
    typeof window ===
    'undefined'
  ) {
    return {
      templates: [],
      projects: []
    }
  }

  try {
    const raw =
      window.localStorage.getItem(
        FAVOURITES_STORAGE_KEY
      )

    if (!raw) {
      return {
        templates: [],
        projects: []
      }
    }

    const parsed =
      JSON.parse(
        raw
      ) as
        Partial<
          FavouriteCollection
        >

    return {
      templates:
        Array.isArray(
          parsed.templates
        )
          ? parsed.templates.filter(
              (
                value
              ): value is string =>
                typeof value ===
                'string'
            )
          : [],

      projects:
        Array.isArray(
          parsed.projects
        )
          ? parsed.projects.filter(
              (
                value
              ): value is string =>
                typeof value ===
                'string'
            )
          : []
    }
  } catch {
    return {
      templates: [],
      projects: []
    }
  }
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

function HomeFavouriteButton({
  active,
  disabled,
  label,
  onClick
}: {
  active: boolean
  disabled: boolean
  label: string
  onClick:
    () => void
}) {
  return (
    <button
      type="button"
      className={`mq-home-favourite${
        active
          ? ' is-active'
          : ''
      }`}
      disabled={disabled}
      aria-pressed={active}
      aria-label={
        active
          ? `Remover ${label} dos favoritos`
          : `Adicionar ${label} aos favoritos`
      }
      title={
        active
          ? 'Remover dos favoritos'
          : 'Adicionar aos favoritos'
      }
      onClick={
        onClick
      }
    >
      {active
        ? '★'
        : '☆'}
    </button>
  )
}

function ProjectActionsMenu({
  project,
  folders,
  folderId,
  locked,
  onOpen,
  onDuplicate,
  onRename,
  onSaveAsTemplate,
  onMove,
  onDelete
}: {
  project:
    MAQuadroProject
  folders:
    MAQuadroProjectFolder[]
  folderId:
    string |
    null
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
  onMove:
    (
      folderId:
        string |
        null
    ) => void
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

        <label className="mq-home-project-actions__folder">
          <span>
            Pasta
          </span>

          <select
            value={
              folderId || ''
            }
            disabled={locked}
            aria-label={`Pasta de ${project.name}`}
            onChange={(event) => {
              const nextFolderId =
                event.target.value ||
                null

              if (
                detailsRef.current
              ) {
                detailsRef.current.open =
                  false
              }

              onMove(
                nextFolderId
              )
            }}
          >
            <option value="">
              Sem pasta
            </option>

            {folders.map(
              (folder) => (
                <option
                  key={folder.id}
                  value={folder.id}
                >
                  {folder.name}
                </option>
              )
            )}
          </select>
        </label>

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
    viewFilter,
    setViewFilter
  ] = useState<HomeViewFilter>(
    'recent'
  )

  const [
    favourites,
    setFavourites
  ] = useState<FavouriteCollection>(
    () =>
      readFavouriteCollection()
  )

  const [
    favouritesChanged,
    setFavouritesChanged
  ] = useState(
    false
  )

  const [
    folderCollection,
    setFolderCollection
  ] = useState<MAQuadroProjectFolderCollection>(
    () =>
      readMAQuadroProjectFolderCollection()
  )

  const [
    selectedFolderId,
    setSelectedFolderId
  ] = useState<
    string |
    null
  >(null)

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

  const favouriteProjectIds =
    useMemo(
      () =>
        new Set(
          favourites.projects
        ),
      [
        favourites.projects
      ]
    )

  const favouriteTemplateIds =
    useMemo(
      () =>
        new Set(
          favourites.templates
        ),
      [
        favourites.templates
      ]
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

  const folders =
    useMemo(
      () =>
        [...folderCollection.folders]
          .sort(
            (
              first,
              second
            ) =>
              first.name.localeCompare(
                second.name,
                'pt-PT',
                {
                  sensitivity: 'base'
                }
              )
          ),
      [
        folderCollection.folders
      ]
    )

  const folderById =
    useMemo(
      () =>
        new Map(
          folders.map(
            (folder) => [
              folder.id,
              folder
            ]
          )
        ),
      [folders]
    )

  const projectCountsByFolder =
    useMemo(
      () => {
        const counts:
          Record<string, number> = {}

        for (
          const project of projects
        ) {
          const folderId =
            folderCollection
              .projectFolderIds[
                project.id
              ]

          if (
            folderId &&
            folderById.has(
              folderId
            )
          ) {
            counts[folderId] =
              (counts[folderId] || 0) +
              1
          }
        }

        return counts
      },
      [
        folderById,
        folderCollection.projectFolderIds,
        projects
      ]
    )

  const unfiledProjectCount =
    useMemo(
      () =>
        projects.filter(
          (project) => {
            const folderId =
              folderCollection
                .projectFolderIds[
                  project.id
                ]

            return (
              !folderId ||
              !folderById.has(
                folderId
              )
            )
          }
        ).length,
      [
        folderById,
        folderCollection.projectFolderIds,
        projects
      ]
    )

  const selectedFolder =
    selectedFolderId &&
    selectedFolderId !==
      MA_QUADRO_UNFILED_FOLDER_ID
      ? folderById.get(
          selectedFolderId
        ) || null
      : null

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

  const favouriteProjectCount =
    useMemo(
      () =>
        projects.filter(
          (project) =>
            favouriteProjectIds.has(
              project.id
            )
        ).length,
      [
        favouriteProjectIds,
        projects
      ]
    )

  const favouriteTemplateCount =
    useMemo(
      () =>
        templates.filter(
          (template) =>
            favouriteTemplateIds.has(
              template.id
            )
        ).length,
      [
        favouriteTemplateIds,
        templates
      ]
    )

  const favouriteCount =
    favouriteProjectCount +
    favouriteTemplateCount

  const filteredProjects =
    useMemo(
      () => {
        if (
          viewFilter ===
          'templates'
        ) {
          return []
        }

        let filtered =
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
                      ],
                      folderById.get(
                        folderCollection
                          .projectFolderIds[
                            project.id
                          ] || ''
                      )?.name || ''
                    ].join(
                      ' '
                    )
                  ).includes(
                    query
                  )
              )
            : projects

        if (
          viewFilter ===
          'favourites'
        ) {
          filtered =
            filtered.filter(
              (project) =>
                favouriteProjectIds.has(
                  project.id
                )
            )
        }

        if (
          viewFilter === 'all' &&
          selectedFolderId
        ) {
          filtered =
            filtered.filter(
              (project) => {
                const folderId =
                  folderCollection
                    .projectFolderIds[
                      project.id
                    ]

                if (
                  selectedFolderId ===
                  MA_QUADRO_UNFILED_FOLDER_ID
                ) {
                  return (
                    !folderId ||
                    !folderById.has(
                      folderId
                    )
                  )
                }

                return (
                  folderId ===
                  selectedFolderId
                )
              }
            )
        }

        if (
          viewFilter ===
          'recent'
        ) {
          return filtered.slice(
            0,
            6
          )
        }

        return filtered
      },
      [
        favouriteProjectIds,
        folderById,
        folderCollection.projectFolderIds,
        projects,
        query,
        selectedFolderId,
        viewFilter
      ]
    )

  const filteredTemplates =
    useMemo(
      () => {
        if (
          viewFilter !==
            'templates' &&
          viewFilter !==
            'favourites'
        ) {
          return []
        }

        let filtered =
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

        if (
          viewFilter ===
          'favourites'
        ) {
          filtered =
            filtered.filter(
              (template) =>
                favouriteTemplateIds.has(
                  template.id
                )
            )
        }

        return filtered
      },
      [
        favouriteTemplateIds,
        query,
        templates,
        viewFilter
      ]
    )

  const matchingPresets =
    useMemo(
      () => {
        if (
          viewFilter ===
            'templates' ||
          viewFilter ===
            'favourites' ||
          (
            viewFilter === 'all' &&
            selectedFolderId !== null
          )
        ) {
          return []
        }

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
        query,
        selectedFolderId,
        viewFilter
      ]
    )

  const enterEditor =
    useCallback(
      () => {
        if (
          !favouritesChanged
        ) {
          onEnterEditor()

          return
        }

        const activePanel =
          editor.activePanel

        const temporaryPanel =
          activePanel ===
          'projects'
            ? 'templates'
            : 'projects'

        setFavouritesChanged(
          false
        )

        editor.setActivePanel(
          temporaryPanel
        )

        window.requestAnimationFrame(
          () => {
            editor.setActivePanel(
              activePanel
            )

            onEnterEditor()
          }
        )
      },
      [
        editor.activePanel,
        editor.setActivePanel,
        favouritesChanged,
        onEnterEditor
      ]
    )

  useEffect(() => {
    const handleStorage = (
      event:
        StorageEvent
    ) => {
      if (
        event.key &&
        event.key !==
          FAVOURITES_STORAGE_KEY
      ) {
        return
      }

      setFavourites(
        readFavouriteCollection()
      )
    }

    window.addEventListener(
      'storage',
      handleStorage
    )

    return () => {
      window.removeEventListener(
        'storage',
        handleStorage
      )
    }
  }, [])

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
      enterEditor()
    }

    setWaitingForCustom(
      false
    )
  }, [
    editor.newDesignOpen,
    editor.project?.id,
    enterEditor,
    waitingForCustom
  ])

  useEffect(() => {
    const handleStorage = (
      event:
        StorageEvent
    ) => {
      if (
        event.key &&
        event.key !==
          MA_QUADRO_PROJECT_FOLDERS_STORAGE_KEY
      ) {
        return
      }

      setFolderCollection(
        readMAQuadroProjectFolderCollection()
      )
    }

    window.addEventListener(
      'storage',
      handleStorage
    )

    return () => {
      window.removeEventListener(
        'storage',
        handleStorage
      )
    }
  }, [])

  useEffect(() => {
    if (
      !selectedFolderId ||
      selectedFolderId ===
        MA_QUADRO_UNFILED_FOLDER_ID ||
      folderById.has(
        selectedFolderId
      )
    ) {
      return
    }

    setSelectedFolderId(
      null
    )
  }, [
    folderById,
    selectedFolderId
  ])

  const saveFolderCollection =
    useCallback(
      (
        next:
          MAQuadroProjectFolderCollection
      ) => {
        if (
          !writeMAQuadroProjectFolderCollection(
            next
          )
        ) {
          return false
        }

        setFolderCollection(
          next
        )

        return true
      },
      []
    )

  const createFolder =
    (
      rawName:
        string
    ):
      MAQuadroProjectFolderActionResult => {
      const name =
        normalizeMAQuadroProjectFolderName(
          rawName
        )

      if (!name) {
        return {
          ok: false,
          message:
            'Introduza um nome para a pasta.'
        }
      }

      if (
        hasMAQuadroProjectFolderName(
          folders,
          name
        )
      ) {
        return {
          ok: false,
          message:
            'Já existe uma pasta com esse nome.'
        }
      }

      const now =
        new Date().toISOString()

      const folder:
        MAQuadroProjectFolder = {
          id:
            createMAQuadroProjectFolderId(),
          name,
          createdAt: now,
          updatedAt: now
        }

      const next:
        MAQuadroProjectFolderCollection = {
          ...folderCollection,
          folders: [
            ...folderCollection.folders,
            folder
          ]
        }

      if (
        !saveFolderCollection(
          next
        )
      ) {
        return {
          ok: false,
          message:
            'O navegador não permitiu guardar a pasta.'
        }
      }

      setSelectedFolderId(
        folder.id
      )

      return {
        ok: true
      }
    }

  const renameFolder =
    (
      folderId:
        string,
      rawName:
        string
    ):
      MAQuadroProjectFolderActionResult => {
      const name =
        normalizeMAQuadroProjectFolderName(
          rawName
        )

      if (!name) {
        return {
          ok: false,
          message:
            'Introduza um nome para a pasta.'
        }
      }

      if (
        hasMAQuadroProjectFolderName(
          folders,
          name,
          folderId
        )
      ) {
        return {
          ok: false,
          message:
            'Já existe uma pasta com esse nome.'
        }
      }

      const folder =
        folderById.get(
          folderId
        )

      if (!folder) {
        return {
          ok: false,
          message:
            'A pasta já não existe.'
        }
      }

      if (
        folder.name === name
      ) {
        return {
          ok: true
        }
      }

      const next:
        MAQuadroProjectFolderCollection = {
          ...folderCollection,
          folders:
            folderCollection.folders.map(
              (item) =>
                item.id === folderId
                  ? {
                      ...item,
                      name,
                      updatedAt:
                        new Date().toISOString()
                    }
                  : item
            )
        }

      if (
        !saveFolderCollection(
          next
        )
      ) {
        return {
          ok: false,
          message:
            'O navegador não permitiu guardar o novo nome.'
        }
      }

      return {
        ok: true
      }
    }

  const deleteFolder =
    (
      folderId:
        string
    ) => {
      const projectFolderIds = {
        ...folderCollection.projectFolderIds
      }

      for (
        const [
          projectId,
          assignedFolderId
        ] of Object.entries(
          projectFolderIds
        )
      ) {
        if (
          assignedFolderId ===
          folderId
        ) {
          delete projectFolderIds[
            projectId
          ]
        }
      }

      const next:
        MAQuadroProjectFolderCollection = {
          ...folderCollection,
          folders:
            folderCollection.folders.filter(
              (folder) =>
                folder.id !==
                folderId
            ),
          projectFolderIds
        }

      if (
        !saveFolderCollection(
          next
        )
      ) {
        return
      }

      if (
        selectedFolderId ===
        folderId
      ) {
        setSelectedFolderId(
          MA_QUADRO_UNFILED_FOLDER_ID
        )
      }
    }

  const moveProjectToFolder =
    (
      projectId:
        string,
      folderId:
        string |
        null
    ) => {
      if (
        folderId &&
        !folderById.has(
          folderId
        )
      ) {
        return
      }

      const projectFolderIds = {
        ...folderCollection.projectFolderIds
      }

      if (folderId) {
        projectFolderIds[
          projectId
        ] = folderId
      } else {
        delete projectFolderIds[
          projectId
        ]
      }

      saveFolderCollection({
        ...folderCollection,
        projectFolderIds
      })
    }

  const toggleFavourite =
    (
      collection:
        keyof FavouriteCollection,
      id:
        string
    ) => {
      if (locked) {
        return
      }

      setFavouritesChanged(
        true
      )

      setFavourites(
        (current) => {
          const currentIds =
            current[
              collection
            ]

          const exists =
            currentIds.includes(
              id
            )

          const nextIds =
            exists
              ? currentIds.filter(
                  (
                    item
                  ) =>
                    item !== id
                )
              : [
                  id,
                  ...currentIds
                ]

          const next:
            FavouriteCollection = {
            ...current,
            [
              collection
            ]:
              nextIds
          }

          try {
            window.localStorage.setItem(
              FAVOURITES_STORAGE_KEY,
              JSON.stringify(
                next
              )
            )
          } catch {
            return next
          }

          return next
        }
      )
    }

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

        enterEditor()
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

        moveProjectToFolder(
          project.id,
          null
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

        enterEditor()
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

        enterEditor()
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

  const hasVisibleResults =
    viewFilter ===
      'templates'
      ? filteredTemplates.length >
        0
      : viewFilter ===
          'favourites'
        ? filteredProjects.length >
            0 ||
          filteredTemplates.length >
            0
        : filteredProjects.length >
            0 ||
          matchingPresets.length >
            0

  const projectsHeading =
    viewFilter ===
      'recent'
      ? query
        ? 'Projetos recentes encontrados'
        : 'Projetos recentes'
      : viewFilter ===
          'favourites'
        ? query
          ? 'Projetos favoritos encontrados'
          : 'Projetos favoritos'
        : selectedFolderId ===
            MA_QUADRO_UNFILED_FOLDER_ID
          ? query
            ? 'Resultados em Sem pasta'
            : 'Projetos sem pasta'
          : selectedFolder
            ? query
              ? `Resultados em ${selectedFolder.name}`
              : selectedFolder.name
            : query
              ? 'Projetos encontrados'
              : 'Todos os projetos'

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
              placeholder={
                viewFilter ===
                'templates'
                  ? 'Pesquisar modelos…'
                  : viewFilter ===
                      'favourites'
                    ? 'Pesquisar favoritos…'
                    : 'Pesquisar projetos e formatos…'
              }
              aria-label="Pesquisar na Home do MA-Quadro"
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

        <nav
          className="mq-home-filters mq-home-filters--with-favourites"
          aria-label="Filtrar conteúdos"
        >
          <button
            type="button"
            className={
              viewFilter ===
              'recent'
                ? 'is-active'
                : ''
            }
            aria-pressed={
              viewFilter ===
              'recent'
            }
            onClick={() =>
              setViewFilter(
                'recent'
              )
            }
          >
            <span>
              Recentes
            </span>

            <small>
              {Math.min(
                projects.length,
                6
              )}
            </small>
          </button>

          <button
            type="button"
            className={
              viewFilter ===
              'favourites'
                ? 'is-active'
                : ''
            }
            aria-pressed={
              viewFilter ===
              'favourites'
            }
            onClick={() =>
              setViewFilter(
                'favourites'
              )
            }
          >
            <span>
              ★ Favoritos
            </span>

            <small>
              {favouriteCount}
            </small>
          </button>

          <button
            type="button"
            className={
              viewFilter ===
              'all'
                ? 'is-active'
                : ''
            }
            aria-pressed={
              viewFilter ===
              'all'
            }
            onClick={() =>
              setViewFilter(
                'all'
              )
            }
          >
            <span>
              Todos
            </span>

            <small>
              {projects.length}
            </small>
          </button>

          <button
            type="button"
            className={
              viewFilter ===
              'templates'
                ? 'is-active'
                : ''
            }
            aria-pressed={
              viewFilter ===
              'templates'
            }
            onClick={() =>
              setViewFilter(
                'templates'
              )
            }
          >
            <span>
              Modelos
            </span>

            <small>
              {templates.length}
            </small>
          </button>
        </nav>

        {viewFilter === 'all' ? (
          <ProjectFoldersPanel
            folders={folders}
            projectCounts={
              projectCountsByFolder
            }
            totalCount={
              projects.length
            }
            unfiledCount={
              unfiledProjectCount
            }
            selectedFolderId={
              selectedFolderId
            }
            locked={locked}
            onSelect={
              setSelectedFolderId
            }
            onCreate={
              createFolder
            }
            onRename={
              renameFolder
            }
            onDelete={
              deleteFolder
            }
          />
        ) : null}

        {!query &&
        viewFilter ===
          'recent' &&
        continueProject ? (
          <section className="mq-home-continue">
            <button
              type="button"
              disabled={locked}
              onClick={
                enterEditor
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

        {viewFilter !==
          'templates' &&
        filteredProjects.length >
          0 ? (
          <section className="mq-home-section">
            <div className="mq-home-section__heading">
              <span>
                <h2>
                  {projectsHeading}
                </h2>

                <p>
                  {viewFilter ===
                  'favourites'
                    ? 'Projetos que marcou para acesso rápido.'
                    : selectedFolderId
                      ? 'Abra os projetos desta pasta ou altere a organização no menu de ações.'
                      : 'Abra ou faça a gestão dos projetos guardados neste dispositivo.'}
                </p>
              </span>

              {!query &&
              viewFilter ===
                'recent' &&
              projects.length > 6 ? (
                <button
                  type="button"
                  disabled={locked}
                  onClick={() =>
                    setViewFilter(
                      'all'
                    )
                  }
                >
                  Ver todos
                </button>
              ) : null}
            </div>

            <div className="mq-home-project-grid">
              {filteredProjects.map(
                (
                  project
                ) => {
                  const folder =
                    folderById.get(
                      folderCollection
                        .projectFolderIds[
                          project.id
                        ] || ''
                    ) || null

                  return (
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

                        {folder ? (
                          <span className="mq-home-project__folder-label">
                            ▰ {folder.name}
                          </span>
                        ) : null}
                      </span>
                    </button>

                    <HomeFavouriteButton
                      active={
                        favouriteProjectIds.has(
                          project.id
                        )
                      }
                      disabled={locked}
                      label={
                        project.name
                      }
                      onClick={() =>
                        toggleFavourite(
                          'projects',
                          project.id
                        )
                      }
                    />

                    <ProjectActionsMenu
                      project={
                        project
                      }
                      folders={
                        folders
                      }
                      folderId={
                        folder?.id ||
                        null
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
                      onMove={(
                        folderId
                      ) =>
                        moveProjectToFolder(
                          project.id,
                          folderId
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
                }
              )}
            </div>
          </section>
        ) : null}

        {(viewFilter ===
          'templates' ||
          viewFilter ===
            'favourites') &&
        filteredTemplates.length >
          0 ? (
          <section className="mq-home-section mq-home-section--templates">
            <div className="mq-home-section__heading">
              <span>
                <h2>
                  {viewFilter ===
                  'favourites'
                    ? query
                      ? 'Modelos favoritos encontrados'
                      : 'Modelos favoritos'
                    : query
                      ? 'Modelos encontrados'
                      : 'Modelos'}
                </h2>

                <p>
                  {viewFilter ===
                  'favourites'
                    ? 'Modelos que marcou para encontrar rapidamente.'
                    : 'Utilize um modelo existente sem alterar o original.'}
                </p>
              </span>
            </div>

            <div className="mq-home-template-grid">
              {filteredTemplates.map(
                (
                  template
                ) => (
                  <article
                    key={
                      template.id
                    }
                    className="mq-home-template-shell"
                  >
                    <button
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

                    <HomeFavouriteButton
                      active={
                        favouriteTemplateIds.has(
                          template.id
                        )
                      }
                      disabled={locked}
                      label={
                        template.name
                      }
                      onClick={() =>
                        toggleFavourite(
                          'templates',
                          template.id
                        )
                      }
                    />
                  </article>
                )
              )}
            </div>
          </section>
        ) : null}

        {!hasVisibleResults ? (
          <section className="mq-home-empty">
            <strong>
              {viewFilter ===
              'favourites'
                ? query
                  ? 'Nenhum favorito encontrado.'
                  : 'Ainda não tem favoritos.'
                : viewFilter ===
                    'templates'
                  ? query
                    ? 'Nenhum modelo encontrado.'
                    : 'Ainda não existem modelos.'
                  : selectedFolderId
                    ? query
                      ? 'Nenhum projeto encontrado nesta pasta.'
                      : 'Esta pasta ainda está vazia.'
                    : query
                      ? 'Nenhum projeto encontrado.'
                      : 'Ainda não existem projetos nesta vista.'}
            </strong>

            <span>
              {query
                ? 'Experimente outro termo ou limpe a pesquisa.'
                : viewFilter ===
                    'favourites'
                  ? 'Utilize a estrela nos projetos e modelos que pretende encontrar mais rapidamente.'
                  : viewFilter ===
                      'templates'
                    ? 'Pode guardar um projeto como modelo a partir do menu de ações.'
                    : selectedFolderId
                      ? 'Abra Todos os projetos e utilize o menu de ações para os mover para esta pasta.'
                      : 'Crie um novo design para começar.'}
            </span>

            {query ? (
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
            ) : viewFilter ===
              'favourites' ? (
              <button
                type="button"
                onClick={() =>
                  setViewFilter(
                    'all'
                  )
                }
              >
                Ver todos os projetos
              </button>
            ) : viewFilter ===
              'templates' ? (
              <button
                type="button"
                onClick={() =>
                  setViewFilter(
                    'recent'
                  )
                }
              >
                Voltar aos recentes
              </button>
            ) : selectedFolderId ? (
              <button
                type="button"
                onClick={() =>
                  setSelectedFolderId(
                    null
                  )
                }
              >
                Ver todos os projetos
              </button>
            ) : (
              <button
                type="button"
                onClick={
                  openCustomDesign
                }
              >
                Criar design
              </button>
            )}
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
