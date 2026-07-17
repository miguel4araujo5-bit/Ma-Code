import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent
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
    document.querySelector<
      HTMLMetaElement
    >(
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
    document.querySelector<
      HTMLMetaElement
    >(
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
    document.querySelector<
      HTMLLinkElement
    >(
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
    document.querySelector<
      HTMLScriptElement
    >(
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

  URL.revokeObjectURL(
    url
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
  ] = useState<
    EditorPoint[]
  >([])

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
  ] = useState(8)

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
  ] = useState<
    PixelMask[]
  >([])

  const [
    isPainting,
    setIsPainting
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
      'Crie stickers para WhatsApp: selecione uma fotografia por pontos, corrija o recorte manualmente e exporte em PNG transparente.'
    )

    updateMeta(
      'keywords',
      'criar sticker WhatsApp, recortar imagem, selecionar contorno, remover fundo, PNG transparente, MA-Recortes, MA-Code'
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
      'Selecione fotografias por pontos, ajuste as margens e exporte como PNG transparente ou sticker para WhatsApp.'
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
      'Selecione, corrija e exporte stickers para WhatsApp diretamente no navegador.'
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
          'Aplicação web para selecionar e recortar imagens manualmente, corrigir margens e exportar PNG transparentes e stickers para WhatsApp.',
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

  const undo = () => {
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
    async (
      whatsapp: boolean
    ) => {
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
          whatsapp
            ? 'A preparar o sticker para partilhar…'
            : 'A criar o PNG transparente…'
      })

      try {
        const blob =
          await createExportBlob(
            editor,
            mask,
            {
              whatsapp,
              outlineSize
            }
          )

        const fileName =
          whatsapp
            ? 'ma-recortes-sticker.png'
            : 'ma-recortes.png'

        if (whatsapp) {
          const file =
            new File(
              [blob],
              fileName,
              {
                type:
                  'image/png'
              }
            )

          const shareData:
            ShareData = {
              files: [
                file
              ],
              title:
                'Sticker criado no MA-Recortes',
              text:
                'Sticker criado em ma-code.pt/produtos/ma-recortes'
            }

          if (
            navigator.share &&
            (
              !navigator.canShare ||
              navigator.canShare(
                shareData
              )
            )
          ) {
            await navigator.share(
              shareData
            )

            setNotice({
              type:
                'success',
              text:
                'Escolha o WhatsApp na janela de partilha.'
            })
          } else {
            downloadBlob(
              blob,
              fileName
            )

            setNotice({
              type:
                'info',
              text:
                'O navegador não permite partilha direta. O sticker foi descarregado.'
            })
          }
        } else {
          downloadBlob(
            blob,
            fileName
          )

          setNotice({
            type:
              'success',
            text:
              'PNG transparente descarregado com sucesso.'
          })
        }
      } catch (
        error
      ) {
        if (
          error instanceof
            DOMException &&
          error.name ===
            'AbortError'
        ) {
          setNotice({
            type:
              'info',
            text:
              'Partilha cancelada. O recorte continua disponível.'
          })
        } else {
          setNotice({
            type:
              'error',
            text:
              error instanceof
              Error
                ? error.message
                : 'Não foi possível exportar o recorte.'
          })
        }
      } finally {
        setProcessing(false)
      }
    }

  const clearEditor =
    () => {
      setEditor(null)
      setMask(null)
      setOriginalMask(null)
      setSelectionPoints([])
      setHistory([])
      setNotice(null)
      setEditorStage(
        'adjust'
      )
    }

  return (
    <main className="site-shell">
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
              Selecione o contorno e transforme a fotografia num{' '}
              <span className="bg-gradient-to-r from-cyan-200 via-sky-300 to-violet-200 bg-clip-text text-transparent">
                sticker para WhatsApp
              </span>
              .
            </h1>

            <p className="mt-5 max-w-3xl text-base leading-8 text-slate-300 md:text-lg">
              Marque pontos à volta da pessoa ou objeto, feche a
              seleção tocando no primeiro ponto e ajuste depois os
              detalhes com os pincéis de restaurar e remover.
            </p>

            <ul className="hero-mini-points">
              <li>
                Seleção por pontos
              </li>

              <li>
                Ajuste das margens
              </li>

              <li>
                PNG transparente
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="relative z-10 px-5 pb-20 sm:px-6 md:px-10">
        <div className="mx-auto max-w-7xl">
          {!editor ? (
            <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="service-card">
                <span className="section-label">
                  1 · Escolher modo
                </span>

                <h2 className="mt-5 text-2xl font-semibold text-white md:text-3xl">
                  Como pretende criar o recorte?
                </h2>

                <p className="mt-3 text-sm leading-7 text-slate-300">
                  Recomendamos o modo manual por pontos. É mais
                  previsível e permite indicar exatamente a área que
                  deve ficar no sticker.
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

              <div className="service-card flex min-h-[360px] flex-col items-center justify-center text-center">
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
            <div className="grid items-start gap-6 xl:grid-cols-[330px_minmax(0,1fr)]">
              <aside className="service-card xl:sticky xl:top-5">
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
                          {Math.round(
                            zoom *
                              100
                          )}
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
                        Contorno branco

                        <strong className="text-cyan-200">
                          {outlineSize}
                          px
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

              <div className="space-y-6">
                <section className="service-card overflow-hidden">
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
                          ? 'Toque à volta da área que pretende manter. O primeiro ponto aparece a amarelo.'
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

                  <div className="mt-6 max-h-[72vh] overflow-auto rounded-3xl border border-white/10 bg-[linear-gradient(45deg,rgba(255,255,255,0.07)_25%,transparent_25%),linear-gradient(-45deg,rgba(255,255,255,0.07)_25%,transparent_25%),linear-gradient(45deg,transparent_75%,rgba(255,255,255,0.07)_75%),linear-gradient(-45deg,transparent_75%,rgba(255,255,255,0.07)_75%)] bg-[length:24px_24px] bg-[position:0_0,0_12px,12px_-12px,-12px_0px] p-3 sm:p-5">
                    <div
                      className="mx-auto origin-top transition-transform duration-200"
                      style={{
                        width:
                          `${editor.width}px`,
                        maxWidth:
                          '100%',
                        transform:
                          `scale(${zoom})`,
                        transformOrigin:
                          'top center',
                        marginBottom:
                          `${Math.max(
                            0,
                            (
                              zoom -
                              1
                            ) *
                              Math.min(
                                editor.height,
                                700
                              )
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
                          editorStage ===
                          'select'
                            ? 'cursor-crosshair'
                            : brushMode ===
                                'remove'
                              ? 'cursor-crosshair'
                              : 'cursor-cell'
                        }`}
                        aria-label="Editor do recorte"
                      />
                    </div>
                  </div>
                </section>

                {editorStage ===
                  'adjust' &&
                  mask && (
                  <section className="service-card">
                    <span className="section-label">
                      5 · Exportar
                    </span>

                    <h2 className="mt-5 text-2xl font-semibold text-white md:text-3xl">
                      O seu recorte está pronto
                    </h2>

                    <p className="mt-3 text-sm leading-7 text-slate-300">
                      O PNG mantém o fundo transparente. A opção
                      WhatsApp cria uma imagem quadrada de 512 × 512
                      px.
                    </p>

                    <div className="mt-6 grid gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() =>
                          void exportPng(
                            false
                          )
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
                          void exportPng(
                            true
                          )
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
                            : 'Partilhar para WhatsApp'}
                        </span>
                      </button>
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
            o recorte, a correção e a exportação são feitos no
            navegador. A fotografia não é carregada para a MA-Code.
          </div>
        </div>
      </section>
    </main>
  )
}
