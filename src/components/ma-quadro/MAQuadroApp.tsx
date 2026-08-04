import type {
  KeyboardEvent as ReactKeyboardEvent
} from 'react'

import CanvasStage from './CanvasStage'
import EditorDialogs from './EditorDialogs'
import EditorHeader from './EditorHeader'
import {
  MAQuadroEditorProvider
} from './editorContext'
import LeftSidebar from './LeftSidebar'
import PagesStrip from './PagesStrip'
import PropertiesPanel from './PropertiesPanel'
import {
  useMAQuadroEditor
} from './useMAQuadroEditor'
import './maQuadro.css'
import './maQuadroFixes.css'

function targetUsesNativeKeyboard(
  target: EventTarget | null
) {
  const element =
    target instanceof Element
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
        'summary'
      ].join(',')
    )
  )
}

export default function MAQuadroApp() {
  const editor =
    useMAQuadroEditor()

  const protectNativeKeyboard = (
    event:
      ReactKeyboardEvent<HTMLElement>
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
        ) === 's'
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
      editor={editor}
    >
      <main
        className="mq-app"
        onKeyDown={
          protectNativeKeyboard
        }
        onKeyUp={
          protectNativeKeyboard
        }
      >
        <EditorHeader />

        <div className="mq-editor-layout">
          <LeftSidebar />

          <div className="mq-center-column">
            <CanvasStage />
            <PagesStrip />
          </div>

          <PropertiesPanel />
        </div>

        <EditorDialogs />

        {!editor.ready ? (
          <div
            className="mq-loading-screen"
            role="status"
            aria-live="polite"
          >
            <img
              src="/ma-code.png"
              alt=""
            />

            <strong>
              A preparar o MA-Quadro…
            </strong>

            <span>
              O editor e os projetos
              locais estão a ser
              carregados.
            </span>
          </div>
        ) : null}
      </main>
    </MAQuadroEditorProvider>
  )
}
