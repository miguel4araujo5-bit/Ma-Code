import {
  useCallback,
  useEffect,
  useState,
  type KeyboardEvent as ReactKeyboardEvent
} from 'react'

import AnimationPanel from './AnimationPanel'
import BrandQuickStyles from './BrandQuickStyles'
import CanvasContextMenu, {
  type MAQuadroContextMenuPosition
} from './CanvasContextMenu'
import CanvasStage from './CanvasStage'
import ChartBuilder from './ChartBuilder'
import ChartEditor from './ChartEditor'
import CurvedTextBuilder from './CurvedTextBuilder'
import CurvedTextEditor from './CurvedTextEditor'
import EditorDialogs from './EditorDialogs'
import EditorHeader from './EditorHeader'
import ElementEditor from './ElementEditor'
import ElementLibrary from './ElementLibrary'
import ElementToolsLayoutController from './ElementToolsLayoutController'
import {
  MAQuadroEditorProvider
} from './editorContext'
import FormatPainterController from './FormatPainterController'
import FrameBuilder from './FrameBuilder'
import FrameDropController from './FrameDropController'
import ImageFilterPresets from './ImageFilterPresets'
import KeyboardShortcutsDialog from './KeyboardShortcutsDialog'
import LayersManager from './LayersManager'
import LeftSidebar from './LeftSidebar'
import MAQuadroHome from './MAQuadroHome'
import PagesStrip from './PagesStrip'
import PropertiesPanel from './PropertiesPanel'
import QRCodeBuilder from './QRCodeBuilder'
import QRCodeEditor from './QRCodeEditor'
import SmartSpacingOverlay from './SmartSpacingOverlay'
import TableBuilder from './TableBuilder'
import TableEditor from './TableEditor'
import TextEffectsToolbar from './TextEffectsToolbar'
import VideoEditor from './VideoEditor'
import VideoUploads from './VideoUploads'
import {
  useMAQuadroEditor
} from './useMAQuadroEditor'

import './maQuadro.css'
import './maQuadroFixes.css'
import './maQuadroWorkflow.css'
import './maQuadroHeaderPolish.css'
import './maQuadroToolbarPolish.css'
import './maQuadroWorkspacePolish.css'
import './maQuadroFrames.css'
import './maQuadroElementLibrary.css'
import './maQuadroImagePresets.css'
import './maQuadroLayersManager.css'

function targetUsesNativeKeyboard(
  target:
    EventTarget |
    null
) {
  const element =
    target instanceof
      Element
      ? target
      : null

  return Boolean(
    element?.closest(
      [
        'input',
        'textarea',
        'select',
        'button',
        'a',
        '[contenteditable="true"]',
        '[role="dialog"]',
        '[role="menu"]',
        'summary'
      ].join(
        ','
      )
    )
  )
}

