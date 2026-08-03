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

export default function MAQuadroApp() {
  const editor =
    useMAQuadroEditor()

  return (
    <MAQuadroEditorProvider
      editor={editor}
    >
      <main className="mq-app">
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
