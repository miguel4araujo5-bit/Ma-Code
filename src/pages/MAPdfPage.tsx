import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent
} from 'react'
import { zipSync } from 'fflate'
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { PDFDocument } from 'pdf-lib'

GlobalWorkerOptions.workerSrc = pdfWorkerUrl

const siteUrl = 'https://ma-code.pt'

const MBWAY_NUMBER = '936840619'

const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024

const MAX_JPG_CANVAS_DIMENSION = 8192

const MAX_JPG_CANVAS_PIXELS = 32_000_000

type ToolAccent = 'cyan' | 'blue' | 'violet' | 'emerald' | 'amber' | 'orange'

type ActiveTool = 'merge' | 'split' | 'compress' | 'pdfToJpg'

type PdfTool = {
  id: string
  title: string
  description: string
  badge: string
  accent: ToolAccent
  activeTool?: ActiveTool
  available: boolean
}

type SelectedPdf = {
  id: string
  file: File
}

type ResultData = {
  fileName: string
  blob: Blob
  originalSize?: number
  finalSize?: number
  message: string
}

type SplitMode = 'ranges' | 'individual'

type JpgQuality = 'standard' | 'high'

const pdfTools: PdfTool[] = [
  {
    id: 'juntar-pdf',
    title: 'Juntar PDF',
    description: 'Combine vários PDF num único documento de forma simples.',
    badge: 'PDF+',
    accent: 'cyan',
    activeTool: 'merge',
    available: true
  },
  {
    id: 'dividir-pdf',
    title: 'Dividir PDF',
    description: 'Separe páginas ou intervalos de um documento PDF.',
    badge: 'PDF÷',
    accent: 'violet',
    activeTool: 'split',
    available: true
  },
  {
    id: 'comprimir-pdf',
    title: 'Comprimir PDF',
    description: 'Otimize a estrutura do PDF e tente reduzir o seu tamanho.',
    badge: 'ZIP',
    accent: 'cyan',
    activeTool: 'compress',
    available: true
  },
  {
    id: 'pdf-para-word',
    title: 'PDF para Word',
    description: 'Converta PDF para documentos Word editáveis.',
    badge: 'W',
    accent: 'blue',
    available: false
  },
  {
    id: 'word-para-pdf',
    title: 'Word para PDF',
    description: 'Converta documentos Word de forma rápida para PDF.',
    badge: 'W→',
    accent: 'blue',
    available: false
  },
  {
    id: 'pdf-para-doc',
    title: 'PDF para DOC',
    description: 'Extraia texto de PDF para ficheiros DOC editáveis.',
    badge: 'DOC',
    accent: 'blue',
    available: false
  },
  {
    id: 'doc-para-pdf',
    title: 'DOC para PDF',
    description: 'Converta ficheiros DOC para PDF com qualidade.',
    badge: 'DOC→',
    accent: 'blue',
    available: false
  },
  {
    id: 'pdf-para-jpg',
    title: 'PDF para JPG',
    description: 'Converta cada página do PDF numa imagem JPG.',
    badge: 'JPG',
    accent: 'amber',
    activeTool: 'pdfToJpg',
    available: true
  },
  {
    id: 'jpg-para-pdf',
    title: 'JPG para PDF',
    description: 'Converta imagens JPG para um PDF organizado.',
    badge: 'IMG',
    accent: 'amber',
    available: false
  },
  {
    id: 'pdf-para-excel',
    title: 'PDF para Excel',
    description: 'Converta tabelas de PDF para ficheiros Excel editáveis.',
    badge: 'XLS',
    accent: 'emerald',
    available: false
  },
  {
    id: 'excel-para-pdf',
    title: 'Excel para PDF',
    description: 'Converta folhas de cálculo Excel para PDF com um clique.',
    badge: 'X→',
    accent: 'emerald',
    available: false
  },
  {
    id: 'pdf-para-powerpoint',
    title: 'PDF para PowerPoint',
    description: 'Converta PDF em apresentações PowerPoint editáveis.',
    badge: 'PPT',
    accent: 'orange',
    available: false
  },
  {
    id: 'powerpoint-para-pdf',
    title: 'PowerPoint para PDF',
    description: 'Transforme apresentações PowerPoint em PDF.',
    badge: 'P→',
    accent: 'orange',
    available: false
  },
  {
    id: 'editar-pdf',
    title: 'Editar PDF',
    description: 'Adicione texto, imagens, formas e anotações com facilidade.',
    badge: '✎',
    accent: 'violet',
    available: false
  },
  {
    id: 'assinar-pdf',
    title: 'Assinar PDF',
    description: 'Assine documentos PDF de forma eletrónica rápida e segura.',
    badge: 'SIG',
    accent: 'cyan',
    available: false
  },
  {
    id: 'marca-de-agua',
    title: 'Marca de água',
    description: 'Adicione marcas de água de texto ou imagem aos seus PDF.',
    badge: 'WM',
    accent: 'violet',
    available: false
  }
]

const accentClasses: Record<ToolAccent, string> = {
  cyan: 'border-cyan-300/25 bg-cyan-300/10 text-cyan-100 shadow-cyan-950/30',
  blue: 'border-sky-300/25 bg-sky-400/10 text-sky-100 shadow-sky-950/30',
  violet:
    'border-violet-300/25 bg-violet-400/10 text-violet-100 shadow-violet-950/30',
  emerald:
    'border-emerald-300/25 bg-emerald-400/10 text-emerald-100 shadow-emerald-950/30',
  amber:
    'border-amber-300/25 bg-amber-400/10 text-amber-100 shadow-amber-950/30',
  orange:
    'border-orange-300/25 bg-orange-400/10 text-orange-100 shadow-orange-950/30'
}

function updateMeta(name: string, content: string) {
  let meta = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)

  if (!meta) {
    meta = document.createElement('meta')
    meta.name = name
    document.head.appendChild(meta)
  }

  meta.content = content
}

function updatePropertyMeta(property: string, content: string) {
  let meta = document.querySelector<HTMLMetaElement>(
    `meta[property="${property}"]`
  )

  if (!meta) {
    meta = document.createElement('meta')
    meta.setAttribute('property', property)
    document.head.appendChild(meta)
  }

  meta.content = content
}

