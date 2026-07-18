import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode
} from 'react'

import {
  createAutomaticMask,
  createExportBlob,
  createPolygonMask,
  loadEditorImage,
  paintMask,
  renderEditorCanvas,
  renderPolygonSelectionCanvas,
  softenMask,
  type BrushMode,
  type EditorImage,
  type EditorPoint,
  type PixelMask
} from '../lib/maRecortes/imageEditor'

const siteUrl =
  'https://ma-code.pt'

const watermarkText =
  'MA-CODE.PT'

const acceptedTypes = [
  'image/jpeg',
  'image/png',
  'image/webp'
]

type EditorStartMode =
  | 'automatic'
  | 'manual'

type EditorStage =
  | 'select'
  | 'adjust'

type Notice =
  | {
      type:
        | 'success'
        | 'error'
        | 'info'
      text: string
    }
  | null

function updateMeta(
  name: string,
  content: string
) {
  let meta =
    document.querySelector<HTMLMetaElement>(
      `meta[name="${name}"]`
    )

  if (!meta) {
    meta =
      document.createElement(
        'meta'
      )

    meta.name = name

    document.head.appendChild(
      meta
    )
  }

  meta.content = content
}

function updatePropertyMeta(
  property: string,
  content: string
) {
  let meta =
    document.querySelector<HTMLMetaElement>(
      `meta[property="${property}"]`
    )

  if (!meta) {
    meta =
      document.createElement(
        'meta'
      )

    meta.setAttribute(
      'property',
      property
    )

    document.head.appendChild(
      meta
    )
  }

  meta.content = content
}

function updateCanonical(
  href: string
) {
  let canonical =
    document.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]'
    )

  if (!canonical) {
    canonical =
      document.createElement(
        'link'
      )

    canonical.rel =
      'canonical'

    document.head.appendChild(
      canonical
    )
  }

  canonical.href = href
}

function updateStructuredData(
  id: string,
  data: unknown
) {
  let script =
    document.querySelector<HTMLScriptElement>(
      `script[data-schema-id="${id}"]`
    )

  if (!script) {
    script =
      document.createElement(
        'script'
      )

    script.type =
      'application/ld+json'

    script.dataset.schemaId =
      id

    document.head.appendChild(
      script
    )
  }

  script.textContent =
    JSON.stringify(data)
}

function downloadBlob(
  blob: Blob,
  fileName: string
) {
  const url =
    URL.createObjectURL(
      blob
    )

  const link =
    document.createElement(
      'a'
    )

  link.href = url
  link.download =
    fileName

  document.body.appendChild(
    link
  )

  link.click()
  link.remove()

  window.setTimeout(
    () => {
      URL.revokeObjectURL(
        url
      )
    },
    500
  )
}

function loadImageFromBlob(
  blob: Blob
): Promise<HTMLImageElement> {
  return new Promise(
    (
      resolve,
      reject
    ) => {
      const url =
        URL.createObjectURL(
          blob
        )

      const image =
        new Image()

      image.onload =
        () => {
          URL.revokeObjectURL(
            url
          )

          resolve(
            image
          )
        }

      image.onerror =
        () => {
          URL.revokeObjectURL(
            url
          )

          reject(
            new Error(
              'Não foi possível preparar a marca de água.'
            )
          )
        }

      image.src = url
    }
  )
}

function canvasToPngBlob(
  canvas: HTMLCanvasElement
): Promise<Blob> {
  return new Promise(
    (
      resolve,
      reject
    ) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(
              new Error(
                'Não foi possível criar o PNG final.'
              )
            )

            return
          }

          resolve(
            blob
          )
        },
        'image/png'
      )
    }
  )
}

function drawRoundedRectangle(
  context:
    CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const safeRadius =
    Math.min(
      radius,
      width / 2,
      height / 2
    )

  context.beginPath()

  context.moveTo(
    x + safeRadius,
    y
  )

  context.lineTo(
    x +
      width -
      safeRadius,
    y
  )

  context.quadraticCurveTo(
    x + width,
    y,
    x + width,
    y + safeRadius
  )

  context.lineTo(
    x + width,
    y +
      height -
      safeRadius
  )

  context.quadraticCurveTo(
    x + width,
    y + height,
    x +
      width -
      safeRadius,
    y + height
  )

  context.lineTo(
    x + safeRadius,
    y + height
  )

  context.quadraticCurveTo(
    x,
    y + height,
    x,
    y +
      height -
      safeRadius
  )

  context.lineTo(
    x,
    y + safeRadius
  )

  context.quadraticCurveTo(
    x,
    y,
    x + safeRadius,
    y
  )

  context.closePath()
}

