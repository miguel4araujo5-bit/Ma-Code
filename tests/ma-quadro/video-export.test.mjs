import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import ts from 'typescript'

const __dirname = path.dirname(
  fileURLToPath(import.meta.url)
)

const repoRoot = path.resolve(
  __dirname,
  '../..'
)

async function transpileSource(
  relativePath
) {
  const absolutePath = path.join(
    repoRoot,
    relativePath
  )

  const source = await readFile(
    absolutePath,
    'utf8'
  )

  return ts.transpileModule(
    source,
    {
      compilerOptions: {
        target:
          ts.ScriptTarget.ES2020,
        module:
          ts.ModuleKind.ESNext,
        isolatedModules: true
      },
      fileName:
        absolutePath
    }
  ).outputText
}

function asDataModule(
  source
) {
  return `data:text/javascript;base64,${Buffer.from(
    source,
    'utf8'
  ).toString('base64')}`
}

const exportStubUrl = asDataModule(`
export function downloadMAQuadroBlob(blob, fileName) {
  globalThis.__mqVideoDownload = {
    blob,
    fileName
  }
}
`)

const objectAnimationsStubUrl = asDataModule(`
export function getMAQuadroAnimationCanvas() {
  return globalThis.__mqAnimationCanvas ?? null
}
`)

const pageAnimationsStubUrl = asDataModule(`
export function countMAQuadroPageAnimations() {
  return globalThis.__mqAnimationCount ?? 0
}

export async function previewMAQuadroPageAnimations(canvas, options) {
  globalThis.__mqPreviewCall = {
    canvas,
    options
  }

  return globalThis.__mqPreviewResult ?? true
}
`)

const projectStubUrl = asDataModule(`
export function safeMAQuadroFileName(value) {
  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/[\\u0300-\\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return normalized || 'design-ma-quadro'
}
`)