function updateCanonical(href: string) {
  let canonical = document.querySelector<HTMLLinkElement>(
    'link[rel="canonical"]'
  )

  if (!canonical) {
    canonical = document.createElement('link')
    canonical.rel = 'canonical'
    document.head.appendChild(canonical)
  }

  canonical.href = href
}

function updateStructuredData(id: string, data: unknown) {
  let script = document.querySelector<HTMLScriptElement>(
    `script[data-schema-id="${id}"]`
  )

  if (!script) {
    script = document.createElement('script')
    script.type = 'application/ld+json'
    script.dataset.schemaId = id
    document.head.appendChild(script)
  }

  script.textContent = JSON.stringify(data)
}

function createFileId(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)

  return copy.buffer
}

function sanitizeFileName(name: string) {
  return name
    .replace(/\.pdf$/i, '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
}

function isPdfFile(file: File) {
  return (
    file.type === 'application/pdf' ||
    file.name.toLowerCase().endsWith('.pdf')
  )
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Não foi possível criar a imagem JPG.'))
          return
        }

        resolve(blob)
      },
      'image/jpeg',
      quality
    )
  })
}

async function blobToUint8Array(blob: Blob) {
  return new Uint8Array(await blob.arrayBuffer())
}

function getSafeJpgScale(width: number, height: number, desiredScale: number) {
  const dimensionScale = Math.min(
    MAX_JPG_CANVAS_DIMENSION / width,
    MAX_JPG_CANVAS_DIMENSION / height
  )

  const pixelScale = Math.sqrt(
    MAX_JPG_CANVAS_PIXELS / Math.max(width * height, 1)
  )

  return Math.max(0.5, Math.min(desiredScale, dimensionScale, pixelScale))
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()

  window.setTimeout(() => {
    URL.revokeObjectURL(url)
  }, 1500)
}

function parsePageRanges(value: string, pageCount: number) {
  const cleaned = value.replace(/\s+/g, '')

  if (!cleaned) {
    throw new Error('Indique pelo menos uma página ou intervalo.')
  }

  const pageIndexes = new Set<number>()
  const parts = cleaned.split(',').filter(Boolean)

  for (const part of parts) {
    if (/^\d+$/.test(part)) {
      const page = Number(part)

      if (page < 1 || page > pageCount) {
        throw new Error(
          `A página ${page} não existe. O documento tem ${pageCount} páginas.`
        )
      }

      pageIndexes.add(page - 1)
      continue
    }

    const match = part.match(/^(\d+)-(\d+)$/)

    if (!match) {
      throw new Error(
        'Use páginas e intervalos no formato 1-3, 5, 8-10.'
      )
    }

    const start = Number(match[1])
    const end = Number(match[2])

    if (start > end) {
      throw new Error(`O intervalo ${part} está invertido.`)
    }

    if (start < 1 || end > pageCount) {
      throw new Error(
        `O intervalo ${part} ultrapassa as ${pageCount} páginas do documento.`
      )
    }

    for (let page = start; page <= end; page += 1) {
      pageIndexes.add(page - 1)
    }
  }

  return Array.from(pageIndexes).sort((a, b) => a - b)
}

function PdfHeroIcon() {
  return (
    <div
      className="relative mx-auto hidden max-w-[17rem] lg:block"
      aria-hidden="true"
    >
      <div className="absolute inset-x-8 bottom-0 h-12 rounded-full bg-cyan-300/20 blur-2xl" />

      <div className="relative rounded-[2rem] border border-cyan-300/20 bg-slate-950/70 p-5 shadow-2xl shadow-cyan-950/40 backdrop-blur">
        <div className="absolute inset-0 rounded-[2rem] bg-[radial-gradient(circle_at_50%_0%,rgba(103,232,249,0.16),transparent_50%)]" />

        <div className="relative aspect-[4/5] rounded-[1.55rem] border border-cyan-200/35 bg-cyan-300/[0.06] p-5 shadow-inner shadow-cyan-200/10">
          <div className="absolute right-5 top-5 h-12 w-12 rounded-bl-3xl border-b border-l border-cyan-200/30 bg-cyan-200/10" />

          <div className="flex h-full items-end justify-center gap-3 text-center">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.28em] text-cyan-100/70">
              MA
            </span>

            <span className="text-5xl font-black tracking-tight text-cyan-200 drop-shadow-[0_0_18px_rgba(103,232,249,0.35)]">
              PDF
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

type ToolCardProps = {
  tool: PdfTool
  index: number
  mounted: boolean
  selected: boolean
  onSelect: (tool: PdfTool) => void
}

function ToolCard({
  tool,
  index,
  mounted,
  selected,
  onSelect
}: ToolCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(tool)}
      disabled={!tool.available}
      className={`group relative w-full overflow-hidden rounded-[1.6rem] border p-5 text-left shadow-xl backdrop-blur transition duration-300 md:p-6 ${
        selected
          ? 'border-cyan-200/55 bg-cyan-300/[0.10] shadow-cyan-950/30'
          : 'border-cyan-300/[0.12] bg-slate-950/60 shadow-cyan-950/10'
      } ${
        tool.available
          ? 'hover:-translate-y-1 hover:border-cyan-200/35 hover:bg-slate-900/80'
          : 'cursor-not-allowed opacity-60'
      } ${mounted ? 'animate-fade-in-up' : 'opacity-0'}`}
      style={{ animationDelay: `${Math.min(index, 11) * 55}ms` }}
      aria-pressed={selected}
    >
      <span className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/55 to-transparent opacity-70" />

      <span className="pointer-events-none absolute -right-16 -top-16 h-36 w-36 rounded-full bg-cyan-300/[0.08] blur-3xl transition duration-500 group-hover:bg-cyan-300/[0.14]" />

      <div className="relative z-10 flex h-full gap-4">
        <div
          className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border text-sm font-black tracking-tight shadow-lg ${accentClasses[tool.accent]}`}
        >
          {tool.badge}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-lg font-semibold tracking-tight text-white md:text-xl">
              {tool.title}
            </h3>

            {tool.available ? (
              <span className="mt-1 text-xl text-cyan-200 transition duration-300 group-hover:translate-x-1">
                →
              </span>
            ) : (
              <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[0.58rem] font-bold uppercase tracking-[0.13em] text-slate-400">
                Em breve
              </span>
            )}
          </div>

          <p className="mt-3 text-sm leading-6 text-slate-300">
            {tool.description}
          </p>

          {selected ? (
            <span className="mt-4 inline-flex rounded-full border border-cyan-200/25 bg-cyan-300/10 px-3 py-1.5 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-cyan-100">
              Ferramenta selecionada
            </span>
          ) : null}
        </div>
      </div>
    </button>
  )
}

type UploadZoneProps = {
  multiple: boolean
  inputRef: React.RefObject<HTMLInputElement | null>
  onFiles: (files: File[]) => void
}

function UploadZone({ multiple, inputRef, onFiles }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false)

  const processFileList = (fileList: FileList | null) => {
    if (!fileList) {
      return
    }

    onFiles(Array.from(fileList))
  }

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    processFileList(event.target.files)
    event.target.value = ''
  }

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    setIsDragging(true)
  }

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
    processFileList(event.dataTransfer.files)
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`rounded-[2rem] border-2 border-dashed p-6 text-center transition md:p-10 ${
        isDragging
          ? 'border-cyan-200 bg-cyan-300/[0.12]'
          : 'border-cyan-300/20 bg-slate-950/50 hover:border-cyan-200/40 hover:bg-slate-900/60'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        multiple={multiple}
        onChange={handleInputChange}
        className="hidden"
      />

      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-300/10 text-2xl text-cyan-100">
        ↑
      </div>

      <h3 className="mt-5 text-xl font-semibold text-white">
        Arraste {multiple ? 'os ficheiros PDF' : 'o ficheiro PDF'} para aqui
      </h3>

      <p className="mt-2 text-sm leading-6 text-slate-400">
        O processamento acontece no seu navegador. Os ficheiros não são enviados
        para servidores.
      </p>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="btn-primary hightech-button mt-6"
      >
        <span className="btn-shine" />

        <span className="relative z-10">
          {multiple ? 'Escolher ficheiros PDF' : 'Escolher ficheiro PDF'}
        </span>
      </button>

      <p className="mt-4 text-xs text-slate-500">
        Tamanho máximo recomendado: 100 MB por ficheiro
      </p>
    </div>
  )
}