async function addWatermarkToPngBlob(
  blob: Blob
): Promise<Blob> {
  const image =
    await loadImageFromBlob(
      blob
    )

  const canvas =
    document.createElement(
      'canvas'
    )

  const width =
    image.naturalWidth ||
    image.width

  const height =
    image.naturalHeight ||
    image.height

  canvas.width = width
  canvas.height = height

  const context =
    canvas.getContext(
      '2d'
    )

  if (!context) {
    throw new Error(
      'Não foi possível preparar a imagem final.'
    )
  }

  context.clearRect(
    0,
    0,
    width,
    height
  )

  context.drawImage(
    image,
    0,
    0,
    width,
    height
  )

  const shortestSide =
    Math.min(
      width,
      height
    )

  const fontSize =
    Math.max(
      18,
      Math.round(
        shortestSide *
          0.042
      )
    )

  const horizontalPadding =
    Math.max(
      10,
      Math.round(
        fontSize *
          0.6
      )
    )

  const verticalPadding =
    Math.max(
      6,
      Math.round(
        fontSize *
          0.38
      )
    )

  const outerMargin =
    Math.max(
      10,
      Math.round(
        shortestSide *
          0.025
      )
    )

  context.save()

  context.font =
    `800 ${fontSize}px Arial, Helvetica, sans-serif`

  const textMetrics =
    context.measureText(
      watermarkText
    )

  const textWidth =
    Math.ceil(
      textMetrics.width
    )

  const boxWidth =
    textWidth +
    horizontalPadding * 2

  const boxHeight =
    fontSize +
    verticalPadding * 2

  const boxX =
    Math.max(
      outerMargin,
      width -
        boxWidth -
        outerMargin
    )

  const boxY =
    Math.max(
      outerMargin,
      height -
        boxHeight -
        outerMargin
    )

  const boxRadius =
    Math.max(
      6,
      Math.round(
        boxHeight *
          0.28
      )
    )

  drawRoundedRectangle(
    context,
    boxX,
    boxY,
    boxWidth,
    boxHeight,
    boxRadius
  )

  context.fillStyle =
    'rgba(2, 6, 23, 0.88)'

  context.fill()

  context.lineWidth =
    Math.max(
      1,
      Math.round(
        fontSize *
          0.07
      )
    )

  context.strokeStyle =
    'rgba(255, 255, 255, 0.75)'

  context.stroke()

  context.font =
    `800 ${fontSize}px Arial, Helvetica, sans-serif`

  context.textAlign =
    'center'

  context.textBaseline =
    'middle'

  context.fillStyle =
    '#ffffff'

  context.shadowColor =
    'rgba(0, 0, 0, 0.75)'

  context.shadowBlur =
    Math.max(
      2,
      Math.round(
        fontSize *
          0.12
      )
    )

  context.fillText(
    watermarkText,
    boxX +
      boxWidth / 2,
    boxY +
      boxHeight / 2 +
      Math.round(
        fontSize *
          0.03
      )
  )

  context.restore()

  return canvasToPngBlob(
    canvas
  )
}

