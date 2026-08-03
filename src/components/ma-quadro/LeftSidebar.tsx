import type {
  MAQuadroPanelId,
  MAQuadroShapeKind,
  MAQuadroTextPreset
} from '../../types/maQuadro'
import {
  useMAQuadroEditorContext
} from './editorContext'

const panels: Array<{
  id: MAQuadroPanelId
  icon: string
  label: string
}> = [
  {
    id: 'templates',
    icon: '▦',
    label: 'Modelos'
  },
  {
    id: 'elements',
    icon: '◇',
    label: 'Elementos'
  },
  {
    id: 'uploads',
    icon: '↑',
    label: 'Uploads'
  },
  {
    id: 'text',
    icon: 'T',
    label: 'Texto'
  },
  {
    id: 'brand',
    icon: '◉',
    label: 'Marca'
  },
  {
    id: 'projects',
    icon: '▤',
    label: 'Projetos'
  }
]

const shapes: Array<{
  kind: MAQuadroShapeKind
  icon: string
  label: string
}> = [
  {
    kind: 'rectangle',
    icon: '▭',
    label: 'Retângulo'
  },
  {
    kind: 'circle',
    icon: '●',
    label: 'Círculo'
  },
  {
    kind: 'ellipse',
    icon: '⬭',
    label: 'Elipse'
  },
  {
    kind: 'triangle',
    icon: '▲',
    label: 'Triângulo'
  },
  {
    kind: 'star',
    icon: '★',
    label: 'Estrela'
  },
  {
    kind: 'line',
    icon: '─',
    label: 'Linha'
  },
  {
    kind: 'arrow',
    icon: '➜',
    label: 'Seta'
  }
]

const textPresets: Array<{
  preset: MAQuadroTextPreset
  label: string
  className: string
}> = [
  {
    preset: 'heading',
    label:
      'Adicionar um título',
    className:
      'mq-text-preset--heading'
  },
  {
    preset: 'subheading',
    label:
      'Adicionar um subtítulo',
    className:
      'mq-text-preset--subheading'
  },
  {
    preset: 'body',
    label:
      'Adicionar texto corrido',
    className:
      'mq-text-preset--body'
  },
  {
    preset: 'caption',
    label:
      'Adicionar uma legenda',
    className:
      'mq-text-preset--caption'
  }
]

function PanelHeading({
  title,
  description
}: {
  title: string
  description?: string
}) {
  return (
    <div className="mq-panel-heading">
      <h2>
        {title}
      </h2>

      {description ? (
        <p>
          {description}
        </p>
      ) : null}
    </div>
  )
}