type SelectedFilesListProps = {
  files: SelectedPdf[]
  allowReorder: boolean
  onRemove: (id: string) => void
  onMove: (index: number, direction: -1 | 1) => void
}

function SelectedFilesList({
  files,
  allowReorder,
  onRemove,
  onMove
}: SelectedFilesListProps) {
  if (files.length === 0) {
    return null
  }

  return (
    <div className="mt-6 space-y-3">
      {files.map((item, index) => (
        <div
          key={item.id}
          className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:flex-row sm:items-center"
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-xs font-black text-cyan-100">
              PDF
            </div>

            <div className="min-w-0">
              <strong className="block truncate text-sm font-semibold text-white">
                {item.file.name}
              </strong>

              <span className="mt-1 block text-xs text-slate-400">
                {formatFileSize(item.file.size)}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {allowReorder ? (
              <>
                <button
                  type="button"
                  onClick={() => onMove(index, -1)}
                  disabled={index === 0}
                  className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-slate-200 transition hover:border-cyan-200/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                  aria-label={`Mover ${item.file.name} para cima`}
                >
                  ↑
                </button>

                <button
                  type="button"
                  onClick={() => onMove(index, 1)}
                  disabled={index === files.length - 1}
                  className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-slate-200 transition hover:border-cyan-200/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                  aria-label={`Mover ${item.file.name} para baixo`}
                >
                  ↓
                </button>
              </>
            ) : null}

            <button
              type="button"
              onClick={() => onRemove(item.id)}
              className="rounded-xl border border-red-300/15 bg-red-400/[0.08] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-red-100 transition hover:border-red-200/30 hover:bg-red-400/[0.14]"
            >
              Remover
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

function SupportCard() {
  const [copied, setCopied] = useState(false)

  const copyNumber = async () => {
    if (!MBWAY_NUMBER) {
      return
    }

    try {
      await navigator.clipboard.writeText(MBWAY_NUMBER)
      setCopied(true)

      window.setTimeout(() => {
        setCopied(false)
      }, 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="mt-6 rounded-[1.6rem] border border-violet-300/20 bg-violet-400/[0.08] p-5">
      <span className="text-xs font-bold uppercase tracking-[0.2em] text-violet-200">
        Apoio voluntário
      </span>

      <h3 className="mt-3 text-lg font-semibold text-white">
        Esta ferramenta é gratuita.
      </h3>

      <p className="mt-2 text-sm leading-6 text-slate-300">
        Se o MA PDF lhe foi útil, pode apoiar o desenvolvimento de novas
        ferramentas com 1 € por MB WAY.
      </p>

      {MBWAY_NUMBER ? (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3">
            <span className="block text-[0.62rem] font-bold uppercase tracking-[0.16em] text-slate-400">
              Número MB WAY
            </span>

            <strong className="mt-1 block text-lg text-white">
              {MBWAY_NUMBER}
            </strong>
          </div>

          <button
            type="button"
            onClick={copyNumber}
            className="btn-secondary hightech-button-secondary"
          >
            {copied ? 'Número copiado' : 'Copiar número'}
          </button>
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-300">
          O número para apoio por MB WAY será disponibilizado brevemente.
        </div>
      )}
    </div>
  )
}

function ResultCard({
  result,
  onReset
}: {
  result: ResultData
  onReset: () => void
}) {
  const reduction =
    result.originalSize &&
    result.finalSize &&
    result.originalSize > result.finalSize
      ? Math.round(
          ((result.originalSize - result.finalSize) / result.originalSize) *
            100
        )
      : 0

  return (
    <div className="mt-6 rounded-[2rem] border border-emerald-300/20 bg-emerald-400/[0.08] p-5 md:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-200">
            Ficheiro pronto
          </span>

          <h3 className="mt-3 text-xl font-semibold text-white">
            {result.fileName}
          </h3>

          <p className="mt-2 text-sm leading-6 text-slate-300">
            {result.message}
          </p>

          {result.originalSize && result.finalSize ? (
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-300">
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2">
                Original: {formatFileSize(result.originalSize)}
              </span>

              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2">
                Resultado: {formatFileSize(result.finalSize)}
              </span>

              {reduction > 0 ? (
                <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-emerald-100">
                  Redução: {reduction}%
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => downloadBlob(result.blob, result.fileName)}
            className="btn-primary hightech-button"
          >
            <span className="btn-shine" />
            <span className="relative z-10">Descarregar resultado</span>
          </button>

          <button
            type="button"
            onClick={onReset}
            className="btn-secondary hightech-button-secondary"
          >
            Nova operação
          </button>
        </div>
      </div>

      <SupportCard />
    </div>
  )
}

export default function MAPdfPage() {
  const [mounted, setMounted] = useState(false)
  const [activeTool, setActiveTool] = useState<ActiveTool>('merge')
  const [selectedFiles, setSelectedFiles] = useState<SelectedPdf[]>([])
  const [splitMode, setSplitMode] = useState<SplitMode>('ranges')
  const [splitRanges, setSplitRanges] = useState('1-3')
  const [jpgQuality, setJpgQuality] = useState<JpgQuality>('standard')
  const [isProcessing, setIsProcessing] = useState(false)
  const [progressMessage, setProgressMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [result, setResult] = useState<ResultData | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const workbenchRef = useRef<HTMLDivElement>(null)

  const activeToolData = useMemo(
    () => pdfTools.find((tool) => tool.activeTool === activeTool),
    [activeTool]
  )

  const totalSelectedSize = useMemo(
    () =>
      selectedFiles.reduce((total, selected) => total + selected.file.size, 0),
    [selectedFiles]
  )

  useEffect(() => {
    setMounted(true)

    document.title =
      'MA PDF | Juntar, dividir, comprimir e converter PDF para JPG'

    updateMeta(
      'description',
      'Junte, divida, comprima e converta documentos PDF para JPG gratuitamente no navegador. Os ficheiros permanecem no seu dispositivo e não são enviados para servidores.'
    )

    updateMeta(
      'keywords',
      'MA PDF, juntar PDF, dividir PDF, comprimir PDF, PDF para JPG, converter PDF em imagem, ferramentas PDF grátis, PDF online, PDF privado, MA-Code'
    )

    updateMeta(
      'robots',
      'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
    )

    updatePropertyMeta('og:type', 'website')
    updatePropertyMeta('og:locale', 'pt_PT')
    updatePropertyMeta('og:site_name', 'MA-Code')
    updatePropertyMeta('og:url', `${siteUrl}/produtos/mapdf`)
    updatePropertyMeta(
      'og:title',
      'MA PDF | Juntar, dividir, comprimir e converter PDF para JPG'
    )
    updatePropertyMeta(
      'og:description',
      'Ferramentas PDF gratuitas e privadas. Junte, divida, otimize e converta páginas PDF para JPG diretamente no navegador.'
    )
    updatePropertyMeta('og:image', `${siteUrl}/ma-code.png`)
    updatePropertyMeta('og:image:alt', 'MA PDF - ferramentas PDF da MA-Code')

    updateMeta('twitter:card', 'summary_large_image')
    updateMeta('twitter:url', `${siteUrl}/produtos/mapdf`)
    updateMeta(
      'twitter:title',
      'MA PDF | Juntar, dividir, comprimir e converter PDF para JPG'
    )
    updateMeta(
      'twitter:description',
      'Ferramentas PDF gratuitas que juntam, dividem, otimizam e convertem documentos para JPG diretamente no navegador.'
    )
    updateMeta('twitter:image', `${siteUrl}/ma-code.png`)
    updateMeta('twitter:image:alt', 'MA PDF - ferramentas PDF da MA-Code')

    updateCanonical(`${siteUrl}/produtos/mapdf`)

    updateStructuredData('ma-pdf-product-page', {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebPage',
          '@id': `${siteUrl}/produtos/mapdf#webpage`,
          name: 'MA PDF | Juntar, dividir, comprimir e converter PDF para JPG',
          url: `${siteUrl}/produtos/mapdf`,
          inLanguage: 'pt-PT',
          description:
            'Ferramentas PDF gratuitas para juntar, dividir, otimizar e converter documentos para JPG diretamente no navegador.',
          isPartOf: {
            '@id': `${siteUrl}/#website`
          }
        },
        {
          '@type': 'SoftwareApplication',
          '@id': `${siteUrl}/produtos/mapdf#softwareapplication`,
          name: 'MA PDF',
          applicationCategory: 'ProductivityApplication',
          operatingSystem: 'Web',
          url: `${siteUrl}/produtos/mapdf`,
          description:
            'Ferramentas PDF gratuitas para juntar, dividir, otimizar e converter páginas PDF para JPG sem enviar os ficheiros para servidores.',
          offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'EUR'
          },
          featureList: [
            'Juntar ficheiros PDF',
            'Dividir PDF por páginas ou intervalos',
            'Otimizar a estrutura de ficheiros PDF',
            'Converter páginas PDF para imagens JPG',
            'Processamento local no navegador'
          ],
          creator: {
            '@type': 'Organization',
            name: 'MA-Code',
            url: siteUrl
          }
        }
      ]
    })
  }, [])

  const clearOperation = () => {
    setSelectedFiles([])
    setSplitMode('ranges')
    setSplitRanges('1-3')
    setJpgQuality('standard')
    setProgressMessage('')
    setErrorMessage('')
    setResult(null)
  }

  const selectTool = (tool: PdfTool) => {
    if (!tool.available || !tool.activeTool) {
      return
    }

    setActiveTool(tool.activeTool)
    clearOperation()

    window.setTimeout(() => {
      workbenchRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      })
    }, 50)
  }

  const addFiles = (files: File[]) => {
    setErrorMessage('')
    setResult(null)

    const invalidFile = files.find((file) => !isPdfFile(file))

    if (invalidFile) {
      setErrorMessage(
        `O ficheiro "${invalidFile.name}" não parece ser um documento PDF.`
      )
      return
    }

    const oversizedFile = files.find(
      (file) => file.size > MAX_FILE_SIZE_BYTES
    )

    if (oversizedFile) {
      setErrorMessage(
        `O ficheiro "${oversizedFile.name}" ultrapassa o limite recomendado de 100 MB.`
      )
      return
    }

    const acceptedFiles = activeTool === 'merge' ? files : files.slice(0, 1)

    setSelectedFiles((currentFiles) => {
      if (activeTool !== 'merge') {
        const file = acceptedFiles[0]

        return file
          ? [
              {
                id: createFileId(file),
                file
              }
            ]
          : currentFiles
      }

      const existingSignatures = new Set(
        currentFiles.map(
          (item) =>
            `${item.file.name}-${item.file.size}-${item.file.lastModified}`
        )
      )

      const newFiles = acceptedFiles
        .filter(
          (file) =>
            !existingSignatures.has(
              `${file.name}-${file.size}-${file.lastModified}`
            )
        )
        .map((file) => ({
          id: createFileId(file),
          file
        }))

      return [...currentFiles, ...newFiles]
    })
  }

  const removeFile = (id: string) => {
    setSelectedFiles((currentFiles) =>
      currentFiles.filter((item) => item.id !== id)
    )
    setResult(null)
    setErrorMessage('')
  }

  const moveFile = (index: number, direction: -1 | 1) => {
    setSelectedFiles((currentFiles) => {
      const destination = index + direction

      if (destination < 0 || destination >= currentFiles.length) {
        return currentFiles
      }

      const reordered = [...currentFiles]
      const [movedItem] = reordered.splice(index, 1)
      reordered.splice(destination, 0, movedItem)

      return reordered
    })
  }

  const processMerge = async () => {
    if (selectedFiles.length < 2) {
      throw new Error('Escolha pelo menos dois ficheiros PDF para juntar.')
    }

    setProgressMessage('A ler os documentos PDF...')

    const mergedDocument = await PDFDocument.create()

    for (let index = 0; index < selectedFiles.length; index += 1) {
      const selected = selectedFiles[index]

      setProgressMessage(
        `A adicionar ${index + 1} de ${selectedFiles.length}: ${selected.file.name}`
      )

      const bytes = await selected.file.arrayBuffer()
      const sourceDocument = await PDFDocument.load(bytes, {
        updateMetadata: false
      })

      const pageIndexes = sourceDocument.getPageIndices()
      const copiedPages = await mergedDocument.copyPages(
        sourceDocument,
        pageIndexes
      )

      copiedPages.forEach((page) => {
        mergedDocument.addPage(page)
      })
    }

    setProgressMessage('A criar o documento final...')

    const mergedBytes = await mergedDocument.save({
      useObjectStreams: true,
      addDefaultPage: false,
      objectsPerTick: 30
    })

    const blob = new Blob([bytesToArrayBuffer(mergedBytes)], {
      type: 'application/pdf'
    })

    return {
      fileName: 'ma-pdf-documentos-juntos.pdf',
      blob,
      originalSize: totalSelectedSize,
      finalSize: blob.size,
      message: `${selectedFiles.length} documentos foram unidos com sucesso.`
    }
  }

  const processSplitRanges = async (
    sourceDocument: PDFDocument,
    sourceName: string
  ) => {
    const pageCount = sourceDocument.getPageCount()
    const selectedPageIndexes = parsePageRanges(splitRanges, pageCount)

    setProgressMessage('A copiar as páginas selecionadas...')

    const outputDocument = await PDFDocument.create()
    const copiedPages = await outputDocument.copyPages(
      sourceDocument,
      selectedPageIndexes
    )

    copiedPages.forEach((page) => {
      outputDocument.addPage(page)
    })

    const outputBytes = await outputDocument.save({
      useObjectStreams: true,
      addDefaultPage: false,
      objectsPerTick: 30
    })

    const blob = new Blob([bytesToArrayBuffer(outputBytes)], {
      type: 'application/pdf'
    })

    return {
      fileName: `${sanitizeFileName(sourceName)}-paginas-selecionadas.pdf`,
      blob,
      originalSize: selectedFiles[0].file.size,
      finalSize: blob.size,
      message: `${selectedPageIndexes.length} página${
        selectedPageIndexes.length === 1 ? '' : 's'
      } foram extraídas para um novo PDF.`
    }
  }

  const processSplitIndividual = async (
    sourceDocument: PDFDocument,
    sourceName: string
  ) => {
    const pageCount = sourceDocument.getPageCount()
    const zipFiles: Record<string, Uint8Array> = {}

    for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
      setProgressMessage(
        `A separar página ${pageIndex + 1} de ${pageCount}...`
      )

      const pageDocument = await PDFDocument.create()
      const [copiedPage] = await pageDocument.copyPages(sourceDocument, [
        pageIndex
      ])

      pageDocument.addPage(copiedPage)

      const pageBytes = await pageDocument.save({
        useObjectStreams: true,
        addDefaultPage: false,
        objectsPerTick: 30
      })

      const pageNumber = String(pageIndex + 1).padStart(
        String(pageCount).length,
        '0'
      )

      zipFiles[
        `${sanitizeFileName(sourceName)}-pagina-${pageNumber}.pdf`
      ] = pageBytes
    }

    setProgressMessage('A criar o ficheiro ZIP...')

    const zipBytes = zipSync(zipFiles, {
      level: 6
    })

    const blob = new Blob([bytesToArrayBuffer(zipBytes)], {
      type: 'application/zip'
    })

    return {
      fileName: `${sanitizeFileName(sourceName)}-paginas.zip`,
      blob,
      originalSize: selectedFiles[0].file.size,
      finalSize: blob.size,
      message: `${pageCount} páginas foram separadas em ficheiros PDF individuais.`
    }
  }

  const processSplit = async () => {
    const selected = selectedFiles[0]

    if (!selected) {
      throw new Error('Escolha um ficheiro PDF para dividir.')
    }

    setProgressMessage('A analisar o documento PDF...')

    const bytes = await selected.file.arrayBuffer()
    const sourceDocument = await PDFDocument.load(bytes, {
      updateMetadata: false
    })

    if (sourceDocument.getPageCount() === 0) {
      throw new Error('O documento não contém páginas.')
    }

    if (splitMode === 'individual') {
      return processSplitIndividual(sourceDocument, selected.file.name)
    }

    return processSplitRanges(sourceDocument, selected.file.name)
  }

  const processCompress = async () => {
    const selected = selectedFiles[0]

    if (!selected) {
      throw new Error('Escolha um ficheiro PDF para otimizar.')
    }

    setProgressMessage('A analisar e reorganizar o documento PDF...')

    const bytes = await selected.file.arrayBuffer()
    const sourceDocument = await PDFDocument.load(bytes, {
      updateMetadata: false
    })

    /*
     * Esta operação reorganiza os objetos internos e ativa object streams.
     * PDFs compostos sobretudo por imagens já comprimidas podem não ficar
     * significativamente menores sem reduzir a resolução das imagens.
     */
    const optimizedBytes = await sourceDocument.save({
      useObjectStreams: true,
      addDefaultPage: false,
      objectsPerTick: 20
    })

    const optimizedBlob = new Blob(
      [bytesToArrayBuffer(optimizedBytes)],
      {
        type: 'application/pdf'
      }
    )

    const baseName = sanitizeFileName(selected.file.name)

    const reduced = optimizedBlob.size < selected.file.size

    return {
      fileName: `${baseName}-otimizado.pdf`,
      blob: optimizedBlob,
      originalSize: selected.file.size,
      finalSize: optimizedBlob.size,
      message: reduced
        ? 'O PDF foi reorganizado e o tamanho foi reduzido.'
        : 'O PDF foi reorganizado, mas já estava comprimido e não foi possível reduzir significativamente o tamanho.'
    }
  }

  const processPdfToJpg = async () => {
    const selected = selectedFiles[0]

    if (!selected) {
      throw new Error('Escolha um ficheiro PDF para converter para JPG.')
    }

    setProgressMessage('A preparar o conversor de PDF para JPG...')

    const data = new Uint8Array(await selected.file.arrayBuffer())
    const loadingTask = getDocument({ data })

    try {
      const pdfDocument = await loadingTask.promise
      const pageCount = pdfDocument.numPages

      if (pageCount === 0) {
        throw new Error('O documento não contém páginas.')
      }

      const desiredScale = jpgQuality === 'high' ? 2.5 : 1.75
      const jpegQuality = jpgQuality === 'high' ? 0.94 : 0.86
      const baseName = sanitizeFileName(selected.file.name)
      const zipFiles: Record<string, Uint8Array> = {}
      let singlePageBlob: Blob | null = null

      for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
        setProgressMessage(
          `A converter página ${pageNumber} de ${pageCount} para JPG...`
        )

        const page = await pdfDocument.getPage(pageNumber)
        const baseViewport = page.getViewport({ scale: 1 })
        const safeScale = getSafeJpgScale(
          baseViewport.width,
          baseViewport.height,
          desiredScale
        )
        const viewport = page.getViewport({ scale: safeScale })
        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d', {
          alpha: false
        })

        if (!context) {
          throw new Error(
            'O navegador não conseguiu preparar a imagem desta página.'
          )
        }

        canvas.width = Math.max(1, Math.ceil(viewport.width))
        canvas.height = Math.max(1, Math.ceil(viewport.height))

        await page.render({
          canvas,
          canvasContext: context,
          viewport,
          background: 'rgb(255, 255, 255)'
        }).promise

        const jpgBlob = await canvasToJpegBlob(canvas, jpegQuality)
        const pageNumberText = String(pageNumber).padStart(
          String(pageCount).length,
          '0'
        )
        const jpgFileName = `${baseName}-pagina-${pageNumberText}.jpg`

        if (pageCount === 1) {
          singlePageBlob = jpgBlob
        } else {
          zipFiles[jpgFileName] = await blobToUint8Array(jpgBlob)
        }

        page.cleanup()
        canvas.width = 1
        canvas.height = 1
      }

      if (pageCount === 1 && singlePageBlob) {
        return {
          fileName: `${baseName}-pagina-1.jpg`,
          blob: singlePageBlob,
          originalSize: selected.file.size,
          finalSize: singlePageBlob.size,
          message: 'A página do PDF foi convertida para uma imagem JPG.'
        }
      }

      setProgressMessage('A criar o ficheiro ZIP com as imagens JPG...')

      const zipBytes = zipSync(zipFiles, {
        level: 0
      })

      const blob = new Blob([bytesToArrayBuffer(zipBytes)], {
        type: 'application/zip'
      })

      return {
        fileName: `${baseName}-paginas-jpg.zip`,
        blob,
        originalSize: selected.file.size,
        finalSize: blob.size,
        message: `${pageCount} páginas foram convertidas para JPG e organizadas num ficheiro ZIP.`
      }
    } finally {
      try {
        await loadingTask.destroy()
      } catch {
        // O resultado já foi criado; a limpeza do worker não deve bloquear o download.
      }
    }
  }

  const processCurrentTool = async () => {
    if (isProcessing) {
      return
    }

    setIsProcessing(true)
    setErrorMessage('')
    setResult(null)

    try {
      let generatedResult: ResultData

      if (activeTool === 'merge') {
        generatedResult = await processMerge()
      } else if (activeTool === 'split') {
        generatedResult = await processSplit()
      } else if (activeTool === 'compress') {
        generatedResult = await processCompress()
      } else {
        generatedResult = await processPdfToJpg()
      }

      setResult(generatedResult)
      setProgressMessage('Processamento concluído.')
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Não foi possível processar este documento.'

      const normalizedMessage = message.toLowerCase()

      if (
        normalizedMessage.includes('encrypted') ||
        normalizedMessage.includes('password')
      ) {
        setErrorMessage(
          'Este PDF está protegido por palavra-passe. Remova a proteção antes de utilizar a ferramenta.'
        )
      } else {
        setErrorMessage(message)
      }

      setProgressMessage('')
    } finally {
      setIsProcessing(false)
    }
  }

  const canProcess =
    activeTool === 'merge'
      ? selectedFiles.length >= 2
      : selectedFiles.length === 1

  const buttonText =
    activeTool === 'merge'
      ? 'Juntar ficheiros PDF'
      : activeTool === 'split'
        ? splitMode === 'individual'
          ? 'Separar todas as páginas'
          : 'Extrair páginas selecionadas'
        : activeTool === 'compress'
          ? 'Otimizar PDF'
          : 'Converter PDF para JPG'

  return (
    <main className="site-shell">
      <div className="site-bg-orb site-bg-orb-one" />
      <div className="site-bg-orb site-bg-orb-two" />
      <div className="site-bg-orb site-bg-orb-three" />
      <div className="site-grid" />
      <div className="site-noise" />

      <section className="relative z-10 overflow-hidden px-5 pb-10 pt-6 sm:px-6 md:px-10 md:pb-12 md:pt-8">
        <div className="mx-auto max-w-7xl">
          <header className="mb-8 flex items-center justify-between gap-4 md:mb-12">
            <a
              href="/"
              className="brand-mark"
              aria-label="MA-Code.pt - Página inicial"
            >
              <img
                src="/ma-code.png"
                alt="MA-Code.pt"
                className="shrink-0 object-contain"
                loading="eager"
                decoding="async"
              />

              <span>MA-Code.pt</span>
            </a>

            <div className="hidden items-center gap-3 sm:flex">
              <a
                href="/produtos"
                className="text-sm font-semibold text-slate-300 transition hover:text-white"
              >
                Produtos
              </a>

              <a
                href="/produtos/mapdf"
                className="rounded-2xl border border-cyan-300/15 bg-cyan-300/10 px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-cyan-100"
              >
                MA PDF
              </a>
            </div>
          </header>

          <div className="grid gap-8 lg:grid-cols-[250px_minmax(0,1fr)] lg:items-center">
            <PdfHeroIcon />

            <div className={mounted ? 'animate-fade-in-up' : 'opacity-0'}>
              <div className="hero-topline">
                <span className="hero-topline__dot" />
                <span>Produto MA-Code · MA PDF</span>
              </div>

              <h1 className="mt-6 max-w-5xl text-4xl font-semibold tracking-tight text-white md:text-6xl">
                Ferramentas PDF{' '}
                <span className="bg-gradient-to-r from-cyan-200 via-sky-300 to-violet-200 bg-clip-text text-transparent">
                  gratuitas, privadas e rápidas
                </span>
                .
              </h1>

              <p className="mt-5 max-w-3xl text-base leading-8 text-slate-300 md:text-lg">
                Junte, divida, otimize e converta documentos PDF para JPG
                diretamente no navegador. Os seus ficheiros permanecem no seu
                dispositivo e nunca são enviados para os nossos servidores.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <span className="rounded-full border border-cyan-300/15 bg-cyan-300/10 px-4 py-2 text-sm font-semibold text-cyan-100">
                  Utilização gratuita
                </span>

                <span className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-200">
                  Sem registo
                </span>

                <span className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-200">
                  Processamento local
                </span>
              </div>

              <div className="hero-actions">
                <a
                  href="#ferramentas"
                  className="btn-primary hightech-button"
                >
                  <span className="btn-shine" />
                  <span className="relative z-10">Escolher ferramenta</span>
                </a>

                <a
                  href="#utilizar-ferramenta"
                  className="btn-secondary hightech-button-secondary"
                >
                  Utilizar agora
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        id="ferramentas"
        className="relative z-10 px-5 pb-8 sm:px-6 md:px-10 md:pb-14"
      >
        <div className="mx-auto max-w-7xl">
          <div className="mb-7">
            <span className="section-label">Ferramentas MA PDF</span>

            <h2 className="mt-5 text-2xl font-semibold tracking-tight text-white md:text-4xl">
              Escolha a operação que pretende realizar.
            </h2>

            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 md:text-base">
              Quatro ferramentas já estão disponíveis. As restantes serão
              adicionadas progressivamente.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {pdfTools.map((tool, index) => (
              <div key={tool.id} id={tool.id}>
                <ToolCard
                  tool={tool}
                  index={index}
                  mounted={mounted}
                  selected={tool.activeTool === activeTool}
                  onSelect={selectTool}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        id="utilizar-ferramenta"
        ref={workbenchRef}
        className="relative z-10 scroll-mt-6 px-5 pb-8 sm:px-6 md:px-10 md:pb-14"
      >
        <div className="mx-auto max-w-7xl">
          <div className="overflow-hidden rounded-[2rem] border border-cyan-300/15 bg-slate-950/70 shadow-2xl shadow-cyan-950/20 backdrop-blur">
            <div className="border-b border-white/10 p-5 md:p-7">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-4">
                  <div
                    className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border text-sm font-black ${
                      accentClasses[activeToolData?.accent || 'cyan']
                    }`}
                  >
                    {activeToolData?.badge}
                  </div>

                  <div>
                    <span className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-200/70">
                      Ferramenta ativa
                    </span>

                    <h2 className="mt-1 text-2xl font-semibold text-white md:text-3xl">
                      {activeToolData?.title}
                    </h2>

                    <p className="mt-2 text-sm leading-6 text-slate-300">
                      {activeToolData?.description}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.08] px-4 py-3 text-sm text-emerald-100">
                  Gratuito · Sem upload para servidores
                </div>
              </div>
            </div>

            <div className="p-5 md:p-7">
              <UploadZone
                multiple={activeTool === 'merge'}
                inputRef={fileInputRef}
                onFiles={addFiles}
              />

              <SelectedFilesList
                files={selectedFiles}
                allowReorder={activeTool === 'merge'}
                onRemove={removeFile}
                onMove={moveFile}
              />

              {activeTool === 'merge' && selectedFiles.length > 0 ? (
                <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-300">
                  Os documentos serão unidos pela ordem apresentada acima.
                  Utilize as setas para alterar a ordem.
                </div>
              ) : null}

              {activeTool === 'split' && selectedFiles.length === 1 ? (
                <div className="mt-6 rounded-[1.6rem] border border-white/10 bg-white/[0.04] p-5">
                  <span className="input-label">Como pretende dividir?</span>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setSplitMode('ranges')}
                      className={`rounded-2xl border p-4 text-left transition ${
                        splitMode === 'ranges'
                          ? 'border-cyan-200/40 bg-cyan-300/10'
                          : 'border-white/10 bg-white/[0.03] hover:border-cyan-200/25'
                      }`}
                    >
                      <strong className="block text-sm text-white">
                        Extrair páginas ou intervalos
                      </strong>

                      <span className="mt-2 block text-xs leading-5 text-slate-400">
                        Cria um novo PDF apenas com as páginas selecionadas.
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSplitMode('individual')}
                      className={`rounded-2xl border p-4 text-left transition ${
                        splitMode === 'individual'
                          ? 'border-cyan-200/40 bg-cyan-300/10'
                          : 'border-white/10 bg-white/[0.03] hover:border-cyan-200/25'
                      }`}
                    >
                      <strong className="block text-sm text-white">
                        Uma página por ficheiro
                      </strong>

                      <span className="mt-2 block text-xs leading-5 text-slate-400">
                        Cria vários PDF e entrega todos dentro de um ZIP.
                      </span>
                    </button>
                  </div>

                  {splitMode === 'ranges' ? (
                    <div className="mt-5">
                      <label htmlFor="split-ranges" className="input-label">
                        Páginas a extrair
                      </label>

                      <input
                        id="split-ranges"
                        type="text"
                        value={splitRanges}
                        onChange={(event) =>
                          setSplitRanges(event.target.value)
                        }
                        className="input-field"
                        placeholder="Exemplo: 1-3, 5, 8-10"
                      />

                      <p className="mt-2 text-xs leading-5 text-slate-400">
                        Separe intervalos com vírgulas. Exemplo: 1-3, 5, 8-10.
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {activeTool === 'compress' && selectedFiles.length === 1 ? (
                <div className="mt-6 rounded-[1.6rem] border border-amber-300/20 bg-amber-300/[0.06] p-5">
                  <strong className="block text-sm text-amber-100">
                    Como funciona a otimização
                  </strong>

                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    O MA PDF reorganiza a estrutura interna do documento e
                    elimina armazenamento ineficiente. Documentos compostos por
                    fotografias já comprimidas podem não apresentar uma redução
                    significativa sem diminuir a qualidade das imagens.
                  </p>
                </div>
              ) : null}

              {activeTool === 'pdfToJpg' && selectedFiles.length === 1 ? (
                <div className="mt-6 rounded-[1.6rem] border border-amber-300/20 bg-amber-300/[0.06] p-5">
                  <span className="input-label">Qualidade das imagens JPG</span>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setJpgQuality('standard')}
                      className={`rounded-2xl border p-4 text-left transition ${
                        jpgQuality === 'standard'
                          ? 'border-amber-200/40 bg-amber-300/10'
                          : 'border-white/10 bg-white/[0.03] hover:border-amber-200/25'
                      }`}
                    >
                      <strong className="block text-sm text-white">
                        Qualidade normal
                      </strong>

                      <span className="mt-2 block text-xs leading-5 text-slate-400">
                        Boa definição e ficheiros mais leves para enviar ou
                        publicar.
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setJpgQuality('high')}
                      className={`rounded-2xl border p-4 text-left transition ${
                        jpgQuality === 'high'
                          ? 'border-amber-200/40 bg-amber-300/10'
                          : 'border-white/10 bg-white/[0.03] hover:border-amber-200/25'
                      }`}
                    >
                      <strong className="block text-sm text-white">
                        Alta qualidade
                      </strong>

                      <span className="mt-2 block text-xs leading-5 text-slate-400">
                        Mais resolução para impressão, arquivo ou detalhe visual.
                      </span>
                    </button>
                  </div>

                  <p className="mt-4 text-xs leading-5 text-slate-400">
                    Um PDF com uma página gera um JPG. Documentos com várias
                    páginas são entregues num ficheiro ZIP com uma imagem por
                    página.
                  </p>
                </div>
              ) : null}

              {selectedFiles.length > 0 ? (
                <div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-400">
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2">
                    {selectedFiles.length} ficheiro
                    {selectedFiles.length === 1 ? '' : 's'}
                  </span>

                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2">
                    {formatFileSize(totalSelectedSize)}
                  </span>
                </div>
              ) : null}

              {errorMessage ? (
                <div
                  className="status-message status-message--error mt-6"
                  role="alert"
                >
                  {errorMessage}
                </div>
              ) : null}

              {isProcessing || progressMessage ? (
                <div
                  className="mt-6 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.06] p-4"
                  role="status"
                  aria-live="polite"
                >
                  <div className="flex items-center gap-3">
                    {isProcessing ? (
                      <span className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-100/25 border-t-cyan-100" />
                    ) : (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-300/15 text-xs text-emerald-200">
                        ✓
                      </span>
                    )}

                    <span className="text-sm text-cyan-50">
                      {progressMessage}
                    </span>
                  </div>
                </div>
              ) : null}

              {!result ? (
                <button
                  type="button"
                  onClick={processCurrentTool}
                  disabled={!canProcess || isProcessing}
                  className="btn-primary hightech-button mt-6 w-full disabled:cursor-not-allowed disabled:opacity-40"
                  aria-busy={isProcessing}
                >
                  <span className="btn-shine" />

                  <span className="relative z-10">
                    {isProcessing ? 'A processar...' : buttonText}
                  </span>
                </button>
              ) : (
                <ResultCard result={result} onReset={clearOperation} />
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 px-5 pb-20 sm:px-6 md:px-10 md:pb-24">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-6 md:grid-cols-3">
            <article className="service-card">
              <div className="service-card__line" />

              <div className="relative z-10">
                <span className="service-card__index">01</span>

                <h2 className="service-card__title">
                  Os ficheiros ficam no dispositivo
                </h2>

                <p className="service-card__description">
                  O documento é processado localmente no navegador. Não fazemos
                  upload, armazenamento ou análise dos seus ficheiros.
                </p>
              </div>
            </article>

            <article className="service-card">
              <div className="service-card__line" />

              <div className="relative z-10">
                <span className="service-card__index">02</span>

                <h2 className="service-card__title">
                  Sem conta obrigatória
                </h2>

                <p className="service-card__description">
                  Pode utilizar as ferramentas disponíveis sem criar conta,
                  fornecer email ou subscrever qualquer plano.
                </p>
              </div>
            </article>

            <article className="service-card">
              <div className="service-card__line" />

              <div className="relative z-10">
                <span className="service-card__index">03</span>

                <h2 className="service-card__title">
                  Apoio voluntário
                </h2>

                <p className="service-card__description">
                  O acesso é gratuito. Quem considerar a ferramenta útil pode
                  apoiar voluntariamente o desenvolvimento de novas funções.
                </p>
              </div>
            </article>
          </div>
        </div>
      </section>
    </main>
  )
}