const animatedExportSource = (
  await transpileSource(
    'src/lib/maQuadro/animatedExport.ts'
  )
)
  .replace(
    /from\s+['"]\.\/export['"]/g,
    `from '${exportStubUrl}'`
  )
  .replace(
    /from\s+['"]\.\/objectAnimations['"]/g,
    `from '${objectAnimationsStubUrl}'`
  )
  .replace(
    /from\s+['"]\.\/pageAnimations['"]/g,
    `from '${pageAnimationsStubUrl}'`
  )
  .replace(
    /from\s+['"]\.\/project['"]/g,
    `from '${projectStubUrl}'`
  )

const animatedExport = await import(
  asDataModule(
    animatedExportSource
  )
)

function createPage(
  width,
  height,
  name = 'Página 1'
) {
  return {
    id: 'page-test',
    name,
    width,
    height,
    backgroundColor: '#ffffff',
    transparentBackground: false,
    canvasJson: {
      version: '7.4.0',
      objects: []
    }
  }
}

function saveGlobals() {
  return {
    window:
      globalThis.window,
    document:
      globalThis.document,
    MediaRecorder:
      globalThis.MediaRecorder,
    HTMLCanvasElement:
      globalThis.HTMLCanvasElement,
    animationCanvas:
      globalThis.__mqAnimationCanvas,
    animationCount:
      globalThis.__mqAnimationCount,
    previewCall:
      globalThis.__mqPreviewCall,
    previewResult:
      globalThis.__mqPreviewResult,
    videoDownload:
      globalThis.__mqVideoDownload
  }
}

function restoreGlobal(
  name,
  value
) {
  if (
    value === undefined
  ) {
    delete globalThis[name]
    return
  }

  globalThis[name] =
    value
}

function restoreGlobals(
  saved
) {
  restoreGlobal(
    'window',
    saved.window
  )
  restoreGlobal(
    'document',
    saved.document
  )
  restoreGlobal(
    'MediaRecorder',
    saved.MediaRecorder
  )
  restoreGlobal(
    'HTMLCanvasElement',
    saved.HTMLCanvasElement
  )
  restoreGlobal(
    '__mqAnimationCanvas',
    saved.animationCanvas
  )
  restoreGlobal(
    '__mqAnimationCount',
    saved.animationCount
  )
  restoreGlobal(
    '__mqPreviewCall',
    saved.previewCall
  )
  restoreGlobal(
    '__mqPreviewResult',
    saved.previewResult
  )
  restoreGlobal(
    '__mqVideoDownload',
    saved.videoDownload
  )
}

test(
  'vídeo 1080 × 1080 mantém a resolução original',
  () => {
    const plan =
      animatedExport
        .getMAQuadroVideoExportPlan(
          createPage(
            1080,
            1080
          )
        )

    assert.deepEqual(
      plan,
      {
        width: 1080,
        height: 1080,
        scale: 1,
        reduced: false,
        fps: 30
      }
    )
  }
)

test(
  'vídeo horizontal grande é reduzido para um limite seguro',
  () => {
    const plan =
      animatedExport
        .getMAQuadroVideoExportPlan(
          createPage(
            4000,
            2000
          )
        )

    assert.equal(
      plan.width,
      1920
    )
    assert.equal(
      plan.height,
      960
    )
    assert.equal(
      plan.reduced,
      true
    )
    assert.ok(
      plan.scale < 1
    )
  }
)

test(
  'vídeo vertical Full HD permanece 1080 × 1920',
  () => {
    const plan =
      animatedExport
        .getMAQuadroVideoExportPlan(
          createPage(
            1080,
            1920
          )
        )

    assert.equal(
      plan.width,
      1080
    )
    assert.equal(
      plan.height,
      1920
    )
    assert.equal(
      plan.reduced,
      false
    )
  }
)

test(
  'dimensões de vídeo são sempre pares',
  () => {
    const plan =
      animatedExport
        .getMAQuadroVideoExportPlan(
          createPage(
            101,
            99
          )
        )

    assert.equal(
      plan.width % 2,
      0
    )
    assert.equal(
      plan.height % 2,
      0
    )
  }
)

test(
  'ambiente sem MediaRecorder é marcado como incompatível',
  () => {
    const saved =
      saveGlobals()

    try {
      delete globalThis.window
      delete globalThis.MediaRecorder
      delete globalThis.HTMLCanvasElement

      const capability =
        animatedExport
          .getMAQuadroVideoCapability()

      assert.equal(
        capability.supported,
        false
      )
    } finally {
      restoreGlobals(
        saved
      )
    }
  }
)

test(
  'MP4 é usado como fallback quando WebM não é suportado',
  () => {
    const saved =
      saveGlobals()

    try {
      globalThis.window = {}

      globalThis.HTMLCanvasElement =
        class HTMLCanvasElement {
          captureStream() {}
        }

      globalThis.MediaRecorder =
        class MediaRecorder {
          static isTypeSupported(
            mimeType
          ) {
            return mimeType ===
              'video/mp4'
          }
        }

      const capability =
        animatedExport
          .getMAQuadroVideoCapability()

      assert.deepEqual(
        capability,
        {
          supported: true,
          mimeType:
            'video/mp4',
          extension: 'mp4'
        }
      )
    } finally {
      restoreGlobals(
        saved
      )
    }
  }
)

test(
  'exportação transmite modo e intervalo ao motor de animações',
  async () => {
    const saved =
      saveGlobals()

    class FakeMediaRecorder {
      static isTypeSupported(
        mimeType
      ) {
        return mimeType ===
          'video/mp4'
      }

      constructor(
        stream,
        options
      ) {
        this.stream = stream
        this.options = options
        this.state = 'inactive'
        this.listeners =
          new Map()
      }

      addEventListener(
        type,
        listener,
        options = {}
      ) {
        const listeners =
          this.listeners
            .get(type) || []

        listeners.push({
          listener,
          once:
            options.once === true
        })

        this.listeners.set(
          type,
          listeners
        )
      }

      emit(
        type,
        event = {}
      ) {
        const listeners = [
          ...(this.listeners
            .get(type) || [])
        ]

        for (
          const entry of listeners
        ) {
          entry.listener(
            event
          )
        }

        this.listeners.set(
          type,
          listeners.filter(
            (
              entry
            ) =>
              !entry.once
          )
        )
      }

      start() {
        this.state =
          'recording'
      }

      stop() {
        if (
          this.state ===
          'inactive'
        ) {
          return
        }

        this.state =
          'inactive'

        this.emit(
          'dataavailable',
          {
            data: new Blob(
              ['video-test'],
              {
                type:
                  this.options
                    .mimeType
              }
            )
          }
        )

        this.emit(
          'stop'
        )
      }
    }

    const track = {
      stopped: false,
      stop() {
        this.stopped =
          true
      }
    }

    const stream = {
      getTracks() {
        return [
          track
        ]
      }
    }

    const context = {
      fillStyle: '',
      fillRect() {},
      drawImage() {}
    }

    try {
      globalThis.window = {
        requestAnimationFrame() {
          return 1
        },
        cancelAnimationFrame() {}
      }

      globalThis.HTMLCanvasElement =
        class HTMLCanvasElement {
          captureStream() {
            return stream
          }
        }

      globalThis.MediaRecorder =
        FakeMediaRecorder

      globalThis.document = {
        createElement(
          tagName
        ) {
          assert.equal(
            tagName,
            'canvas'
          )

          return {
            width: 0,
            height: 0,
            getContext() {
              return context
            },
            captureStream() {
              return stream
            }
          }
        }
      }

      const sourceCanvas = {}
      const animationCanvas = {
        lowerCanvasEl:
          sourceCanvas
      }

      globalThis.__mqAnimationCanvas =
        animationCanvas
      globalThis.__mqAnimationCount =
        2
      globalThis.__mqPreviewResult =
        true
      delete globalThis.__mqPreviewCall
      delete globalThis.__mqVideoDownload

      const result =
        await animatedExport
          .exportMAQuadroCurrentPageVideo({
            page:
              createPage(
                1080,
                1080,
                'Página Vídeo'
              ),
            projectName:
              'Projeto Teste',
            mode:
              'sequence',
            gapMs: 250
          })

      assert.equal(
        globalThis
          .__mqPreviewCall
          .canvas,
        animationCanvas
      )

      assert.deepEqual(
        globalThis
          .__mqPreviewCall
          .options,
        {
          mode:
            'sequence',
          gapMs: 250,
          holdMs: 300
        }
      )

      assert.equal(
        globalThis
          .__mqVideoDownload
          .fileName,
        'projeto-teste-pagina-video.mp4'
      )

      assert.ok(
        globalThis
          .__mqVideoDownload
          .blob.size > 0
      )

      assert.equal(
        result.capability.extension,
        'mp4'
      )

      assert.equal(
        track.stopped,
        true
      )
    } finally {
      restoreGlobals(
        saved
      )
    }
  }
)
