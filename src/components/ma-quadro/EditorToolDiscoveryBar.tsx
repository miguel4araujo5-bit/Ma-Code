import {
  useCallback
} from 'react'

import type {
  MAQuadroPanelId
} from '../../types/maQuadro'

import {
  useMAQuadroEditorContext
} from './editorContext'

import ImageQuickActions from './ImageQuickActions'
import MagicResizeControl from './MagicResizeControl'
import TextDiscoveryPanel from './TextDiscoveryPanel'

type ToolSide =
  | 'left'
  | 'properties'

type DiscoveryTool = {
  id: string
  label: string
  icon: string
  panel?: MAQuadroPanelId
  selector?: string
  elementToolId?: string
  side?: ToolSide
  contextual?:
    | 'selection'
    | 'image'
  title: string
}

const primaryTools:
  DiscoveryTool[] = [
    {
      id: 'templates',
      label: 'Modelos',
      icon: '▦',
      panel: 'templates',
      title:
        'Abrir modelos'
    },
    {
      id: 'elements',
      label: 'Elementos',
      icon: '◇',
      panel: 'elements',
      title:
        'Abrir elementos'
    },
    {
      id: 'text',
      label: 'Texto',
      icon: 'T',
      panel: 'text',
      title:
        'Adicionar e editar texto'
    },
    {
      id: 'images',
      label: 'Imagens',
      icon: '▧',
      panel: 'uploads',
      title:
        'Carregar imagens'
    },
    {
      id: 'video',
      label: 'Vídeo',
      icon: '▶',
      panel: 'uploads',
      selector:
        '.mq-video-uploads-host',
      side: 'left',
      title:
        'Carregar e adicionar vídeo'
    },
    {
      id: 'tables',
      label: 'Tabelas',
      icon: '▦',
      panel: 'elements',
      selector:
        '.mq-table-builder-host',
      elementToolId:
        'table',
      side: 'left',
      title:
        'Criar tabela'
    },
    {
      id: 'charts',
      label: 'Gráficos',
      icon: '▥',
      panel: 'elements',
      selector:
        '.mq-chart-builder-host',
      elementToolId:
        'chart',
      side: 'left',
      title:
        'Criar gráfico'
    },
    {
      id: 'qr',
      label: 'QR',
      icon: '⌗',
      panel: 'elements',
      selector:
        '.mq-qr-builder-host',
      elementToolId:
        'qr',
      side: 'left',
      title:
        'Criar código QR'
    },
    {
      id: 'curved-text',
      label: 'Texto curvo',
      icon: '⌒',
      panel: 'elements',
      selector:
        '.mq-curved-text-builder-host',
      elementToolId:
        'curved-text',
      side: 'left',
      title:
        'Criar texto curvo'
    },
    {
      id: 'frames',
      label: 'Molduras',
      icon: '▣',
      panel: 'elements',
      selector:
        '.mq-frame-builder-host',
      elementToolId:
        'frame',
      side: 'left',
      title:
        'Adicionar molduras'
    },
    {
      id: 'library',
      label: 'Biblioteca',
      icon: '✦',
      panel: 'elements',
      selector:
        '.mq-element-library-host',
      elementToolId:
        'library',
      side: 'left',
      title:
        'Abrir biblioteca de elementos'
    },
    {
      id: 'brand',
      label: 'Marca',
      icon: '◉',
      panel: 'brand',
      title:
        'Abrir ferramentas de marca'
    },
    {
      id: 'projects',
      label: 'Projetos',
      icon: '▤',
      panel: 'projects',
      title:
        'Abrir projetos'
    }
  ]

const contextualTools:
  DiscoveryTool[] = [
    {
      id: 'layers',
      label: 'Camadas',
      icon: '≡',
      selector:
        '.mq-layers-manager-host',
      side:
        'properties',
      title:
        'Ir para camadas'
    },
    {
      id: 'animation',
      label: 'Animação',
      icon: '✧',
      selector:
        '.mq-animation-panel-host',
      side:
        'properties',
      contextual:
        'selection',
      title:
        'Animar o elemento selecionado'
    },
    {
      id: 'filters',
      label: 'Filtros',
      icon: '◐',
      selector:
        '.mq-image-presets-host',
      side:
        'properties',
      contextual:
        'image',
      title:
        'Aplicar filtros à imagem selecionada'
    }
  ]

function getScrollContainer(
  side:
    ToolSide |
    undefined
) {
  if (
    side ===
    'properties'
  ) {
    return document.querySelector<HTMLElement>(
      '.mq-properties-panel .mq-properties-panel__scroll'
    )
  }

  return document.querySelector<HTMLElement>(
    '.mq-left-panel .mq-left-panel__scroll'
  )
}