function TemplatesPanel() {
  const editor =
    useMAQuadroEditorContext()

  const templates =
    editor.projects.filter(
      (project) =>
        project.isTemplate
    )

  const systemTemplates =
    templates.filter(
      (project) =>
        project.id.startsWith(
          'template-'
        )
    )

  const personalTemplates =
    templates.filter(
      (project) =>
        !project.id.startsWith(
          'template-'
        )
    )

  return (
    <>
      <PanelHeading
        title="Começar um design"
        description="Escolha um formato vazio ou duplique um modelo editável."
      />

      <div className="mq-preset-grid">
        {editor.presets.map(
          (preset) => (
            <button
              key={preset.id}
              type="button"
              className="mq-preset-card"
              onClick={() =>
                void editor
                  .createFromPreset(
                    preset
                  )
              }
            >
              <span
                className="mq-preset-card__preview"
                data-ratio={
                  preset.category
                }
              />

              <strong>
                {preset.name}
              </strong>

              <small>
                {preset.width} ×{' '}
                {preset.height}
              </small>
            </button>
          )
        )}
      </div>

      <button
        type="button"
        className="mq-wide-action"
        onClick={() =>
          editor.setNewDesignOpen(
            true
          )
        }
      >
        + Tamanho personalizado
      </button>

      <div className="mq-section-title">
        <h3>
          Modelos profissionais
        </h3>

        <span>
          {systemTemplates.length}
        </span>
      </div>

      <div className="mq-template-list">
        {systemTemplates.map(
          (template) => (
            <button
              key={template.id}
              type="button"
              className="mq-template-card"
              onClick={() =>
                void editor.openProject(
                  template.id
                )
              }
            >
              <span className="mq-template-card__thumb">
                {template.pages[0]
                  ?.thumbnail ? (
                  <img
                    src={
                      template.pages[0]
                        .thumbnail
                    }
                    alt=""
                  />
                ) : (
                  <span>
                    MQ
                  </span>
                )}
              </span>

              <span className="mq-template-card__copy">
                <strong>
                  {template.name}
                </strong>

                <small>
                  {
                    template.pages
                      .length
                  }{' '}
                  {
                    template.pages
                      .length === 1
                      ? 'página'
                      : 'páginas'
                  }
                </small>
              </span>

              <span className="mq-template-card__arrow">
                →
              </span>
            </button>
          )
        )}
      </div>

      {personalTemplates.length >
      0 ? (
        <>
          <div className="mq-section-title">
            <h3>
              Os seus modelos
            </h3>

            <span>
              {
                personalTemplates
                  .length
              }
            </span>
          </div>

          <div className="mq-template-list">
            {personalTemplates.map(
              (template) => (
                <button
                  key={template.id}
                  type="button"
                  className="mq-template-card"
                  onClick={() =>
                    void editor
                      .openProject(
                        template.id
                      )
                  }
                >
                  <span className="mq-template-card__thumb">
                    {template.pages[0]
                      ?.thumbnail ? (
                      <img
                        src={
                          template.pages[0]
                            .thumbnail
                        }
                        alt=""
                      />
                    ) : (
                      <span>
                        MQ
                      </span>
                    )}
                  </span>

                  <span className="mq-template-card__copy">
                    <strong>
                      {template.name}
                    </strong>

                    <small>
                      Modelo pessoal
                    </small>
                  </span>

                  <span className="mq-template-card__arrow">
                    →
                  </span>
                </button>
              )
            )}
          </div>
        </>
      ) : null}
    </>
  )
}

function ElementsPanel() {
  const editor =
    useMAQuadroEditorContext()

  return (
    <>
      <PanelHeading
        title="Elementos"
        description="Adicione formas vetoriais, linhas e desenho livre."
      />

      <div className="mq-element-grid">
        {shapes.map(
          (shape) => (
            <button
              key={shape.kind}
              type="button"
              className="mq-element-button"
              onClick={() =>
                editor.addShape(
                  shape.kind
                )
              }
            >
              <span>
                {shape.icon}
              </span>

              <small>
                {shape.label}
              </small>
            </button>
          )
        )}
      </div>

      <div className="mq-section-title">
        <h3>
          Desenho livre
        </h3>
      </div>

      <button
        type="button"
        className={`mq-wide-action${
          editor.drawingMode
            ? ' is-active'
            : ''
        }`}
        onClick={() =>
          editor.setDrawingMode(
            !editor.drawingMode
          )
        }
      >
        {editor.drawingMode
          ? '✓ Parar de desenhar'
          : '✎ Ativar pincel'}
      </button>

      <div className="mq-inline-fields">
        <label>
          <span>
            Cor
          </span>

          <input
            type="color"
            value={
              editor.brushColor
            }
            onChange={(event) =>
              editor.setBrushColor(
                event.target.value
              )
            }
          />
        </label>

        <label className="mq-inline-fields__grow">
          <span>
            Espessura:{' '}
            {editor.brushWidth}px
          </span>

          <input
            type="range"
            min="1"
            max="120"
            value={
              editor.brushWidth
            }
            onChange={(event) =>
              editor.setBrushWidth(
                Number(
                  event.target.value
                )
              )
            }
          />
        </label>
      </div>

      <div className="mq-section-title">
        <h3>
          Organizar seleção
        </h3>
      </div>

      <div className="mq-action-grid">
        <button
          type="button"
          onClick={
            editor.groupSelection
          }
          disabled={
            editor.selection.count <
            2
          }
        >
          Agrupar
        </button>

        <button
          type="button"
          onClick={
            editor.ungroupSelection
          }
          disabled={
            editor.selection.role !==
            'group'
          }
        >
          Desagrupar
        </button>

        <button
          type="button"
          onClick={() =>
            editor.distributeSelection(
              'horizontal'
            )
          }
          disabled={
            editor.selection.count <
            3
          }
        >
          Distribuir H
        </button>

        <button
          type="button"
          onClick={() =>
            editor.distributeSelection(
              'vertical'
            )
          }
          disabled={
            editor.selection.count <
            3
          }
        >
          Distribuir V
        </button>
      </div>
    </>
  )
}

