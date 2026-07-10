import { useMemo, useRef, useState } from 'react'
import { pdfTools } from '../../data/pdfTools'
import { compressPdfFile } from '../../lib/maPdf/compressPdf'
import {
  accentClasses,
  MAX_FILE_SIZE_BYTES
} from '../../lib/maPdf/constants'
import {
  createFileId,
  formatFileSize,
  isJpgFile,
  isPdfFile
} from '../../lib/maPdf/fileUtils'
import { convertJpgToPdf } from '../../lib/maPdf/jpgToPdf'
import { mergePdfFiles } from '../../lib/maPdf/mergePdf'
import { convertPdfToJpg } from '../../lib/maPdf/pdfToJpg'
import { splitPdfFile } from '../../lib/maPdf/splitPdf'
import type {
  ActiveTool,
  JpgQuality,
  ResultData,
  SelectedPdf,
  SplitMode
} from '../../types/maPdf'
import CompressInfo from './CompressInfo'
import JpgToPdfInfo from './JpgToPdfInfo'
import PdfToJpgOptions from './PdfToJpgOptions'
import ResultCard from './ResultCard'
import SelectedFilesList from './SelectedFilesList'
import SplitOptions from './SplitOptions'
import UploadZone from './UploadZone'

type PdfWorkbenchProps = {
  activeTool: ActiveTool
}

export default function PdfWorkbench({ activeTool }: PdfWorkbenchProps) {
  const [selectedFiles, setSelectedFiles] = useState<SelectedPdf[]>([])
  const [splitMode, setSplitMode] = useState<SplitMode>('ranges')
  const [splitRanges, setSplitRanges] = useState('1-3')
  const [jpgQuality, setJpgQuality] = useState<JpgQuality>('standard')
  const [isProcessing, setIsProcessing] = useState(false)
  const [progressMessage, setProgressMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [result, setResult] = useState<ResultData | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const activeToolData = useMemo(
    () => pdfTools.find((tool) => tool.activeTool === activeTool),
    [activeTool]
  )

  const totalSelectedSize = useMemo(
    () =>
      selectedFiles.reduce(
        (total, selected) => total + selected.file.size,
        0
      ),
    [selectedFiles]
  )

  const acceptsImages = activeTool === 'jpgToPdf'

  const acceptsMultipleFiles =
    activeTool === 'merge' || activeTool === 'jpgToPdf'

  const allowsReorder = acceptsMultipleFiles

  const clearOperation = () => {
    setSelectedFiles([])
    setSplitMode('ranges')
    setSplitRanges('1-3')
    setJpgQuality('standard')
    setProgressMessage('')
    setErrorMessage('')
    setResult(null)
  }

  const addFiles = (files: File[]) => {
    setErrorMessage('')
    setProgressMessage('')
    setResult(null)

    const invalidFile = files.find((file) =>
      acceptsImages ? !isJpgFile(file) : !isPdfFile(file)
    )

    if (invalidFile) {
      setErrorMessage(
        acceptsImages
          ? `O ficheiro "${invalidFile.name}" não parece ser uma imagem JPG.`
          : `O ficheiro "${invalidFile.name}" não parece ser um documento PDF.`
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

    const acceptedFiles = acceptsMultipleFiles
      ? files
      : files.slice(0, 1)

    setSelectedFiles((currentFiles) => {
      if (!acceptsMultipleFiles) {
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
    setProgressMessage('')
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
        generatedResult = await mergePdfFiles(
          selectedFiles,
          setProgressMessage
        )
      } else if (activeTool === 'split') {
        generatedResult = await splitPdfFile(
          selectedFiles[0],
          splitMode,
          splitRanges,
          setProgressMessage
        )
      } else if (activeTool === 'compress') {
        generatedResult = await compressPdfFile(
          selectedFiles[0],
          setProgressMessage
        )
      } else if (activeTool === 'pdfToJpg') {
        generatedResult = await convertPdfToJpg(
          selectedFiles[0],
          jpgQuality,
          setProgressMessage
        )
      } else {
        generatedResult = await convertJpgToPdf(
          selectedFiles,
          setProgressMessage
        )
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
      } else if (activeTool === 'jpgToPdf') {
        setErrorMessage(
          'Não foi possível ler uma das imagens. Confirme que todos os ficheiros são JPG ou JPEG válidos.'
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
      : activeTool === 'jpgToPdf'
        ? selectedFiles.length >= 1
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
          : activeTool === 'pdfToJpg'
            ? 'Converter PDF para JPG'
            : 'Converter imagens para PDF'

  return (
    <section
      id="utilizar-ferramenta"
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
              multiple={acceptsMultipleFiles}
              fileType={acceptsImages ? 'jpg' : 'pdf'}
              inputRef={fileInputRef}
              onFiles={addFiles}
            />

            <SelectedFilesList
              files={selectedFiles}
              allowReorder={allowsReorder}
              fileBadge={acceptsImages ? 'JPG' : 'PDF'}
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
              <SplitOptions
                splitMode={splitMode}
                splitRanges={splitRanges}
                onModeChange={setSplitMode}
                onRangesChange={setSplitRanges}
              />
            ) : null}

            {activeTool === 'compress' && selectedFiles.length === 1 ? (
              <CompressInfo />
            ) : null}

            {activeTool === 'pdfToJpg' && selectedFiles.length === 1 ? (
              <PdfToJpgOptions
                jpgQuality={jpgQuality}
                onQualityChange={setJpgQuality}
              />
            ) : null}

            {activeTool === 'jpgToPdf' && selectedFiles.length > 0 ? (
              <JpgToPdfInfo />
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
  )
}