function ToolButton({
  active,
  title,
  description,
  onClick
}: {
  active: boolean
  title: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border px-4 py-3 text-left transition ${
        active
          ? 'border-cyan-200/55 bg-cyan-300/15 text-white shadow-lg shadow-cyan-950/30'
          : 'border-white/10 bg-white/[0.035] text-slate-200 hover:border-cyan-200/30 hover:bg-cyan-300/[0.07]'
      }`}
    >
      <span className="block text-sm font-semibold">
        {title}
      </span>

      <span className="mt-1 block text-xs leading-5 text-slate-400">
        {description}
      </span>
    </button>
  )
}

function InstructionStep({
  number,
  children
}: {
  number: number
  children: ReactNode
}) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-cyan-300/25 bg-cyan-300/10 text-xs font-bold text-cyan-100">
        {number}
      </span>

      <span className="pt-0.5">
        {children}
      </span>
    </li>
  )
}

export default function MARecortesPage() {
  const [
    mounted,
    setMounted
  ] = useState(false)

  const [
    editor,
    setEditor
  ] =
    useState<EditorImage | null>(
      null
    )

  const [
    mask,
    setMask
  ] =
    useState<PixelMask | null>(
      null
    )

  const [
    originalMask,
    setOriginalMask
  ] =
    useState<PixelMask | null>(
      null
    )

  const [
    selectionPoints,
    setSelectionPoints
  ] = useState<EditorPoint[]>(
    []
  )

  const [
    editorStage,
    setEditorStage
  ] =
    useState<EditorStage>(
      'adjust'
    )

  const [
    startMode,
    setStartMode
  ] =
    useState<EditorStartMode>(
      'manual'
    )

  const [
    brushMode,
    setBrushMode
  ] =
    useState<BrushMode>(
      'restore'
    )

  const [
    brushSize,
    setBrushSize
  ] = useState(42)

  const [
    tolerance,
    setTolerance
  ] = useState(72)

  const [
    softness,
    setSoftness
  ] = useState(1)

  const [
    outlineSize,
    setOutlineSize
  ] = useState(0)

  const [
    zoom,
    setZoom
  ] = useState(1)

  const [
    processing,
    setProcessing
  ] = useState(false)

  const [
    notice,
    setNotice
  ] =
    useState<Notice>(
      null
    )

  const [
    history,
    setHistory
  ] = useState<PixelMask[]>(
    []
  )

  const [
    isPainting,
    setIsPainting
  ] = useState(false)

  const [
    stickerCopied,
    setStickerCopied
  ] = useState(false)

  const fileInputRef =
    useRef<HTMLInputElement>(
      null
    )

  const canvasRef =
    useRef<HTMLCanvasElement>(
      null
    )

  const lastPaintPointRef =
    useRef<EditorPoint | null>(
      null
    )

  useEffect(() => {
    setMounted(true)

    document.title =
      'MA-Recortes | Criar stickers para WhatsApp'

    updateMeta(
      'description',
      'Crie imagens preparadas para stickers do WhatsApp: selecione uma fotografia por pontos, corrija o recorte e copie o sticker diretamente.'
    )

    updateMeta(
      'keywords',
      'criar sticker WhatsApp, recortar imagem, copiar sticker, remover fundo, PNG transparente, MA-Recortes, MA-Code'
    )

    updateMeta(
      'robots',
      'index, follow, max-image-preview:large'
    )

    updatePropertyMeta(
      'og:type',
      'website'
    )

    updatePropertyMeta(
      'og:locale',
      'pt_PT'
    )

    updatePropertyMeta(
      'og:site_name',
      'MA-Code'
    )

    updatePropertyMeta(
      'og:url',
      `${siteUrl}/produtos/ma-recortes`
    )

    updatePropertyMeta(
      'og:title',
      'MA-Recortes | Criar stickers para WhatsApp'
    )

    updatePropertyMeta(
      'og:description',
      'Selecione fotografias por pontos, ajuste as margens e copie o recorte diretamente para o WhatsApp.'
    )

    updatePropertyMeta(
      'og:image',
      `${siteUrl}/ma-code.png`
    )

    updateMeta(
      'twitter:card',
      'summary_large_image'
    )

    updateMeta(
      'twitter:title',
      'MA-Recortes | Criar stickers para WhatsApp'
    )

    updateMeta(
      'twitter:description',
      'Selecione, corrija e copie imagens transparentes preparadas para stickers.'
    )

    updateMeta(
      'twitter:image',
      `${siteUrl}/ma-code.png`
    )

    updateCanonical(
      `${siteUrl}/produtos/ma-recortes`
    )

    updateStructuredData(
      'ma-recortes-app',
      {
        '@context':
          'https://schema.org',
        '@type':
          'SoftwareApplication',
        name:
          'MA-Recortes',
        applicationCategory:
          'MultimediaApplication',
        operatingSystem:
          'Web',
        url:
          `${siteUrl}/produtos/ma-recortes`,
        description:
          'Aplicação web para selecionar e recortar imagens manualmente, corrigir margens e copiar PNG transparentes preparados para stickers.',
        offers: {
          '@type':
            'Offer',
          price: '0',
          priceCurrency:
            'EUR'
        }
      }
    )
  }, [])

  useEffect(() => {
    if (
      !editor ||
      !canvasRef.current
    ) {
      return
    }

    if (
      editorStage ===
      'select'
    ) {
      renderPolygonSelectionCanvas(
        canvasRef.current,
        editor,
        selectionPoints
      )

      return
    }

    if (!mask) {
      return
    }

    renderEditorCanvas(
      canvasRef.current,
      editor,
      mask,
      outlineSize
    )
  }, [
    editor,
    mask,
    outlineSize,
    editorStage,
    selectionPoints
  ])

  useEffect(() => {
    setStickerCopied(
      false
    )
  }, [
    editor,
    mask,
    outlineSize
  ])

  const startEditor =
    useCallback(
      async (
        file: File
      ) => {
        if (
          !acceptedTypes.includes(
            file.type
          )
        ) {
          setNotice({
            type: 'error',
            text:
              'Escolha uma imagem JPG, PNG ou WebP.'
          })

          return
        }

        if (
          file.size >
          20 *
            1024 *
            1024
        ) {
          setNotice({
            type: 'error',
            text:
              'A imagem não pode ultrapassar 20 MB.'
          })

          return
        }

        setProcessing(true)

        setNotice({
          type: 'info',
          text:
            'A preparar a fotografia…'
        })

        try {
          const nextEditor =
            await loadEditorImage(
              file
            )

          setEditor(
            nextEditor
          )

          setZoom(1)
          setHistory([])
          setSelectionPoints([])
          setStickerCopied(
            false
          )

          if (
            startMode ===
            'automatic'
          ) {
            const nextMask =
              createAutomaticMask(
                nextEditor,
                tolerance
              )

            setMask(
              nextMask
            )

            setOriginalMask(
              nextMask.slice()
            )

            setEditorStage(
              'adjust'
            )

            setBrushMode(
              'restore'
            )

            setNotice({
              type:
                'success',
              text:
                'Recorte automático concluído. Use “Restaurar” para recuperar partes apagadas e “Remover” para limpar o fundo.'
            })
          } else {
            setMask(null)

            setOriginalMask(
              null
            )

            setEditorStage(
              'select'
            )

            setBrushMode(
              'restore'
            )

            setNotice({
              type: 'info',
              text:
                'Toque em vários pontos à volta da pessoa ou objeto. No final, toque novamente no primeiro ponto amarelo para fechar a seleção.'
            })
          }
        } catch (
          error
        ) {
          setNotice({
            type: 'error',
            text:
              error instanceof
              Error
                ? error.message
                : 'Não foi possível abrir a imagem.'
          })
        } finally {
          setProcessing(false)
        }
      },
      [
        startMode,
        tolerance
      ]
    )

  const handleFileChange =
    (
      event:
        ChangeEvent<HTMLInputElement>
    ) => {
      const file =
        event.target
          .files?.[0]

      event.target.value =
        ''

      if (file) {
        void startEditor(
          file
        )
      }
    }

  const getCanvasPoint =
    (
      event:
        ReactPointerEvent<HTMLCanvasElement>
    ): EditorPoint => {
      const canvas =
        event.currentTarget

      const rectangle =
        canvas.getBoundingClientRect()

      return {
        x:
          (
            event.clientX -
            rectangle.left
          ) /
          rectangle.width *
          canvas.width,
        y:
          (
            event.clientY -
            rectangle.top
          ) /
          rectangle.height *
          canvas.height
      }
    }

  const finishPolygonSelection =
    (
      points =
        selectionPoints
    ) => {
      if (
        !editor ||
        points.length < 3
      ) {
        setNotice({
          type: 'error',
          text:
            'Marque pelo menos três pontos antes de fechar a seleção.'
        })

        return
      }

      try {
        const nextMask =
          createPolygonMask(
            editor.width,
            editor.height,
            points
          )

        setMask(
          nextMask
        )

        setOriginalMask(
          nextMask.slice()
        )

        setHistory([])

        setEditorStage(
          'adjust'
        )

        setZoom(1)

        setBrushMode(
          'restore'
        )

        setNotice({
          type:
            'success',
          text:
            'Seleção fechada. Tudo o que ficou fora foi removido. Use “Restaurar” para recuperar margens e “Remover” para limpar excessos.'
        })
      } catch (
        error
      ) {
        setNotice({
          type: 'error',
          text:
            error instanceof
            Error
              ? error.message
              : 'Não foi possível criar o recorte.'
        })
      }
    }

  const handleSelectionPoint =
    (
      event:
        ReactPointerEvent<HTMLCanvasElement>
    ) => {
      if (
        !editor ||
        editorStage !==
          'select'
      ) {
        return
      }

      const point =
        getCanvasPoint(
          event
        )

      if (
        selectionPoints.length >=
        3
      ) {
        const firstPoint =
          selectionPoints[0]

        const closeDistance =
          Math.max(
            18,
            Math.min(
              editor.width,
              editor.height
            ) * 0.035
          )

        const distanceToStart =
          Math.hypot(
            point.x -
              firstPoint.x,
            point.y -
              firstPoint.y
          )

        if (
          distanceToStart <=
          closeDistance
        ) {
          finishPolygonSelection()

          return
        }
      }

      setSelectionPoints(
        (
          currentPoints
        ) => [
          ...currentPoints,
          point
        ]
      )
    }

  const undoSelectionPoint =
    () => {
      setSelectionPoints(
        (
          currentPoints
        ) =>
          currentPoints.slice(
            0,
            -1
          )
      )

      setNotice({
        type: 'info',
        text:
          'Último ponto removido.'
      })
    }

  const clearSelectionPoints =
    () => {
      setSelectionPoints([])

      setNotice({
        type: 'info',
        text:
          'Seleção limpa. Comece novamente a marcar o contorno.'
      })
    }

  const restartManualSelection =
    () => {
      setMask(null)
      setOriginalMask(null)
      setHistory([])
      setSelectionPoints([])
      setZoom(1)

      setEditorStage(
        'select'
      )

      setNotice({
        type: 'info',
        text:
          'Marque novamente os pontos à volta da pessoa ou objeto e toque no primeiro ponto para fechar.'
      })
    }

  const rerunAutomaticCut =
    () => {
      if (!editor) {
        return
      }

      setProcessing(true)

      window.setTimeout(
        () => {
          try {
            const nextMask =
              createAutomaticMask(
                editor,
                tolerance
              )

            setMask(
              nextMask
            )

            setOriginalMask(
              nextMask.slice()
            )

            setHistory([])

            setEditorStage(
              'adjust'
            )

            setZoom(1)

            setNotice({
              type:
                'success',
              text:
                'O recorte automático foi recalculado. Corrija agora as margens com os pincéis.'
            })
          } catch (
            error
          ) {
            setNotice({
              type:
                'error',
              text:
                error instanceof
                Error
                  ? error.message
                  : 'Não foi possível recalcular o recorte.'
            })
          } finally {
            setProcessing(false)
          }
        },
        20
      )
    }

  const applyPaintPoint =
    (
      point:
        EditorPoint
    ) => {
      if (!editor) {
        return
      }

      setMask(
        (
          currentMask
        ) => {
          if (
            !currentMask
          ) {
            return currentMask
          }

          const previousPoint =
            lastPaintPointRef.current

          const nextMask =
            currentMask.slice()

          const distance =
            previousPoint
              ? Math.hypot(
                  point.x -
                    previousPoint.x,
                  point.y -
                    previousPoint.y
                )
              : 0

          const steps =
            Math.max(
              1,
              Math.ceil(
                distance /
                  Math.max(
                    2,
                    brushSize /
                      4
                  )
              )
            )

          for (
            let step = 1;
            step <= steps;
            step += 1
          ) {
            const ratio =
              step /
              steps

            const x =
              previousPoint
                ? previousPoint.x +
                  (
                    point.x -
                    previousPoint.x
                  ) *
                    ratio
                : point.x

            const y =
              previousPoint
                ? previousPoint.y +
                  (
                    point.y -
                    previousPoint.y
                  ) *
                    ratio
                : point.y

            paintMask(
              nextMask,
              editor.width,
              editor.height,
              x,
              y,
              brushSize,
              brushMode
            )
          }

          return nextMask
        }
      )

      lastPaintPointRef.current =
        point
    }

  const handlePointerDown =
    (
      event:
        ReactPointerEvent<HTMLCanvasElement>
    ) => {
      if (
        processing ||
        !editor
      ) {
        return
      }

      if (
        editorStage ===
        'select'
      ) {
        handleSelectionPoint(
          event
        )

        return
      }

      if (!mask) {
        return
      }

      event.currentTarget.setPointerCapture(
        event.pointerId
      )

      setHistory(
        (current) => [
          ...current.slice(
            -7
          ),
          mask.slice()
        ]
      )

      setIsPainting(true)

      lastPaintPointRef.current =
        null

      applyPaintPoint(
        getCanvasPoint(
          event
        )
      )
    }

  const handlePointerMove =
    (
      event:
        ReactPointerEvent<HTMLCanvasElement>
    ) => {
      if (
        !isPainting ||
        editorStage !==
          'adjust'
      ) {
        return
      }

      applyPaintPoint(
        getCanvasPoint(
          event
        )
      )
    }

  const stopPainting =
    () => {
      setIsPainting(false)

      lastPaintPointRef.current =
        null
    }

  const undo =
    () => {
      const previous =
        history[
          history.length -
            1
        ]

      if (!previous) {
        return
      }

      setMask(
        previous
      )

      setHistory(
        (current) =>
          current.slice(
            0,
            -1
          )
      )

      setNotice({
        type: 'info',
        text:
          'Última correção anulada.'
      })
    }

  const resetMask =
    () => {
      if (!originalMask) {
        return
      }

      setMask(
        originalMask.slice()
      )

      setHistory([])

      setNotice({
        type: 'info',
        text:
          'O recorte regressou ao estado inicial.'
      })
    }

  const applySoftness =
    () => {
      if (
        !editor ||
        !mask
      ) {
        return
      }

      setHistory(
        (current) => [
          ...current.slice(
            -7
          ),
          mask.slice()
        ]
      )

      setMask(
        softenMask(
          mask,
          editor.width,
          editor.height,
          softness
        )
      )

      setNotice({
        type:
          'success',
        text:
          'As margens do recorte foram suavizadas.'
      })
    }

  const exportPng =
    async () => {
      if (
        !editor ||
        !mask
      ) {
        return
      }

      setProcessing(true)

      setNotice({
        type: 'info',
        text:
          'A criar o PNG transparente com a marca MA-CODE.PT…'
      })

      try {
        const originalBlob =
          await createExportBlob(
            editor,
            mask,
            {
              whatsapp:
                false,
              outlineSize
            }
          )

        const brandedBlob =
          await addWatermarkToPngBlob(
            originalBlob
          )

        downloadBlob(
          brandedBlob,
          'ma-recortes.png'
        )

        setNotice({
          type:
            'success',
          text:
            'PNG transparente descarregado com a marca MA-CODE.PT.'
        })
      } catch (
        error
      ) {
        setNotice({
          type:
            'error',
          text:
            error instanceof
            Error
              ? error.message
              : 'Não foi possível exportar o recorte.'
        })
      } finally {
        setProcessing(false)
      }
    }

  const copySticker =
    async () => {
      if (
        !editor ||
        !mask
      ) {
        return
      }

      if (
        typeof ClipboardItem ===
          'undefined' ||
        !navigator.clipboard ||
        typeof navigator.clipboard
          .write !==
          'function'
      ) {
        setNotice({
          type:
            'error',
          text:
            'Este navegador não permite copiar imagens. Abra a MA-Recortes numa versão atualizada do Safari ou Chrome.'
        })

        return
      }

      setProcessing(true)
      setStickerCopied(false)

      setNotice({
        type: 'info',
        text:
          'A preparar e copiar o sticker…'
      })

      try {
        const stickerBlobPromise =
          createExportBlob(
            editor,
            mask,
            {
              whatsapp:
                true,
              outlineSize
            }
          ).then(
            (
              originalBlob
            ) =>
              addWatermarkToPngBlob(
                originalBlob
              )
          )

        const clipboardItem =
          new ClipboardItem({
            'image/png':
              stickerBlobPromise
          })

        await navigator.clipboard.write(
          [
            clipboardItem
          ]
        )

        setStickerCopied(
          true
        )

        setNotice({
          type:
            'success',
          text:
            'Sticker copiado. Abra o WhatsApp, mantenha premido no campo da mensagem e toque em “Colar”.'
        })
      } catch (
        error
      ) {
        setNotice({
          type:
            'error',
          text:
            error instanceof
            Error
              ? `Não foi possível copiar o sticker: ${error.message}`
              : 'Não foi possível copiar o sticker. Confirme que autorizou o acesso à área de transferência.'
        })
      } finally {
        setProcessing(false)
      }
    }

  const openWhatsapp =
    () => {
      setNotice({
        type: 'info',
        text:
          'Abra uma conversa, mantenha premido no campo da mensagem, toque em “Colar” e envie.'
      })

      window.location.href =
        'whatsapp://send'
    }

  const clearEditor =
    () => {
      setEditor(null)
      setMask(null)
      setOriginalMask(null)
      setSelectionPoints([])
      setHistory([])
      setNotice(null)
      setZoom(1)
      setStickerCopied(
        false
      )

      setEditorStage(
        'adjust'
      )
    }

  const editorWidthPercentage =
    Math.round(
      zoom * 100
    )

  return (
    <main className="site-shell overflow-x-hidden">
      <div className="site-bg-orb site-bg-orb-one" />
      <div className="site-bg-orb site-bg-orb-two" />
      <div className="site-bg-orb site-bg-orb-three" />
      <div className="site-grid" />
      <div className="site-noise" />

      <section className="relative z-10 px-5 pb-10 pt-6 sm:px-6 md:px-10 md:pb-14 md:pt-8">
        <div className="mx-auto max-w-7xl">
          <header className="mb-8 flex items-center justify-between gap-4 md:mb-10">
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

              <span>
                MA-Code.pt
              </span>
            </a>

            <div className="hidden items-center gap-5 lg:flex">
              <a
                href="/produtos"
                className="text-sm font-semibold text-slate-300 transition hover:text-white"
              >
                Produtos
              </a>

              <a
                href="/contacto"
                className="btn-ghost text-sm"
              >
                Pedir proposta
              </a>
            </div>
          </header>

          <div
            className={`max-w-5xl ${
              mounted
                ? 'animate-fade-in-up'
                : 'opacity-0'
            }`}
          >
            <div className="hero-topline">
              <span className="hero-topline__dot" />

              <span>
                MA-Recortes · Criador de stickers
              </span>
            </div>

            <h1 className="mt-6 text-4xl font-semibold tracking-tight text-white md:text-6xl">
              Selecione o contorno e prepare a fotografia para criar um{' '}
              <span className="bg-gradient-to-r from-cyan-200 via-sky-300 to-violet-200 bg-clip-text text-transparent">
                sticker no WhatsApp
              </span>
              .
            </h1>

            <p className="mt-5 max-w-3xl text-base leading-8 text-slate-300 md:text-lg">
              Marque pontos à volta da pessoa ou objeto, ajuste o
              recorte e, no final, basta copiar o sticker e colá-lo
              diretamente numa conversa do WhatsApp.
            </p>

            <ul className="hero-mini-points">
              <li>
                Seleção por pontos
              </li>

              <li>
                Ajuste das margens
              </li>

              <li>
                Copiar e colar
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="relative z-10 min-w-0 px-5 pb-20 sm:px-6 md:px-10">
        <div className="mx-auto min-w-0 max-w-7xl">
          {!editor ? (
            <div className="grid min-w-0 gap-6 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="service-card min-w-0">
                <span className="section-label">
                  1 · Escolher modo
                </span>

                <h2 className="mt-5 text-2xl font-semibold text-white md:text-3xl">
                  Como pretende criar o recorte?
                </h2>

                <p className="mt-3 text-sm leading-7 text-slate-300">
                  Recomendamos o modo manual por pontos. É mais
                  previsível e permite indicar exatamente a área que
                  deve ficar na imagem.
                </p>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <ToolButton
                    active={
                      startMode ===
                      'manual'
                    }
                    title="Selecionar por pontos"
                    description="Marque o contorno e toque no primeiro ponto para fechar."
                    onClick={() =>
                      setStartMode(
                        'manual'
                      )
                    }
                  />

                  <ToolButton
                    active={
                      startMode ===
                      'automatic'
                    }
                    title="Tentativa automática"
                    description="Tenta remover fundos simples e uniformes."
                    onClick={() =>
                      setStartMode(
                        'automatic'
                      )
                    }
                  />
                </div>

                {startMode ===
                  'automatic' && (
                  <label className="mt-6 block">
                    <span className="flex items-center justify-between gap-4 text-sm font-semibold text-slate-200">
                      Sensibilidade automática

                      <strong className="text-cyan-200">
                        {tolerance}
                      </strong>
                    </span>

                    <input
                      type="range"
                      min="30"
                      max="140"
                      step="2"
                      value={
                        tolerance
                      }
                      onChange={(
                        event
                      ) =>
                        setTolerance(
                          Number(
                            event
                              .target
                              .value
                          )
                        )
                      }
                      className="mt-3 w-full accent-cyan-300"
                    />

                    <span className="mt-2 block text-xs leading-5 text-slate-400">
                      Funciona melhor quando o fundo é simples,
                      uniforme e diferente da pessoa ou objeto.
                    </span>
                  </label>
                )}
              </div>

              <div className="service-card flex min-h-[360px] min-w-0 flex-col items-center justify-center text-center">
                <div className="flex size-20 items-center justify-center rounded-3xl border border-cyan-300/25 bg-cyan-300/10 text-3xl shadow-xl shadow-cyan-950/30">
                  ✂
                </div>

                <span className="section-label mt-6">
                  2 · Carregar fotografia
                </span>

                <h2 className="mt-5 text-2xl font-semibold text-white md:text-3xl">
                  Escolha uma imagem para recortar
                </h2>

                <p className="mt-3 max-w-xl text-sm leading-7 text-slate-300">
                  Formatos JPG, PNG ou WebP até 20 MB. A fotografia é
                  processada apenas no navegador.
                </p>

                <input
                  ref={
                    fileInputRef
                  }
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={
                    handleFileChange
                  }
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() =>
                    fileInputRef.current?.click()
                  }
                  disabled={
                    processing
                  }
                  className="btn-primary hightech-button mt-7 disabled:cursor-wait disabled:opacity-60"
                >
                  <span className="btn-shine" />

                  <span className="relative z-10">
                    {processing
                      ? 'A preparar…'
                      : 'Escolher fotografia'}
                  </span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[330px_minmax(0,1fr)]">
              <aside className="service-card min-w-0 xl:sticky xl:top-5">
                <div className="flex items-center justify-between gap-3">
                  <span className="section-label">
                    {editorStage ===
                    'select'
                      ? 'Seleção'
                      : 'Ferramentas'}
                  </span>

                  <button
                    type="button"
                    onClick={
                      clearEditor
                    }
                    className="rounded-full border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-rose-300/35 hover:text-rose-100"
                  >
                    Nova foto
                  </button>
                </div>

                {editorStage ===
                'select' ? (
                  <>
                    <div className="mt-6 rounded-2xl border border-yellow-300/20 bg-yellow-300/[0.07] p-4">
                      <strong className="text-sm text-yellow-100">
                        Como selecionar
                      </strong>

                      <ol className="mt-3 space-y-2 text-xs leading-6 text-slate-300">
                        <li>
                          1. Toque à volta da pessoa ou objeto.
                        </li>

                        <li>
                          2. Use vários pontos nas zonas curvas.
                        </li>

                        <li>
                          3. Toque no primeiro ponto amarelo para
                          fechar.
                        </li>

                        <li>
                          4. Ajuste depois com Restaurar e Remover.
                        </li>
                      </ol>
                    </div>

                    <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                      <span className="text-sm font-semibold text-slate-200">
                        Pontos marcados
                      </span>

                      <strong className="mt-2 block text-3xl text-cyan-200">
                        {selectionPoints.length}
                      </strong>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={
                          undoSelectionPoint
                        }
                        disabled={
                          selectionPoints.length ===
                          0
                        }
                        className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm font-semibold text-slate-200 transition hover:border-cyan-200/30 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        ↶ Retirar ponto
                      </button>

                      <button
                        type="button"
                        onClick={
                          clearSelectionPoints
                        }
                        disabled={
                          selectionPoints.length ===
                          0
                        }
                        className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm font-semibold text-slate-200 transition hover:border-rose-200/30 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Limpar
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        finishPolygonSelection()
                      }
                      disabled={
                        selectionPoints.length <
                        3
                      }
                      className="btn-primary hightech-button mt-4 w-full disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <span className="btn-shine" />

                      <span className="relative z-10">
                        Fechar seleção
                      </span>
                    </button>
                  </>
                ) : (
                  <>
                    <div className="mt-6 grid gap-3">
                      <ToolButton
                        active={
                          brushMode ===
                          'restore'
                        }
                        title="Restaurar"
                        description="Recupera partes que ficaram fora da seleção."
                        onClick={() =>
                          setBrushMode(
                            'restore'
                          )
                        }
                      />

                      <ToolButton
                        active={
                          brushMode ===
                          'remove'
                        }
                        title="Remover"
                        description="Apaga fundo ou partes que ficaram a mais."
                        onClick={() =>
                          setBrushMode(
                            'remove'
                          )
                        }
                      />
                    </div>

                    <label className="mt-6 block">
                      <span className="flex justify-between text-sm font-semibold text-slate-200">
                        Tamanho do pincel

                        <strong className="text-cyan-200">
                          {brushSize}
                          px
                        </strong>
                      </span>

                      <input
                        type="range"
                        min="6"
                        max="140"
                        value={
                          brushSize
                        }
                        onChange={(
                          event
                        ) =>
                          setBrushSize(
                            Number(
                              event
                                .target
                                .value
                            )
                          )
                        }
                        className="mt-3 w-full accent-cyan-300"
                      />
                    </label>

                    <label className="mt-6 block">
                      <span className="flex justify-between text-sm font-semibold text-slate-200">
                        Zoom

                        <strong className="text-cyan-200">
                          {editorWidthPercentage}
                          %
                        </strong>
                      </span>

                      <input
                        type="range"
                        min="0.7"
                        max="2.5"
                        step="0.1"
                        value={zoom}
                        onChange={(
                          event
                        ) =>
                          setZoom(
                            Number(
                              event
                                .target
                                .value
                            )
                          )
                        }
                        className="mt-3 w-full accent-cyan-300"
                      />
                    </label>

                    <label className="mt-6 block">
                      <span className="flex justify-between text-sm font-semibold text-slate-200">
                        Contorno branco opcional

                        <strong className="text-cyan-200">
                          {outlineSize ===
                          0
                            ? 'Sem contorno'
                            : `${outlineSize}px`}
                        </strong>
                      </span>

                      <input
                        type="range"
                        min="0"
                        max="24"
                        value={
                          outlineSize
                        }
                        onChange={(
                          event
                        ) =>
                          setOutlineSize(
                            Number(
                              event
                                .target
                                .value
                            )
                          )
                        }
                        className="mt-3 w-full accent-cyan-300"
                      />

                      <span className="mt-2 block text-xs leading-5 text-slate-400">
                        O valor inicial é zero. Aumente apenas quando
                        quiser adicionar um contorno branco.
                      </span>
                    </label>

                    <div className="mt-6 grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={undo}
                        disabled={
                          history.length ===
                          0
                        }
                        className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm font-semibold text-slate-200 transition hover:border-cyan-200/30 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        ↶ Anular
                      </button>

                      <button
                        type="button"
                        onClick={
                          resetMask
                        }
                        className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm font-semibold text-slate-200 transition hover:border-cyan-200/30"
                      >
                        Repor
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={
                        restartManualSelection
                      }
                      className="mt-3 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm font-semibold text-slate-200 transition hover:border-yellow-200/30"
                    >
                      Refazer seleção por pontos
                    </button>

                    <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                      <label className="block">
                        <span className="flex justify-between text-sm font-semibold text-slate-200">
                          Suavizar margem

                          <strong className="text-cyan-200">
                            {softness}
                          </strong>
                        </span>

                        <input
                          type="range"
                          min="1"
                          max="4"
                          value={
                            softness
                          }
                          onChange={(
                            event
                          ) =>
                            setSoftness(
                              Number(
                                event
                                  .target
                                  .value
                              )
                            )
                          }
                          className="mt-3 w-full accent-cyan-300"
                        />
                      </label>

                      <button
                        type="button"
                        onClick={
                          applySoftness
                        }
                        className="mt-4 w-full rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-3 py-2.5 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-300/15"
                      >
                        Aplicar suavização
                      </button>
                    </div>

                    <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                      <label className="block">
                        <span className="flex justify-between text-sm font-semibold text-slate-200">
                          Sensibilidade automática

                          <strong className="text-cyan-200">
                            {tolerance}
                          </strong>
                        </span>

                        <input
                          type="range"
                          min="30"
                          max="140"
                          step="2"
                          value={
                            tolerance
                          }
                          onChange={(
                            event
                          ) =>
                            setTolerance(
                              Number(
                                event
                                  .target
                                  .value
                              )
                            )
                          }
                          className="mt-3 w-full accent-cyan-300"
                        />
                      </label>

                      <button
                        type="button"
                        onClick={
                          rerunAutomaticCut
                        }
                        disabled={
                          processing
                        }
                        className="mt-4 w-full rounded-xl border border-violet-300/20 bg-violet-300/10 px-3 py-2.5 text-sm font-semibold text-violet-50 transition hover:bg-violet-300/15 disabled:opacity-50"
                      >
                        Tentar recorte automático
                      </button>
                    </div>
                  </>
                )}
              </aside>

              <div className="min-w-0 space-y-6">
                <section className="service-card min-w-0 overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <span className="section-label">
                        {editorStage ===
                        'select'
                          ? '3 · Marcar contorno'
                          : '4 · Ajustar recorte'}
                      </span>

                      <p className="mt-3 text-sm leading-6 text-slate-300">
                        {editorStage ===
                        'select'
                          ? 'A fotografia foi ajustada ao ecrã. Toque à volta da área que pretende manter. O primeiro ponto aparece a amarelo.'
                          : 'Pinte diretamente sobre a imagem com Restaurar ou Remover.'}
                      </p>
                    </div>

                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-300">
                      {editor.width}{' '}
                      ×{' '}
                      {editor.height}
                      px
                    </span>
                  </div>

                  <div
                    className={`mt-6 min-w-0 rounded-3xl border border-white/10 bg-[linear-gradient(45deg,rgba(255,255,255,0.07)_25%,transparent_25%),linear-gradient(-45deg,rgba(255,255,255,0.07)_25%,transparent_25%),linear-gradient(45deg,transparent_75%,rgba(255,255,255,0.07)_75%),linear-gradient(-45deg,transparent_75%,rgba(255,255,255,0.07)_75%)] bg-[length:24px_24px] bg-[position:0_0,0_12px,12px_-12px,-12px_0px] p-2 sm:p-4 ${
                      editorStage ===
                      'select'
                        ? 'overflow-hidden'
                        : 'max-h-[72vh] overflow-auto'
                    }`}
                  >
                    {editorStage ===
                    'select' ? (
                      <div className="flex min-h-0 w-full min-w-0 items-center justify-center">
                        <canvas
                          ref={
                            canvasRef
                          }
                          onPointerDown={
                            handlePointerDown
                          }
                          onPointerMove={
                            handlePointerMove
                          }
                          onPointerUp={
                            stopPainting
                          }
                          onPointerCancel={
                            stopPainting
                          }
                          onPointerLeave={
                            stopPainting
                          }
                          className="block h-auto max-h-[65vh] w-auto max-w-full touch-none cursor-crosshair rounded-2xl"
                          aria-label="Selecionar o contorno da imagem"
                        />
                      </div>
                    ) : (
                      <div
                        className="mx-auto min-w-0"
                        style={{
                          width:
                            `${editorWidthPercentage}%`,
                          maxWidth:
                            `${Math.round(
                              editor.width *
                                zoom
                            )}px`
                        }}
                      >
                        <canvas
                          ref={
                            canvasRef
                          }
                          onPointerDown={
                            handlePointerDown
                          }
                          onPointerMove={
                            handlePointerMove
                          }
                          onPointerUp={
                            stopPainting
                          }
                          onPointerCancel={
                            stopPainting
                          }
                          onPointerLeave={
                            stopPainting
                          }
                          className={`block h-auto w-full touch-none rounded-2xl ${
                            brushMode ===
                            'remove'
                              ? 'cursor-crosshair'
                              : 'cursor-cell'
                          }`}
                          aria-label="Ajustar o recorte da imagem"
                        />
                      </div>
                    )}
                  </div>
                </section>

                {editorStage ===
                  'adjust' &&
                  mask && (
                  <section className="service-card min-w-0">
                    <span className="section-label">
                      5 · Copiar para o WhatsApp
                    </span>

                    <h2 className="mt-5 text-2xl font-semibold text-white md:text-3xl">
                      O seu sticker está pronto
                    </h2>

                    <p className="mt-3 text-sm leading-7 text-slate-300">
                      A MA-Recortes já criou o sticker transparente.
                      Basta carregar em copiar e colá-lo no campo da
                      mensagem de uma conversa do WhatsApp.
                    </p>

                    <div
                      className={`mt-6 grid gap-3 ${
                        stickerCopied
                          ? 'sm:grid-cols-3'
                          : 'sm:grid-cols-2'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          void exportPng()
                        }
                        disabled={
                          processing
                        }
                        className="btn-secondary hightech-button-secondary disabled:cursor-wait disabled:opacity-50"
                      >
                        Exportar PNG transparente
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          void copySticker()
                        }
                        disabled={
                          processing
                        }
                        className="btn-primary hightech-button disabled:cursor-wait disabled:opacity-50"
                      >
                        <span className="btn-shine" />

                        <span className="relative z-10">
                          {processing
                            ? 'A preparar…'
                            : '1. Copiar sticker'}
                        </span>
                      </button>

                      {stickerCopied && (
                        <button
                          type="button"
                          onClick={
                            openWhatsapp
                          }
                          className="rounded-2xl border border-emerald-300/30 bg-emerald-300/10 px-5 py-3 text-sm font-semibold text-emerald-50 transition hover:border-emerald-200/50 hover:bg-emerald-300/15"
                        >
                          2. Abrir WhatsApp
                        </button>
                      )}
                    </div>

                    <div className="mt-6 rounded-3xl border border-cyan-300/25 bg-cyan-300/[0.07] p-5">
                      <strong className="text-base font-semibold text-cyan-100">
                        Como enviar o sticker
                      </strong>

                      <ol className="mt-5 space-y-4 text-sm leading-6 text-slate-200">
                        <InstructionStep
                          number={1}
                        >
                          Toque em{' '}
                          <strong className="text-white">
                            1. Copiar sticker
                          </strong>
                          .
                        </InstructionStep>

                        <InstructionStep
                          number={2}
                        >
                          Quando aparecer a mensagem{' '}
                          <strong className="text-white">
                            “Sticker copiado”
                          </strong>
                          , toque em{' '}
                          <strong className="text-white">
                            2. Abrir WhatsApp
                          </strong>
                          .
                        </InstructionStep>

                        <InstructionStep
                          number={3}
                        >
                          Abra a conversa onde pretende enviar o
                          sticker.
                        </InstructionStep>

                        <InstructionStep
                          number={4}
                        >
                          Mantenha premido no campo onde escreve a
                          mensagem e toque em{' '}
                          <strong className="text-white">
                            Colar
                          </strong>
                          .
                        </InstructionStep>

                        <InstructionStep
                          number={5}
                        >
                          Confirme a pré-visualização e toque em{' '}
                          <strong className="text-white">
                            Enviar
                          </strong>
                          .
                        </InstructionStep>
                      </ol>

                      <div className="mt-5 rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.07] p-4 text-sm leading-6 text-emerald-50">
                        No final é apenas:
                        <strong>
                          {' '}Copiar → Abrir WhatsApp → Colar → Enviar.
                        </strong>
                      </div>

                      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-xs leading-6 text-slate-300">
                        Todos os stickers e PNG exportados incluem uma
                        marca de água legível{' '}
                        <strong className="text-white">
                          MA-CODE.PT
                        </strong>{' '}
                        no canto inferior direito.
                      </div>
                    </div>
                  </section>
                )}
              </div>
            </div>
          )}

          {notice && (
            <div
              className={`mt-6 rounded-2xl border px-4 py-3 text-sm leading-6 ${
                notice.type ===
                'error'
                  ? 'border-rose-300/25 bg-rose-400/10 text-rose-100'
                  : notice.type ===
                      'success'
                    ? 'border-emerald-300/25 bg-emerald-400/10 text-emerald-100'
                    : 'border-cyan-300/25 bg-cyan-400/10 text-cyan-100'
              }`}
              role="status"
              aria-live="polite"
            >
              {notice.text}
            </div>
          )}

          <div className="mt-8 rounded-3xl border border-white/10 bg-slate-950/55 p-5 text-sm leading-7 text-slate-400 backdrop-blur md:p-6">
            <strong className="text-slate-200">
              Privacidade:
            </strong>{' '}
            o recorte, a correção, a marca de água e a exportação são
            feitos no navegador. A fotografia não é carregada para a
            MA-Code.
          </div>
        </div>
      </section>
    </main>
  )
}