function UploadsPanel() {
  const editor =
    useMAQuadroEditorContext()

  return (
    <>
      <PanelHeading
        title="Uploads"
        description="As imagens permanecem no seu dispositivo e ficam incorporadas no projeto."
      />

      <button
        type="button"
        className="mq-upload-zone"
        onClick={() =>
          editor.imageInputRef
            .current
            ?.click()
        }
      >
        <span className="mq-upload-zone__icon">
          ↑
        </span>

        <strong>
          Carregar imagens
        </strong>

        <small>
          PNG, JPG, WebP ou GIF
        </small>
      </button>

      <input
        ref={
          editor.imageInputRef
        }
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={(event) =>
          void editor.addImages(
            event
          )
        }
        hidden
      />

      <div className="mq-info-card">
        <strong>
          Também pode arrastar
        </strong>

        <p>
          Arraste uma ou várias
          imagens diretamente para
          a área de trabalho.
        </p>
      </div>

      <div className="mq-info-card mq-info-card--accent">
        <strong>
          Edição local
        </strong>

        <p>
          Depois de selecionar uma
          imagem pode ajustar cor,
          recortar, virar e remover
          fundos lisos.
        </p>
      </div>
    </>
  )
}

function TextPanel() {
  const editor =
    useMAQuadroEditorContext()

  return (
    <>
      <PanelHeading
        title="Texto"
        description="Adicione hierarquia tipográfica e personalize-a no painel da direita."
      />

      <div className="mq-text-presets">
        {textPresets.map(
          (item) => (
            <button
              key={item.preset}
              type="button"
              className={`mq-text-preset ${item.className}`}
              onClick={() =>
                editor.addText(
                  item.preset
                )
              }
            >
              {item.label}
            </button>
          )
        )}
      </div>

      <div className="mq-section-title">
        <h3>
          Ações rápidas
        </h3>
      </div>

      <div className="mq-action-grid mq-action-grid--3">
        <button
          type="button"
          onClick={() =>
            editor.transformTextCase(
              'upper'
            )
          }
          disabled={
            editor.selection.role !==
            'text'
          }
        >
          ABC
        </button>

        <button
          type="button"
          onClick={() =>
            editor.transformTextCase(
              'lower'
            )
          }
          disabled={
            editor.selection.role !==
            'text'
          }
        >
          abc
        </button>

        <button
          type="button"
          onClick={() =>
            editor.transformTextCase(
              'title'
            )
          }
          disabled={
            editor.selection.role !==
            'text'
          }
        >
          Título
        </button>
      </div>
    </>
  )
}

function BrandPanel() {
  const editor =
    useMAQuadroEditorContext()

  return (
    <>
      <PanelHeading
        title={`Marca ${editor.brand.name}`}
        description="Aplique cores e fontes consistentes ao design."
      />

      <div className="mq-section-title">
        <h3>
          Paleta
        </h3>
      </div>

      <div className="mq-color-grid">
        {editor.brand.colors.map(
          (color) => (
            <button
              key={color.value}
              type="button"
              className="mq-color-card"
              onClick={() =>
                editor.applyBrandColor(
                  color.value
                )
              }
              title={`Aplicar ${color.name}`}
            >
              <span
                style={{
                  background:
                    color.value
                }}
              />

              <small>
                {color.name}
              </small>
            </button>
          )
        )}
      </div>

      <div className="mq-section-title">
        <h3>
          Fontes
        </h3>

        <button
          type="button"
          onClick={() =>
            editor.fontInputRef
              .current
              ?.click()
          }
        >
          + Adicionar
        </button>
      </div>

      <input
        ref={
          editor.fontInputRef
        }
        type="file"
        accept=".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2"
        onChange={(event) =>
          void editor.uploadFont(
            event
          )
        }
        hidden
      />

      <div className="mq-font-list">
        {editor.availableFonts.map(
          (font) => (
            <button
              key={font.family}
              type="button"
              className="mq-font-card"
              onClick={() =>
                editor.setTextProperty(
                  'fontFamily',
                  font.family
                )
              }
              disabled={
                editor.selection.role !==
                'text'
              }
            >
              <span
                style={{
                  fontFamily:
                    `${font.family}, ${
                      font.fallback ||
                      'sans-serif'
                    }`
                }}
              >
                Aa
              </span>

              <strong>
                {font.name}
              </strong>
            </button>
          )
        )}
      </div>

      {editor.localFonts.length >
      0 ? (
        <div className="mq-local-fonts">
          {editor.localFonts.map(
            (font) => (
              <div key={font.id}>
                <span>
                  {font.fileName}
                </span>

                <button
                  type="button"
                  onClick={() =>
                    void editor
                      .deleteFont(
                        font.id
                      )
                  }
                >
                  Eliminar
                </button>
              </div>
            )
          )}
        </div>
      ) : null}
    </>
  )
}