export default function MAQuadroApp() {
  const editor =
    useMAQuadroEditor()

  const [
    homeOpen,
    setHomeOpen
  ] = useState(
    true
  )

  const [
    shortcutsOpen,
    setShortcutsOpen
  ] = useState(
    false
  )

  const [
    contextMenu,
    setContextMenu
  ] = useState<
    MAQuadroContextMenuPosition |
    null
  >(
    null
  )

  const closeContextMenu =
    useCallback(
      () => {
        setContextMenu(
          null
        )
      },
      []
    )

  const enterEditor =
    useCallback(
      () => {
        setHomeOpen(
          false
        )
      },
      []
    )

  const goHome =
    useCallback(
      async () => {
        if (
          !editor.ready ||
          editor.busy ||
          editor.structureBusy ||
          editor.imageCropEditing
        ) {
          return
        }

        if (
          editor.project &&
          !editor.project.isTemplate
        ) {
          const saved =
            await editor.saveProject(
              true
            )

          if (!saved) {
            return
          }
        }

        closeContextMenu()

        setShortcutsOpen(
          false
        )

        setHomeOpen(
          true
        )
      },
      [
        closeContextMenu,
        editor.busy,
        editor.imageCropEditing,
        editor.project,
        editor.ready,
        editor.saveProject,
        editor.structureBusy
      ]
    )

  const openContextMenu =
    useCallback(
      (
        position:
          MAQuadroContextMenuPosition
      ) => {
        if (
          homeOpen ||
          !editor.ready ||
          editor
            .selection
            .count ===
              0 ||
          editor.busy ||
          editor
            .structureBusy ||
          editor
            .imageCropEditing
        ) {
          return
        }

        setContextMenu(
          position
        )
      },
      [
        editor.busy,
        editor.imageCropEditing,
        editor.ready,
        editor.selection.count,
        editor.structureBusy,
        homeOpen
      ]
    )

  useEffect(() => {
    closeContextMenu()
  }, [
    closeContextMenu,
    editor.activePage?.id,
    editor.project?.id
  ])

  useEffect(() => {
    const handleGlobalKeyDown = (
      event:
        KeyboardEvent
    ) => {
      if (
        homeOpen ||
        !editor.ready ||
        event.defaultPrevented ||
        targetUsesNativeKeyboard(
          event.target
        )
      ) {
        return
      }

      if (
        event.key ===
          '?' &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        event.preventDefault()
        event.stopPropagation()

        closeContextMenu()

        setShortcutsOpen(
          true
        )

        return
      }

      const contextMenuKey =
        event.key ===
          'ContextMenu' ||
        (
          event.shiftKey &&
          event.key ===
            'F10'
        )

      if (
        !contextMenuKey
      ) {
        return
      }

      if (
        editor
          .selection
          .count ===
            0 ||
        editor.busy ||
        editor
          .structureBusy ||
        editor
          .imageCropEditing
      ) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      const workspace =
        editor
          .workspaceRef
          .current

      const bounds =
        workspace
          ?.getBoundingClientRect()

      openContextMenu({
        x:
          bounds
            ? bounds.left +
              Math.min(
                bounds.width *
                  0.55,
                bounds.width -
                  32
              )
            : window.innerWidth /
              2,

        y:
          bounds
            ? bounds.top +
              Math.min(
                bounds.height *
                  0.4,
                bounds.height -
                  32
              )
            : window.innerHeight /
              2
      })
    }

    window.addEventListener(
      'keydown',
      handleGlobalKeyDown
    )

    return () => {
      window.removeEventListener(
        'keydown',
        handleGlobalKeyDown
      )
    }
  }, [
    closeContextMenu,
    editor.busy,
    editor.imageCropEditing,
    editor.ready,
    editor.selection.count,
    editor.structureBusy,
    editor.workspaceRef,
    homeOpen,
    openContextMenu
  ])

  useEffect(() => {
    if (
      !editor.ready ||
      homeOpen
    ) {
      return
    }

    const frame =
      window.requestAnimationFrame(
        () => {
          editor.fitCanvas()
        }
      )

    return () => {
      window.cancelAnimationFrame(
        frame
      )
    }
  }, [
    editor.activePage?.id,
    editor.fitCanvas,
    editor.ready,
    homeOpen
  ])

  const protectNativeKeyboard = (
    event:
      ReactKeyboardEvent<
        HTMLElement
      >
  ) => {
    if (
      !targetUsesNativeKeyboard(
        event.target
      )
    ) {
      return
    }

    const modifier =
      event.ctrlKey ||
      event.metaKey

    if (
      modifier &&
      event.key
        .toLocaleLowerCase(
          'pt-PT'
        ) ===
        's'
    ) {
      event.preventDefault()
      event.stopPropagation()

      void editor.saveProject(
        false
      )

      return
    }

    event.stopPropagation()
  }

  return (
    <MAQuadroEditorProvider
      editor={
        editor
      }
    >
      <main
        className="mq-app"
        style={{
          visibility:
            editor.ready &&
            !homeOpen
              ? 'visible'
              : 'hidden'
        }}
        aria-busy={
          !editor.ready
        }
        aria-hidden={
          homeOpen
            ? true
            : undefined
        }
        onKeyDown={
          protectNativeKeyboard
        }
        onKeyUp={
          protectNativeKeyboard
        }
      >
        <FormatPainterController />

        <FrameDropController />

        <BrandQuickStyles />

        <TableBuilder />

        <ChartBuilder />

        <QRCodeBuilder />

        <CurvedTextBuilder />

        <FrameBuilder />

        <ElementLibrary />

        <ElementToolsLayoutController />

        <VideoUploads />

        <VideoEditor />

        <TableEditor />

        <ChartEditor />

        <QRCodeEditor />

        <CurvedTextEditor />

        <ElementEditor />

        <ImageFilterPresets />

        <LayersManager />

        <AnimationPanel />

        <EditorHeader
          onGoHome={() => {
            void goHome()
          }}
          onOpenShortcuts={() => {
            closeContextMenu()

            setShortcutsOpen(
              true
            )
          }}
        />

        <TextEffectsToolbar />

        <div className="mq-editor-layout">
          <LeftSidebar />

          <div className="mq-center-column">
            <CanvasStage
              onOpenContextMenu={
                openContextMenu
              }
            />

            <PagesStrip />
          </div>

          <PropertiesPanel />
        </div>

        <SmartSpacingOverlay />

        <KeyboardShortcutsDialog
          open={
            shortcutsOpen
          }
          onClose={() =>
            setShortcutsOpen(
              false
            )
          }
        />

        {contextMenu ? (
          <CanvasContextMenu
            position={
              contextMenu
            }
            onClose={
              closeContextMenu
            }
          />
        ) : null}

        {!editor.ready ? (
          <div
            className="mq-loading-screen"
            style={{
              visibility:
                'visible'
            }}
            role="status"
            aria-live="polite"
          >
            <img
              src="/ma-code.png"
              alt=""
            />

            <strong>
              A preparar o
              MA-Quadro…
            </strong>

            <span>
              O editor e os
              projetos locais
              estão a ser
              carregados.
            </span>
          </div>
        ) : null}
      </main>

      {editor.ready &&
      homeOpen ? (
        <MAQuadroHome
          onEnterEditor={
            enterEditor
          }
        />
      ) : null}

      <EditorDialogs />
    </MAQuadroEditorProvider>
  )
}
