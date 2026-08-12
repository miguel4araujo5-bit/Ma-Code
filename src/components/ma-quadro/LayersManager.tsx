import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent
} from 'react'

import {
  createPortal
} from 'react-dom'

import type {
  MAQuadroLayerItem
} from './editorTypes'

import {
  useMAQuadroEditorContext
} from './editorContext'

type LayerView =
  | 'all'
  | 'visible'
  | 'hidden'
  | 'locked'

const layerTypeLabels: Record<string, string> = {
  text: 'Texto',
  image: 'Imagem',
  shape: 'Forma',
  line: 'Linha',
  arrow: 'Seta',
  drawing: 'Desenho',
  group: 'Grupo',
  table: 'Tabela',
  chart: 'Gráfico',
  qrcode: 'QR Code'
}

const layerTypeIcons: Record<string, string> = {
  text: 'T',
  image: '▧',
  shape: '◇',
  line: '─',
  arrow: '→',
  drawing: '✎',
  group: '▦',
  table: '▤',
  chart: '▥',
  qrcode: '▩'
}

function normalizeSearch(
  value: string
) {
  return value
    .trim()
    .toLocaleLowerCase('pt-PT')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function getLayerTypeLabelFromType(
  type: string
) {
  return (
    layerTypeLabels[type] ||
    type ||
    'Elemento'
  )
}

function getLayerTypeLabel(
  layer: MAQuadroLayerItem
) {
  return getLayerTypeLabelFromType(
    layer.type
  )
}

function getLayerTypeIcon(
  layer: MAQuadroLayerItem
) {
  return (
    layerTypeIcons[layer.type] ||
    layer.type
      .slice(0, 1)
      .toUpperCase() ||
    '•'
  )
}

function findLayersList() {
  const lists =
    document.querySelectorAll<HTMLElement>(
      '.mq-properties-panel .mq-layer-list'
    )

  return lists.length > 0
    ? lists[lists.length - 1]
    : null
}

export default function LayersManager() {
  const editor =
    useMAQuadroEditorContext()

  const [host, setHost] =
    useState<HTMLElement | null>(null)

  const [search, setSearch] =
    useState('')

  const [view, setView] =
    useState<LayerView>('all')

  const [typeFilter, setTypeFilter] =
    useState('all')

  const [editingId, setEditingId] =
    useState<string | null>(null)

  const [renameDraft, setRenameDraft] =
    useState('')

  const [message, setMessage] =
    useState('')

  const skipRenameCommitRef =
    useRef(false)

  useLayoutEffect(() => {
    if (!editor.ready) {
      setHost(null)
      return
    }

    let currentList:
      | HTMLElement
      | null
      | undefined

    let mount:
      | HTMLDivElement
      | null = null

    const syncHost = () => {
      const list =
        findLayersList()

      if (
        list === currentList &&
        (
          (
            list === null &&
            mount === null
          ) ||
          Boolean(
            mount?.isConnected
          )
        )
      ) {
        return
      }

      if (mount) {
        mount.remove()
        mount = null
      }

      currentList = list

      if (!list) {
        setHost(null)
        return
      }

      const nextMount =
        document.createElement('div')

      nextMount.className =
        'mq-layers-manager-host'

      list.insertAdjacentElement(
        'beforebegin',
        nextMount
      )

      mount = nextMount

      setHost(nextMount)
    }

    syncHost()

    const propertiesPanel =
      document.querySelector<HTMLElement>(
        '.mq-properties-panel'
      )

    if (!propertiesPanel) {
      return () => {
        mount?.remove()
      }
    }

    const observer =
      new MutationObserver(
        syncHost
      )

    observer.observe(
      propertiesPanel,
      {
        childList: true,
        subtree: true
      }
    )

    return () => {
      observer.disconnect()

      if (mount) {
        mount.remove()
      }
    }
  }, [
    editor.activePage?.id,
    editor.ready
  ])

  const locked =
    editor.busy ||
    editor.structureBusy ||
    editor.imageCropEditing

  const typeOptions =
    useMemo(() => {
      const values =
        Array.from(
          new Set(
            editor.layers
              .map((layer) => layer.type)
              .filter(Boolean)
          )
        )

      return values.sort((first, second) =>
        getLayerTypeLabelFromType(
          first
        ).localeCompare(
          getLayerTypeLabelFromType(
            second
          ),
          'pt-PT'
        )
      )
    }, [editor.layers])

  const counts =
    useMemo(() => ({
      all: editor.layers.length,
      visible: editor.layers.filter(
        (layer) => layer.visible
      ).length,
      hidden: editor.layers.filter(
        (layer) => !layer.visible
      ).length,
      locked: editor.layers.filter(
        (layer) => layer.locked
      ).length
    }), [editor.layers])

  const filteredLayers =
    useMemo(() => {
      const query =
        normalizeSearch(search)

      return editor.layers.filter(
        (layer) => {
          if (
            view === 'visible' &&
            !layer.visible
          ) {
            return false
          }

          if (
            view === 'hidden' &&
            layer.visible
          ) {
            return false
          }

          if (
            view === 'locked' &&
            !layer.locked
          ) {
            return false
          }

          if (
            typeFilter !== 'all' &&
            layer.type !== typeFilter
          ) {
            return false
          }

          if (!query) {
            return true
          }

          return normalizeSearch(
            [
              layer.name,
              layer.type,
              getLayerTypeLabel(layer)
            ].join(' ')
          ).includes(query)
        }
      )
    }, [
      editor.layers,
      search,
      typeFilter,
      view
    ])

  if (!host) {
    return null
  }

  const clearFilters = () => {
    setSearch('')
    setView('all')
    setTypeFilter('all')
    setMessage('')
  }

  const startRename = (
    layer: MAQuadroLayerItem
  ) => {
    if (locked) {
      return
    }

    if (!layer.visible) {
      setMessage(
        'Mostre a camada antes de a renomear.'
      )
      return
    }

    if (layer.locked) {
      setMessage(
        'Desbloqueie a camada antes de a renomear.'
      )
      return
    }

    editor.selectLayer(layer.id)

    skipRenameCommitRef.current = false

    setEditingId(layer.id)
    setRenameDraft(layer.name)
    setMessage('')
  }

  const cancelRename = () => {
    skipRenameCommitRef.current = true
    setEditingId(null)
    setRenameDraft('')
  }

  const commitRename = (
    layer: MAQuadroLayerItem
  ) => {
    if (skipRenameCommitRef.current) {
      skipRenameCommitRef.current = false
      return
    }

    const next = renameDraft.trim()

    if (!next) {
      setMessage(
        'O nome da camada não pode ficar vazio.'
      )
      return
    }

    if (next !== layer.name) {
      editor.selectLayer(layer.id)
      editor.setSelectionName(next)
    }

    setEditingId(null)
    setRenameDraft('')
    setMessage('')
  }

  const handleRenameKeyDown = (
    event: KeyboardEvent<HTMLInputElement>,
    layer: MAQuadroLayerItem
  ) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      commitRename(layer)
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      cancelRename()
    }
  }

  return createPortal(
    <section
      className="mq-layers-manager"
      aria-label="Gestor de camadas"
    >
      <div className="mq-layers-manager__summary">
        <span>
          <strong>
            Ordem visual
          </strong>

          <small>
            O topo da lista fica à frente no design.
          </small>
        </span>

        <span className="mq-layers-manager__count">
          {editor.layers.length}
        </span>
      </div>

      <label className="mq-layers-manager__search">
        <span aria-hidden="true">
          ⌕
        </span>

        <input
          type="search"
          value={search}
          disabled={locked}
          aria-label="Pesquisar camadas"
          placeholder="Pesquisar camadas…"
          onChange={(event) => {
            setSearch(event.target.value)
            setMessage('')
          }}
        />

        {search ? (
          <button
            type="button"
            disabled={locked}
            aria-label="Limpar pesquisa"
            title="Limpar pesquisa"
            onClick={() => setSearch('')}
          >
            ×
          </button>
        ) : null}
      </label>

      <div
        className="mq-layers-manager__views"
        aria-label="Filtrar camadas"
      >
        {([
          ['all', 'Todas', counts.all],
          [
            'visible',
            'Visíveis',
            counts.visible
          ],
          [
            'hidden',
            'Ocultas',
            counts.hidden
          ],
          [
            'locked',
            'Bloqueadas',
            counts.locked
          ]
        ] as const).map(
          ([id, label, count]) => (
            <button
              key={id}
              type="button"
              className={
                view === id
                  ? 'is-active'
                  : ''
              }
              disabled={locked}
              aria-pressed={view === id}
              onClick={() => setView(id)}
            >
              <span>
                {label}
              </span>

              <small>
                {count}
              </small>
            </button>
          )
        )}
      </div>

      {typeOptions.length > 1 ? (
        <label className="mq-layers-manager__type-filter">
          <span>
            Tipo
          </span>

          <select
            value={typeFilter}
            disabled={locked}
            onChange={(event) =>
              setTypeFilter(
                event.target.value
              )
            }
          >
            <option value="all">
              Todos os tipos
            </option>

            {typeOptions.map((type) => (
              <option
                key={type}
                value={type}
              >
                {getLayerTypeLabelFromType(
                  type
                )}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <div className="mq-layers-manager__list">
        {filteredLayers.map((layer) => {
          const originalIndex =
            editor.layers.findIndex(
              (item) =>
                item.id === layer.id
            )

          const isFirst =
            originalIndex === 0

          const isLast =
            originalIndex ===
            editor.layers.length - 1

          const editing =
            editingId === layer.id

          return (
            <article
              key={layer.id}
              className={`mq-layers-manager__row${
                layer.active
                  ? ' is-active'
                  : ''
              }${
                !layer.visible
                  ? ' is-hidden'
                  : ''
              }${
                layer.locked
                  ? ' is-locked'
                  : ''
              }`}
            >
              <div className="mq-layers-manager__main">
                <span className="mq-layers-manager__icon">
                  {getLayerTypeIcon(
                    layer
                  )}
                </span>

                <span className="mq-layers-manager__copy">
                  {editing ? (
                    <input
                      autoFocus
                      type="text"
                      value={renameDraft}
                      maxLength={180}
                      aria-label={`Renomear ${layer.name}`}
                      onChange={(event) =>
                        setRenameDraft(
                          event.target.value
                        )
                      }
                      onBlur={() =>
                        commitRename(
                          layer
                        )
                      }
                      onKeyDown={(event) =>
                        handleRenameKeyDown(
                          event,
                          layer
                        )
                      }
                    />
                  ) : (
                    <button
                      type="button"
                      className="mq-layers-manager__select"
                      disabled={
                        locked ||
                        layer.locked ||
                        !layer.visible
                      }
                      title={
                        layer.locked
                          ? 'Desbloqueie para selecionar'
                          : !layer.visible
                            ? 'Mostre para selecionar'
                            : `Selecionar ${layer.name}`
                      }
                      onClick={() => {
                        editor.selectLayer(
                          layer.id
                        )
                        setMessage('')
                      }}
                    >
                      <strong>
                        {layer.name}
                      </strong>
                    </button>
                  )}

                  <small>
                    {getLayerTypeLabel(
                      layer
                    )}
                    {!layer.visible
                      ? ' · Oculta'
                      : ''}
                    {layer.locked
                      ? ' · Bloqueada'
                      : ''}
                  </small>
                </span>
              </div>

              <div className="mq-layers-manager__actions">
                <button
                  type="button"
                  disabled={
                    locked ||
                    isFirst
                  }
                  aria-label={`Subir ${layer.name}`}
                  title="Subir uma posição"
                  onClick={() =>
                    editor.moveLayer(
                      layer.id,
                      'up'
                    )
                  }
                >
                  ↑
                </button>

                <button
                  type="button"
                  disabled={
                    locked ||
                    isLast
                  }
                  aria-label={`Descer ${layer.name}`}
                  title="Descer uma posição"
                  onClick={() =>
                    editor.moveLayer(
                      layer.id,
                      'down'
                    )
                  }
                >
                  ↓
                </button>

                <button
                  type="button"
                  disabled={locked}
                  className={
                    !layer.visible
                      ? 'is-active'
                      : ''
                  }
                  aria-label={`${
                    layer.visible
                      ? 'Ocultar'
                      : 'Mostrar'
                  } ${layer.name}`}
                  title={
                    layer.visible
                      ? 'Ocultar camada'
                      : 'Mostrar camada'
                  }
                  onClick={() => {
                    editor.toggleLayerVisibility(
                      layer.id
                    )
                    setMessage('')
                  }}
                >
                  {layer.visible
                    ? '◉'
                    : '○'}
                </button>

                <button
                  type="button"
                  disabled={locked}
                  className={
                    layer.locked
                      ? 'is-active'
                      : ''
                  }
                  aria-label={`${
                    layer.locked
                      ? 'Desbloquear'
                      : 'Bloquear'
                  } ${layer.name}`}
                  title={
                    layer.locked
                      ? 'Desbloquear camada'
                      : 'Bloquear camada'
                  }
                  onClick={() => {
                    editor.toggleLayerLock(
                      layer.id
                    )
                    setMessage('')
                  }}
                >
                  {layer.locked
                    ? '🔒'
                    : '🔓'}
                </button>

                <button
                  type="button"
                  disabled={
                    locked ||
                    layer.locked ||
                    !layer.visible
                  }
                  aria-label={`Renomear ${layer.name}`}
                  title="Renomear camada"
                  onClick={() =>
                    startRename(
                      layer
                    )
                  }
                >
                  ✎
                </button>
              </div>
            </article>
          )
        })}
      </div>

      {filteredLayers.length === 0 ? (
        <div className="mq-layers-manager__empty">
          <strong>
            {editor.layers.length === 0
              ? 'Esta página ainda não tem elementos.'
              : 'Nenhuma camada corresponde aos filtros.'}
          </strong>

          {editor.layers.length > 0 ? (
            <>
              <span>
                Ajuste a pesquisa, o estado ou o tipo de camada.
              </span>

              <button
                type="button"
                disabled={locked}
                onClick={
                  clearFilters
                }
              >
                Limpar filtros
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      {message ? (
        <p
          className="mq-layers-manager__message"
          role="status"
        >
          {message}
        </p>
      ) : null}
    </section>,
    host
  )
}
