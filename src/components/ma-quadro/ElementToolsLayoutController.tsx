import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react'

import {
  createPortal
} from 'react-dom'

import {
  useMAQuadroEditorContext
} from './editorContext'

import './maQuadroElementTools.css'

const TOOL_DEFINITIONS = [
  {
    id: 'library',
    icon: '◇',
    label: 'Biblioteca',
    selector: '.mq-element-library-host'
  },
  {
    id: 'frame',
    icon: '▣',
    label: 'Molduras',
    selector: '.mq-frame-builder-host'
  },
  {
    id: 'table',
    icon: '▤',
    label: 'Tabela',
    selector: '.mq-table-builder-host'
  },
  {
    id: 'chart',
    icon: '▥',
    label: 'Gráfico',
    selector: '.mq-chart-builder-host'
  },
  {
    id: 'qr',
    icon: '▩',
    label: 'QR Code',
    selector: '.mq-qr-builder-host'
  },
  {
    id: 'curved-text',
    icon: '⌒',
    label: 'Texto curvo',
    selector: '.mq-curved-text-builder-host'
  }
] as const

type ToolId =
  (typeof TOOL_DEFINITIONS)[number]['id']

const DEFAULT_TOOL_ID: ToolId =
  'library'

function sameToolIds(
  first: ToolId[],
  second: ToolId[]
) {
  return (
    first.length === second.length &&
    first.every(
      (value, index) =>
        value === second[index]
    )
  )
}