function revealTarget(
  tool:
    DiscoveryTool
) {
  if (
    !tool.selector
  ) {
    return
  }

  let attempts = 0

  const findTarget =
    () => {
      if (
        tool.elementToolId
      ) {
        const navigationButton =
          document.querySelector<HTMLButtonElement>(
            `[aria-controls="mq-element-tool-${tool.elementToolId}"]`
          )

        if (
          !navigationButton
        ) {
          attempts += 1

          if (
            attempts <
            30
          ) {
            window.requestAnimationFrame(
              findTarget
            )
          }

          return
        }

        if (
          navigationButton.getAttribute(
            'aria-pressed'
          ) !==
            'true' &&
          !navigationButton.disabled
        ) {
          navigationButton.click()

          attempts += 1

          window.requestAnimationFrame(
            findTarget
          )

          return
        }
      }

      const container =
        getScrollContainer(
          tool.side
        )

      const target =
        container?.querySelector<HTMLElement>(
          tool.selector ??
            ''
        ) ??
        document.querySelector<HTMLElement>(
          tool.selector ??
            ''
        )

      if (
        target &&
        !target.hidden
      ) {
        target.scrollIntoView({
          behavior:
            'smooth',
          block:
            'start',
          inline:
            'nearest'
        })

        target.classList.add(
          'mq-tool-discovery-target'
        )

        window.setTimeout(
          () => {
            target.classList.remove(
              'mq-tool-discovery-target'
            )
          },
          1000
        )

        return
      }

      attempts += 1

      if (
        attempts <
        30
      ) {
        window.requestAnimationFrame(
          findTarget
        )
      }
    }

  window.requestAnimationFrame(
    findTarget
  )
}

export default function EditorToolDiscoveryBar() {
  const editor =
    useMAQuadroEditorContext()

  const locked =
    !editor.ready ||
    editor.busy ||
    editor.structureBusy ||
    editor.imageCropEditing

  const isDisabled =
    useCallback(
      (
        tool:
          DiscoveryTool
      ) => {
        if (
          locked
        ) {
          return true
        }

        if (
          tool.contextual ===
          'selection'
        ) {
          return (
            editor.selection
              .count ===
            0
          )
        }

        if (
          tool.contextual ===
          'image'
        ) {
          return (
            editor.selection
              .count !==
              1 ||
            editor.selection
              .role !==
              'image'
          )
        }

        return false
      },
      [
        editor.selection
          .count,
        editor.selection
          .role,
        locked
      ]
    )

  const openTool =
    useCallback(
      (
        tool:
          DiscoveryTool
      ) => {
        if (
          isDisabled(
            tool
          )
        ) {
          return
        }

        if (
          tool.panel
        ) {
          editor.setActivePanel(
            tool.panel
          )
        }

        revealTarget(
          tool
        )
      },
      [
        editor,
        isDisabled
      ]
    )

  const renderTool = (
    tool:
      DiscoveryTool,
    contextual = false
  ) => {
    const disabled =
      isDisabled(
        tool
      )

    const active =
      Boolean(
        tool.panel &&
        !tool.selector &&
        editor.activePanel ===
          tool.panel
      )

    return (
      <button
        key={
          tool.id
        }
        type="button"
        className={`mq-tool-discovery__button${
          active
            ? ' is-active'
            : ''
        }${
          contextual
            ? ' is-contextual'
            : ''
        }`}
        disabled={
          disabled
        }
        aria-disabled={
          disabled
        }
        title={
          disabled &&
          tool.contextual ===
            'selection'
            ? 'Selecione primeiro um elemento.'
            : disabled &&
                tool.contextual ===
                  'image'
              ? 'Selecione primeiro uma imagem.'
              : tool.title
        }
        onClick={() =>
          openTool(
            tool
          )
        }
      >
        <span
          className="mq-tool-discovery__icon"
          aria-hidden="true"
        >
          {
            tool.icon
          }
        </span>

        <span>
          {
            tool.label
          }
        </span>
      </button>
    )
  }

  return (
    <>
      <ImageQuickActions />

      <TextDiscoveryPanel />

      <div
        className="mq-tool-discovery"
        role="toolbar"
        aria-label="Ferramentas rápidas"
      >
        <span className="mq-tool-discovery__label">
          Criar
        </span>

        <div className="mq-tool-discovery__scroller">
          {primaryTools.map(
            (tool) =>
              renderTool(
                tool
              )
          )}

          <MagicResizeControl />

          <span
            className="mq-tool-discovery__divider"
            aria-hidden="true"
          />

          {contextualTools.map(
            (tool) =>
              renderTool(
                tool,
                true
              )
          )}
        </div>
      </div>
    </>
  )
}