function ProjectsPanel() {
  const editor =
    useMAQuadroEditorContext()

  const projects =
    editor.projects.filter(
      (project) =>
        !project.isTemplate
    )

  return (
    <>
      <PanelHeading
        title="Os seus projetos"
        description="Guardados no IndexedDB deste browser. Exporte o projeto para criar uma cópia de segurança."
      />

      <div className="mq-project-list">
        {projects.map(
          (project) => (
            <article
              key={project.id}
              className={`mq-project-card${
                editor.project?.id ===
                project.id
                  ? ' is-active'
                  : ''
              }`}
            >
              <button
                type="button"
                className="mq-project-card__open"
                onClick={() =>
                  void editor.openProject(
                    project.id
                  )
                }
              >
                <span className="mq-project-card__thumb">
                  {project.pages[0]
                    ?.thumbnail ? (
                    <img
                      src={
                        project.pages[0]
                          .thumbnail
                      }
                      alt=""
                    />
                  ) : (
                    <span>
                      MQ
                    </span>
                  )}
                </span>

                <span>
                  <strong>
                    {project.name}
                  </strong>

                  <small>
                    {
                      project.pages
                        .length
                    }{' '}
                    {
                      project.pages
                        .length === 1
                        ? 'página'
                        : 'páginas'
                    }
                  </small>
                </span>
              </button>

              <div className="mq-project-card__actions">
                <button
                  type="button"
                  onClick={() =>
                    void editor
                      .duplicateProject(
                        project.id
                      )
                  }
                >
                  Duplicar
                </button>

                <button
                  type="button"
                  onClick={() =>
                    void editor
                      .deleteProject(
                        project.id
                      )
                  }
                >
                  Eliminar
                </button>
              </div>
            </article>
          )
        )}
      </div>

      {projects.length === 0 ? (
        <div className="mq-empty-state">
          Ainda não existem
          projetos guardados.
        </div>
      ) : null}

      <button
        type="button"
        className="mq-wide-action"
        onClick={() =>
          editor.projectInputRef
            .current
            ?.click()
        }
      >
        Importar projeto JSON
      </button>
    </>
  )
}

export default function LeftSidebar() {
  const editor =
    useMAQuadroEditorContext()

  return (
    <aside className="mq-left-sidebar">
      <nav
        className="mq-tool-rail"
        aria-label="Ferramentas do editor"
      >
        {panels.map(
          (panel) => (
            <button
              key={panel.id}
              type="button"
              className={
                editor.activePanel ===
                panel.id
                  ? 'is-active'
                  : ''
              }
              onClick={() =>
                editor.setActivePanel(
                  panel.id
                )
              }
            >
              <span>
                {panel.icon}
              </span>

              <small>
                {panel.label}
              </small>
            </button>
          )
        )}
      </nav>

      <div className="mq-left-panel">
        <div className="mq-left-panel__scroll">
          {editor.activePanel ===
          'templates' ? (
            <TemplatesPanel />
          ) : null}

          {editor.activePanel ===
          'elements' ? (
            <ElementsPanel />
          ) : null}

          {editor.activePanel ===
          'uploads' ? (
            <UploadsPanel />
          ) : null}

          {editor.activePanel ===
          'text' ? (
            <TextPanel />
          ) : null}

          {editor.activePanel ===
          'brand' ? (
            <BrandPanel />
          ) : null}

          {editor.activePanel ===
          'projects' ? (
            <ProjectsPanel />
          ) : null}
        </div>
      </div>
    </aside>
  )
}
