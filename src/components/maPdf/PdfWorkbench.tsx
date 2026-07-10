import {
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'

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

import {
  editPdf,
  type PdfEditElement
} from '../../lib/maPdf/editPdf'

import { convertJpgToPdf } from '../../lib/maPdf/jpgToPdf'
import { mergePdfFiles } from '../../lib/maPdf/mergePdf'
import { convertPdfToDoc } from '../../lib/maPdf/pdfToDoc'
import { convertPdfToExcel } from '../../lib/maPdf/pdfToExcel'
import { convertPdfToJpg } from '../../lib/maPdf/pdfToJpg'
import { convertPdfToWord } from '../../lib/maPdf/pdfToWord'

import {
  signPdf,
  type SignaturePosition
} from '../../lib/maPdf/signPdf'

import { splitPdfFile } from '../../lib/maPdf/splitPdf'
import { convertWordToPdf } from '../../lib/maPdf/wordToPdf'

import {
  addWatermarkToPdf,
  type WatermarkPosition
} from '../../lib/maPdf/watermarkPdf'

import type {
  ActiveTool,
  JpgQuality,
  ResultData,
  SelectedPdf,
  SplitMode
} from '../../types/maPdf'

import CompressInfo from './CompressInfo'
import EditPdfOptions from './EditPdfOptions'
import JpgToPdfInfo from './JpgToPdfInfo'
import PdfToJpgOptions from './PdfToJpgOptions'
import ResultCard from './ResultCard'
import SelectedFilesList from './SelectedFilesList'

import SignatureOptions, {
  type SignaturePageMode
} from './SignatureOptions'

import SplitOptions from './SplitOptions'
import UploadZone from './UploadZone'
import WatermarkOptions from './WatermarkOptions'

type PdfWorkbenchProps = {
  activeTool: ActiveTool
}

const DEFAULT_WATERMARK_TEXT = 'CONFIDENCIAL'
const DEFAULT_WATERMARK_FONT_SIZE = 48
const DEFAULT_WATERMARK_OPACITY = 0.18
const DEFAULT_WATERMARK_ROTATION = 45

const DEFAULT_SIGNATURE_PAGE_MODE: SignaturePageMode =
  'last'

const DEFAULT_SIGNATURE_POSITION: SignaturePosition =
  'bottom-right'

const DEFAULT_SIGNATURE_WIDTH = 150
const DEFAULT_SIGNATURE_OPACITY = 1

const MAX_SIGNATURE_SIZE_BYTES =
  10 * 1024 * 1024

const DOCX_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

function isPngFile(file: File) {
  return (
    file.type === 'image/png' ||
    file.name.toLowerCase().endsWith('.png')
  )
}

function isSignatureImage(file: File) {
  return isPngFile(file) || isJpgFile(file)
}

function isDocxFile(file: File) {
  return (
    file.type === DOCX_MIME_TYPE ||
    file.name.toLowerCase().endsWith('.docx')
  )
}

export default function PdfWorkbench({
  activeTool
}: PdfWorkbenchProps) {
  const [selectedFiles, setSelectedFiles] =
    useState<SelectedPdf[]>([])

  const [splitMode, setSplitMode] =
    useState<SplitMode>('ranges')

  const [splitRanges, setSplitRanges] =
    useState('1-3')

  const [jpgQuality, setJpgQuality] =
    useState<JpgQuality>('standard')

  const [editElements, setEditElements] =
    useState<PdfEditElement[]>([])

  const [watermarkText, setWatermarkText] =
    useState(DEFAULT_WATERMARK_TEXT)

  const [
    watermarkPosition,
    setWatermarkPosition
  ] = useState<WatermarkPosition>(
    'center'
  )

  const [
    watermarkFontSize,
    setWatermarkFontSize
  ] = useState(
    DEFAULT_WATERMARK_FONT_SIZE
  )

  const [
    watermarkOpacity,
    setWatermarkOpacity
  ] = useState(
    DEFAULT_WATERMARK_OPACITY
  )

  const [
    watermarkRotation,
    setWatermarkRotation
  ] = useState(
    DEFAULT_WATERMARK_ROTATION
  )

  const [signatureFile, setSignatureFile] =
    useState<File | null>(null)

  const [
    signaturePageMode,
    setSignaturePageMode
  ] = useState<SignaturePageMode>(
    DEFAULT_SIGNATURE_PAGE_MODE
  )

  const [
    signaturePageNumber,
    setSignaturePageNumber
  ] = useState(1)

  const [
    signaturePosition,
    setSignaturePosition
  ] = useState<SignaturePosition>(
    DEFAULT_SIGNATURE_POSITION
  )

  const [
    signatureWidth,
    setSignatureWidth
  ] = useState(
    DEFAULT_SIGNATURE_WIDTH
  )

  const [
    signatureOpacity,
    setSignatureOpacity
  ] = useState(
    DEFAULT_SIGNATURE_OPACITY
  )

  const [isProcessing, setIsProcessing] =
    useState(false)

  const [
    progressMessage,
    setProgressMessage
  ] = useState('')

  const [
    errorMessage,
    setErrorMessage
  ] = useState('')

  const [result, setResult] =
    useState<ResultData | null>(null)

  const fileInputRef =
    useRef<HTMLInputElement>(null)

  const activeToolData = useMemo(
    () =>
      pdfTools.find(
        (tool) =>
          tool.activeTool === activeTool
      ),
    [activeTool]
  )

  const totalSelectedSize = useMemo(
    () =>
      selectedFiles.reduce(
        (total, selected) =>
          total + selected.file.size,
        0
      ),
    [selectedFiles]
  )

  const uploadFileType =
    activeTool === 'jpgToPdf'
      ? 'jpg'
      : activeTool === 'wordToPdf'
        ? 'docx'
        : 'pdf'

  const acceptsImages =
    uploadFileType === 'jpg'

  const acceptsWordDocument =
    uploadFileType === 'docx'

  const acceptsMultipleFiles =
    activeTool === 'merge' ||
    activeTool === 'jpgToPdf'

  const allowsReorder =
    acceptsMultipleFiles

  const resetToolOptions = () => {
    setSplitMode('ranges')
    setSplitRanges('1-3')
    setJpgQuality('standard')
    setEditElements([])

    setWatermarkText(
      DEFAULT_WATERMARK_TEXT
    )

    setWatermarkPosition('center')

    setWatermarkFontSize(
      DEFAULT_WATERMARK_FONT_SIZE
    )

    setWatermarkOpacity(
      DEFAULT_WATERMARK_OPACITY
    )

    setWatermarkRotation(
      DEFAULT_WATERMARK_ROTATION
    )

    setSignatureFile(null)

    setSignaturePageMode(
      DEFAULT_SIGNATURE_PAGE_MODE
    )

    setSignaturePageNumber(1)

    setSignaturePosition(
      DEFAULT_SIGNATURE_POSITION
    )

    setSignatureWidth(
      DEFAULT_SIGNATURE_WIDTH
    )

    setSignatureOpacity(
      DEFAULT_SIGNATURE_OPACITY
    )
  }

  const clearOperation = () => {
    setSelectedFiles([])
    resetToolOptions()
    setProgressMessage('')
    setErrorMessage('')
    setResult(null)
    setIsProcessing(false)

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  useEffect(() => {
    clearOperation()
  }, [activeTool])

  const addFiles = (files: File[]) => {
    setErrorMessage('')
    setProgressMessage('')
    setResult(null)

    const invalidFile = files.find(
      (file) => {
        if (acceptsImages) {
          return !isJpgFile(file)
        }

        if (acceptsWordDocument) {
          return !isDocxFile(file)
        }

        return !isPdfFile(file)
      }
    )

    if (invalidFile) {
      const expectedFileMessage =
        acceptsImages
          ? 'uma imagem JPG ou JPEG'
          : acceptsWordDocument
            ? 'um documento Word no formato DOCX'
            : 'um documento PDF'

      setErrorMessage(
        `O ficheiro "${invalidFile.name}" não parece ser ${expectedFileMessage}.`
      )

      return
    }

    const oversizedFile = files.find(
      (file) =>
        file.size > MAX_FILE_SIZE_BYTES
    )

    if (oversizedFile) {
      setErrorMessage(
        `O ficheiro "${oversizedFile.name}" ultrapassa o limite recomendado de 100 MB.`
      )

      return
    }

    const acceptedFiles =
      acceptsMultipleFiles
        ? files
        : files.slice(0, 1)

    setSelectedFiles(
      (currentFiles) => {
        if (!acceptsMultipleFiles) {
          const file =
            acceptedFiles[0]

          return file
            ? [
                {
                  id: createFileId(file),
                  file
                }
              ]
            : currentFiles
        }

        const existingSignatures =
          new Set(
            currentFiles.map(
              (item) =>
                `${item.file.name}-${item.file.size}-${item.file.lastModified}`
            )
          )

        const newFiles =
          acceptedFiles
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

        return [
          ...currentFiles,
          ...newFiles
        ]
      }
    )
  }

  const removeFile = (id: string) => {
    setSelectedFiles(
      (currentFiles) =>
        currentFiles.filter(
          (item) =>
            item.id !== id
        )
    )

    setResult(null)
    setProgressMessage('')
    setErrorMessage('')
  }

  const moveFile = (
    index: number,
    direction: -1 | 1
  ) => {
    setSelectedFiles(
      (currentFiles) => {
        const destination =
          index + direction

        if (
          destination < 0 ||
          destination >=
            currentFiles.length
        ) {
          return currentFiles
        }

        const reordered = [
          ...currentFiles
        ]

        const [movedItem] =
          reordered.splice(
            index,
            1
          )

        reordered.splice(
          destination,
          0,
          movedItem
        )

        return reordered
      }
    )
  }

  const handleSignatureFileChange = (
    file: File | null
  ) => {
    setErrorMessage('')
    setResult(null)
    setProgressMessage('')

    if (!file) {
      setSignatureFile(null)
      return
    }

    if (!isSignatureImage(file)) {
      setSignatureFile(null)

      setErrorMessage(
        'A assinatura deve estar num ficheiro PNG, JPG ou JPEG.'
      )

      return
    }

    if (
      file.size >
      MAX_SIGNATURE_SIZE_BYTES
    ) {
      setSignatureFile(null)

      setErrorMessage(
        'A imagem da assinatura ultrapassa o limite de 10 MB.'
      )

      return
    }

    if (file.size === 0) {
      setSignatureFile(null)

      setErrorMessage(
        'O ficheiro da assinatura está vazio.'
      )

      return
    }

    setSignatureFile(file)
  }

  const processCurrentTool =
    async () => {
      if (isProcessing) {
        return
      }

      setIsProcessing(true)
      setErrorMessage('')
      setProgressMessage('')
      setResult(null)

      try {
        let generatedResult: ResultData

        if (
          activeTool === 'merge'
        ) {
          generatedResult =
            await mergePdfFiles(
              selectedFiles,
              setProgressMessage
            )
        } else if (
          activeTool === 'split'
        ) {
          generatedResult =
            await splitPdfFile(
              selectedFiles[0],
              splitMode,
              splitRanges,
              setProgressMessage
            )
        } else if (
          activeTool === 'compress'
        ) {
          generatedResult =
            await compressPdfFile(
              selectedFiles[0],
              setProgressMessage
            )
        } else if (
          activeTool === 'pdfToWord'
        ) {
          generatedResult =
            await convertPdfToWord(
              selectedFiles[0],
              setProgressMessage
            )
        } else if (
          activeTool === 'wordToPdf'
        ) {
          generatedResult =
            await convertWordToPdf(
              selectedFiles[0],
              setProgressMessage
            )
        } else if (
          activeTool === 'pdfToDoc'
        ) {
          generatedResult =
            await convertPdfToDoc(
              selectedFiles[0],
              setProgressMessage
            )
        } else if (
          activeTool === 'pdfToExcel'
        ) {
          generatedResult =
            await convertPdfToExcel(
              selectedFiles[0],
              setProgressMessage
            )
        } else if (
          activeTool === 'pdfToJpg'
        ) {
          generatedResult =
            await convertPdfToJpg(
              selectedFiles[0],
              jpgQuality,
              setProgressMessage
            )
        } else if (
          activeTool === 'jpgToPdf'
        ) {
          generatedResult =
            await convertJpgToPdf(
              selectedFiles,
              setProgressMessage
            )
        } else if (
          activeTool === 'editPdf'
        ) {
          generatedResult =
            await editPdf(
              selectedFiles[0],
              {
                elements:
                  editElements
              },
              setProgressMessage
            )
        } else if (
          activeTool === 'watermark'
        ) {
          generatedResult =
            await addWatermarkToPdf(
              selectedFiles[0],
              {
                text:
                  watermarkText,
                position:
                  watermarkPosition,
                fontSize:
                  watermarkFontSize,
                opacity:
                  watermarkOpacity,
                rotation:
                  watermarkRotation
              },
              setProgressMessage
            )
        } else if (
          activeTool === 'sign'
        ) {
          if (!signatureFile) {
            throw new Error(
              'Escolha uma imagem PNG, JPG ou JPEG com a assinatura.'
            )
          }

          generatedResult =
            await signPdf(
              selectedFiles[0],
              {
                signatureFile,
                page:
                  signaturePageMode ===
                  'custom'
                    ? signaturePageNumber
                    : signaturePageMode,
                position:
                  signaturePosition,
                width:
                  signatureWidth,
                opacity:
                  signatureOpacity
              },
              setProgressMessage
            )
        } else {
          throw new Error(
            'Esta ferramenta ainda não está disponível.'
          )
        }

        setResult(
          generatedResult
        )

        setProgressMessage(
          'Processamento concluído.'
        )
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Não foi possível processar este documento.'

        const normalizedMessage =
          message.toLowerCase()

        if (
          normalizedMessage.includes(
            'encrypted'
          ) ||
          normalizedMessage.includes(
            'password'
          ) ||
          normalizedMessage.includes(
            'palavra-passe'
          )
        ) {
          setErrorMessage(
            'Este PDF está protegido por palavra-passe. Remova a proteção antes de utilizar a ferramenta.'
          )
        } else if (
          activeTool === 'jpgToPdf'
        ) {
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
        : activeTool === 'editPdf'
          ? selectedFiles.length === 1 &&
            editElements.length > 0
          : activeTool === 'watermark'
            ? selectedFiles.length === 1 &&
              watermarkText.trim().length >
                0
            : activeTool === 'sign'
              ? selectedFiles.length === 1 &&
                signatureFile !== null
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
          : activeTool === 'pdfToWord'
            ? 'Converter PDF para Word'
            : activeTool === 'wordToPdf'
              ? 'Converter Word para PDF'
              : activeTool === 'pdfToDoc'
                ? 'Converter PDF para DOC'
                : activeTool ===
                    'pdfToExcel'
                  ? 'Converter PDF para Excel'
                  : activeTool ===
                      'pdfToJpg'
                    ? 'Converter PDF para JPG'
                    : activeTool ===
                        'jpgToPdf'
                      ? 'Converter imagens para PDF'
                      : activeTool ===
                          'editPdf'
                        ? 'Criar PDF editado'
                        : activeTool ===
                            'watermark'
                          ? 'Adicionar marca de água'
                          : activeTool ===
                              'sign'
                            ? 'Assinar documento PDF'
                            : 'Processar documento'

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
                    accentClasses[
                      activeToolData?.accent ||
                        'cyan'
                    ]
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
                    {
                      activeToolData?.description
                    }
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.08] px-4 py-3 text-sm text-emerald-100">
                Gratuito · Sem upload para
                servidores
              </div>
            </div>
          </div>

          <div className="p-5 md:p-7">
            <UploadZone
              multiple={
                acceptsMultipleFiles
              }
              fileType={
                uploadFileType
              }
              inputRef={
                fileInputRef
              }
              onFiles={
                addFiles
              }
            />

            <SelectedFilesList
              files={
                selectedFiles
              }
              allowReorder={
                allowsReorder
              }
              fileBadge={
                acceptsImages
                  ? 'JPG'
                  : acceptsWordDocument
                    ? 'DOCX'
                    : 'PDF'
              }
              onRemove={
                removeFile
              }
              onMove={
                moveFile
              }
            />

            {activeTool === 'merge' &&
            selectedFiles.length > 0 ? (
              <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-300">
                Os documentos serão unidos
                pela ordem apresentada acima.
                Utilize as setas para alterar
                a ordem.
              </div>
            ) : null}

            {activeTool === 'split' &&
            selectedFiles.length === 1 ? (
              <SplitOptions
                splitMode={
                  splitMode
                }
                splitRanges={
                  splitRanges
                }
                onModeChange={
                  setSplitMode
                }
                onRangesChange={
                  setSplitRanges
                }
              />
            ) : null}

            {activeTool === 'compress' &&
            selectedFiles.length === 1 ? (
              <CompressInfo />
            ) : null}

            {activeTool === 'pdfToJpg' &&
            selectedFiles.length === 1 ? (
              <PdfToJpgOptions
                jpgQuality={
                  jpgQuality
                }
                onQualityChange={
                  setJpgQuality
                }
              />
            ) : null}

            {activeTool === 'jpgToPdf' &&
            selectedFiles.length > 0 ? (
              <JpgToPdfInfo />
            ) : null}

            {activeTool === 'pdfToWord' &&
            selectedFiles.length === 1 ? (
              <div className="mt-5 rounded-2xl border border-blue-300/15 bg-blue-300/[0.05] p-4 text-sm leading-6 text-blue-50/85">
                O texto selecionável será
                extraído para um ficheiro DOCX
                editável. PDFs digitalizados
                apenas como imagem podem
                necessitar de OCR.
              </div>
            ) : null}

            {activeTool === 'wordToPdf' &&
            selectedFiles.length === 1 ? (
              <div className="mt-5 rounded-2xl border border-blue-300/15 bg-blue-300/[0.05] p-4 text-sm leading-6 text-blue-50/85">
                O conversor aceita documentos
                DOCX e preserva texto,
                parágrafos e formatação
                básica. Tabelas complexas,
                imagens e paginação podem
                apresentar diferenças.
              </div>
            ) : null}

            {activeTool === 'pdfToDoc' &&
            selectedFiles.length === 1 ? (
              <div className="mt-5 rounded-2xl border border-blue-300/15 bg-blue-300/[0.05] p-4 text-sm leading-6 text-blue-50/85">
                O texto selecionável será
                extraído para um ficheiro DOC
                editável e compatível com o
                Microsoft Word. PDFs apenas
                com imagem podem necessitar
                de OCR.
              </div>
            ) : null}

            {activeTool === 'pdfToExcel' &&
            selectedFiles.length === 1 ? (
              <div className="mt-5 rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.05] p-4 text-sm leading-6 text-emerald-50/85">
                Cada página do PDF será criada
                como uma folha do Excel. O
                conversor tenta separar linhas
                e colunas a partir da posição
                do texto selecionável; tabelas
                complexas podem precisar de
                pequenos ajustes.
              </div>
            ) : null}

            {activeTool === 'editPdf' &&
            selectedFiles.length === 1 ? (
              <EditPdfOptions
                elements={
                  editElements
                }
                onElementsChange={
                  setEditElements
                }
              />
            ) : null}

            {activeTool === 'watermark' &&
            selectedFiles.length === 1 ? (
              <WatermarkOptions
                text={
                  watermarkText
                }
                position={
                  watermarkPosition
                }
                fontSize={
                  watermarkFontSize
                }
                opacity={
                  watermarkOpacity
                }
                rotation={
                  watermarkRotation
                }
                onTextChange={
                  setWatermarkText
                }
                onPositionChange={
                  setWatermarkPosition
                }
                onFontSizeChange={
                  setWatermarkFontSize
                }
                onOpacityChange={
                  setWatermarkOpacity
                }
                onRotationChange={
                  setWatermarkRotation
                }
              />
            ) : null}

            {activeTool === 'sign' &&
            selectedFiles.length === 1 ? (
              <SignatureOptions
                signatureFile={
                  signatureFile
                }
                pageMode={
                  signaturePageMode
                }
                pageNumber={
                  signaturePageNumber
                }
                position={
                  signaturePosition
                }
                width={
                  signatureWidth
                }
                opacity={
                  signatureOpacity
                }
                onFileChange={
                  handleSignatureFileChange
                }
                onPageModeChange={
                  setSignaturePageMode
                }
                onPageNumberChange={
                  setSignaturePageNumber
                }
                onPositionChange={
                  setSignaturePosition
                }
                onWidthChange={
                  setSignatureWidth
                }
                onOpacityChange={
                  setSignatureOpacity
                }
              />
            ) : null}

            {selectedFiles.length > 0 ? (
              <div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-400">
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2">
                  {selectedFiles.length}{' '}
                  ficheiro
                  {selectedFiles.length === 1
                    ? ''
                    : 's'}
                </span>

                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2">
                  {formatFileSize(
                    totalSelectedSize
                  )}
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

            {isProcessing ||
            progressMessage ? (
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
                onClick={
                  processCurrentTool
                }
                disabled={
                  !canProcess ||
                  isProcessing
                }
                className="btn-primary hightech-button mt-6 w-full disabled:cursor-not-allowed disabled:opacity-40"
                aria-busy={
                  isProcessing
                }
              >
                <span className="btn-shine" />

                <span className="relative z-10">
                  {isProcessing
                    ? 'A processar...'
                    : buttonText}
                </span>
              </button>
            ) : (
              <ResultCard
                result={
                  result
                }
                onReset={
                  clearOperation
                }
              />
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