export default function ElementToolsLayoutController() {
  const editor =
    useMAQuadroEditorContext()

  const [
    navigationHost,
    setNavigationHost
  ] = useState<HTMLElement | null>(
    null
  )

  const [
    stack,
    setStack
  ] = useState<HTMLElement | null>(
    null
  )

  const [
    activeTool,
    setActiveTool
  ] = useState<ToolId | null>(
    null
  )

  const [
    availableTools,
    setAvailableTools
  ] = useState<ToolId[]>([])

  const activeToolRef =
    useRef<ToolId | null>(
      null
    )

  const userSelectedToolRef =
    useRef(false)

  useLayoutEffect(() => {
    if (
      !editor.ready ||
      editor.activePanel !== 'elements'
    ) {
      setNavigationHost(null)
      setStack(null)
      setAvailableTools([])
      setActiveTool(null)

      activeToolRef.current =
        null

      userSelectedToolRef.current =
        false

      return
    }

    const panelScroll =
      document.querySelector<HTMLElement>(
        '.mq-left-panel .mq-left-panel__scroll'
      )

    const elementGrid =
      panelScroll?.querySelector<HTMLElement>(
        '.mq-element-grid'
      ) ?? null

    if (
      !panelScroll ||
      !elementGrid
    ) {
      setNavigationHost(null)
      setStack(null)
      setAvailableTools([])

      return
    }

    const toolsStack =
      document.createElement('div')

    toolsStack.className =
      'mq-element-tools-stack'

    const navHost =
      document.createElement('div')

    navHost.className =
      'mq-element-tools-navigation-host'

    toolsStack.appendChild(navHost)

    elementGrid.insertAdjacentElement(
      'beforebegin',
      toolsStack
    )

    setNavigationHost(navHost)
    setStack(toolsStack)

    let scheduledFrame:
      number | null = null

    const synchronize = () => {
      scheduledFrame = null

      if (
        !toolsStack.isConnected ||
        !panelScroll.isConnected
      ) {
        return
      }

      const hosts =
        TOOL_DEFINITIONS.map(
          (tool) => ({
            tool,
            host:
              panelScroll.querySelector<HTMLElement>(
                tool.selector
              )
          })
        ).filter(
          (
            item
          ): item is {
            tool:
              (typeof TOOL_DEFINITIONS)[number]
            host: HTMLElement
          } => Boolean(item.host)
        )

      const nextAvailable =
        hosts.map(
          ({ tool }) => tool.id
        )

      let selected =
        activeToolRef.current

      if (
        !userSelectedToolRef.current &&
        nextAvailable.includes(
          DEFAULT_TOOL_ID
        )
      ) {
        selected =
          DEFAULT_TOOL_ID
      } else if (
        !selected ||
        !nextAvailable.includes(
          selected
        )
      ) {
        selected =
          nextAvailable[0] ?? null
      }

      if (
        selected !==
        activeToolRef.current
      ) {
        activeToolRef.current =
          selected

        setActiveTool(selected)
      }

      let previous:
        Element = navHost

      hosts.forEach(
        ({ tool, host }) => {
          host.dataset.mqElementTool =
            tool.id

          host.id =
            `mq-element-tool-${tool.id}`

          host.hidden =
            selected !== tool.id

          if (
            host.parentElement !==
              toolsStack ||
            host.previousElementSibling !==
              previous
          ) {
            previous.insertAdjacentElement(
              'afterend',
              host
            )
          }

          previous = host
        }
      )

      setAvailableTools(
        (current) =>
          sameToolIds(
            current,
            nextAvailable
          )
            ? current
            : nextAvailable
      )
    }

    const scheduleSynchronize = () => {
      if (
        scheduledFrame !== null
      ) {
        return
      }

      scheduledFrame =
        window.requestAnimationFrame(
          synchronize
        )
    }

    const observer =
      new MutationObserver(
        scheduleSynchronize
      )

    observer.observe(
      panelScroll,
      {
        childList: true
      }
    )

    observer.observe(
      toolsStack,
      {
        childList: true
      }
    )

    scheduleSynchronize()

    return () => {
      observer.disconnect()

      if (
        scheduledFrame !== null
      ) {
        window.cancelAnimationFrame(
          scheduledFrame
        )
      }

      if (toolsStack.isConnected) {
        toolsStack.remove()
      }
    }
  }, [
    editor.activePanel,
    editor.ready
  ])

  useEffect(() => {
    activeToolRef.current =
      activeTool

    if (!stack) {
      return
    }

    TOOL_DEFINITIONS.forEach(
      (tool) => {
        const host =
          stack.querySelector<HTMLElement>(
            tool.selector
          )

        if (!host) {
          return
        }

        host.hidden =
          activeTool !== tool.id
      }
    )
  }, [
    activeTool,
    stack
  ])

  const availableSet =
    useMemo(
      () =>
        new Set<ToolId>(
          availableTools
        ),
      [availableTools]
    )

  if (!navigationHost) {
    return null
  }

  return createPortal(
    <section
      className="mq-element-tools-navigation"
      aria-label="Explorar elementos"
    >
      <div className="mq-element-tools-navigation__heading">
        <span>
          <strong>
            Explorar elementos
          </strong>

          <small>
            Pesquise elementos ou escolha uma ferramenta.
          </small>
        </span>

        <span className="mq-element-tools-navigation__count">
          {availableTools.length}
        </span>
      </div>

      <div className="mq-element-tools-navigation__grid">
        {TOOL_DEFINITIONS.map(
          (tool) => {
            const available =
              availableSet.has(
                tool.id
              )

            const active =
              activeTool ===
              tool.id

            return (
              <button
                key={tool.id}
                type="button"
                className={
                  active
                    ? 'is-active'
                    : ''
                }
                disabled={!available}
                aria-pressed={active}
                aria-controls={
                  `mq-element-tool-${tool.id}`
                }
                title={
                  available
                    ? tool.label
                    : `${tool.label} a carregar…`
                }
                onClick={() => {
                  userSelectedToolRef.current =
                    true

                  activeToolRef.current =
                    tool.id

                  setActiveTool(
                    tool.id
                  )
                }}
              >
                <span
                  className="mq-element-tools-navigation__icon"
                  aria-hidden="true"
                >
                  {tool.icon}
                </span>

                <span>
                  {tool.label}
                </span>
              </button>
            )
          }
        )}
      </div>
    </section>,
    navigationHost
  )
}
