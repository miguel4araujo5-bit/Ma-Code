import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode
} from 'react'
import {
  Canvas as FabricCanvas,
  FabricImage,
  FabricObject,
  Line,
  Rect,
  Textbox
} from 'fabric'

import {
  deleteMAQuadroDesign,
  deleteMAQuadroFont,
  listMAQuadroDesigns,
  listMAQuadroFonts,
  saveMAQuadroDesign,
  saveMAQuadroFont
} from '../../lib/maQuadro/db'
import {
  exportMAQuadroDesignJson,
  exportMAQuadroPdf,
  exportMAQuadroPng
} from '../../lib/maQuadro/export'
import {
  createBlankMAQuadroDesign,
  createMAQuadroId,
  MA_QUADRO_PRESETS,
  seedMAQuadroStarterDesigns
} from '../../lib/maQuadro/templates'
import type {
  MAQuadroBrand,
  MAQuadroDesign,
  MAQuadroHistorySnapshot,
  MAQuadroStoredFont
} from '../../types/maQuadro'
import './maQuadro.css'

type MAQuadroObject = FabricObject & {
  maName?: string
  maLocked?: boolean
  isEditing?: boolean
  text?: string
  fontFamily?: string
  fontSize?: number
  fontWeight?: string | number
  fontStyle?: string
  textAlign?: string
  lineHeight?: number
  charSpacing?: number
  rx?: number
  ry?: number
}

type LayerItem = {
  id: string
  name: string
  type: string
  object: MAQuadroObject
}

type PropertiesState = {
  name: string
  fill: string
  stroke: string
  strokeWidth: number
  opacity: number
  angle: number
  fontFamily: string
  fontSize: number
  fontWeight: string
  fontStyle: string
  textAlign: string
  lineHeight: number
  charSpacing: number
  cornerRadius: number
}

const fallbackBrand: MAQuadroBrand = {
  name: 'MA-Code',
  colors: [
    {
      name: 'Ciano MA',
      value: '#22D3EE'
    },
    {
      name: 'Azul MA',
      value: '#38BDF8'
    },
    {
      name: 'Violeta MA',
      value: '#8B5CF6'
    },
    {
      name: 'Azul noite',
      value: '#0F172A'
    }
  ],
  fonts: [
    {
      name: 'Sans moderna',
      family: 'Arial',
      fallback: 'sans-serif'
    },
    {
      name: 'Serif editorial',
      family: 'Georgia',
      fallback: 'serif'
    }
  ]
}

const initialProperties: PropertiesState = {
  name: '',
  fill: '#0F172A',
  stroke: '#0F172A',
  strokeWidth: 0,
  opacity: 100,
  angle: 0,
  fontFamily: 'Arial',
  fontSize: 64,
  fontWeight: '400',
  fontStyle: 'normal',
  textAlign: 'left',
  lineHeight: 1.16,
  charSpacing: 0,
  cornerRadius: 0
}

const fabricObjectClass = FabricObject as unknown as {
  customProperties: string[]
}

fabricObjectClass.customProperties = [
  'maName',
  'maLocked'
]

function EditorButton({
  children,
  onClick,
  disabled = false,
  active = false,
  danger = false,
  title
}: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
  active?: boolean
  danger?: boolean
  title?: string
}) {
  return (
    <button
      type="button"
      className={`ma-quadro__button${
        active ? ' ma-quadro__button--active' : ''
      }${danger ? ' ma-quadro__button--danger' : ''}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  )
}

function normalizeCanvasJson(
  canvasJson: Record<string, unknown>
) {
  const objects = Array.isArray(canvasJson.objects)
    ? canvasJson.objects
    : []

  return {
    ...canvasJson,
    objects: objects.map((object) => {
      if (!object || typeof object !== 'object') {
        return object
      }

      return {
        originX: 'left',
        originY: 'top',
        ...object
      }
    })
  }
}

function objectOrigin() {
  return {
    originX: 'left' as const,
    originY: 'top' as const
  }
}

function colorAsString(
  value: unknown,
  fallback: string
) {
  return typeof value === 'string'
    ? value
    : fallback
}

function getObjectTypeLabel(
  object: MAQuadroObject
) {
  if (object instanceof Textbox) {
    return 'Texto'
  }

  if (object instanceof FabricImage) {
    return 'Imagem'
  }

  if (object instanceof Line) {
    return 'Linha'
  }

  if (object instanceof Rect) {
    return 'Retângulo'
  }

  return 'Elemento'
}

function getObjectName(
  object: MAQuadroObject,
  index: number
) {
  if (object.maName) {
    return object.maName
  }

  if (object instanceof Textbox) {
    const text = object.text?.trim() || ''

    if (text) {
      return text.length > 28
        ? `${text.slice(0, 28)}…`
        : text
    }
  }

  return `${getObjectTypeLabel(object)} ${index + 1}`
}

function cloneDesignAsUserCopy(
  design: MAQuadroDesign,
  name: string
): MAQuadroDesign {
  const now = new Date().toISOString()

  return {
    ...design,
    id: createMAQuadroId('design'),
    name,
    canvasJson: structuredClone(design.canvasJson),
    thumbnail: design.thumbnail,
    isStarter: false,
    createdAt: now,
    updatedAt: now
  }
}

function isImportedDesign(
  value: unknown
): value is MAQuadroDesign {
  if (!value || typeof value !== 'object') {
    return false
  }

  const design = value as Partial<MAQuadroDesign>

  return (
    typeof design.name === 'string' &&
    typeof design.width === 'number' &&
    typeof design.height === 'number' &&
    Boolean(
      design.canvasJson &&
      typeof design.canvasJson === 'object'
    )
  )
}

async function registerLocalFont(
  font: MAQuadroStoredFont
) {
  const face = new FontFace(
    font.family,
    font.data
  )

  await face.load()
  document.fonts.add(face)
}

function targetIsFormControl(
  target: EventTarget | null
) {
  const element = target as HTMLElement | null

  return Boolean(
    element &&
    (
      element.tagName === 'INPUT' ||
      element.tagName === 'TEXTAREA' ||
      element.tagName === 'SELECT' ||
      element.isContentEditable
    )
  )
}

export default function MAQuadroApp() {
  const canvasElementRef = useRef<HTMLCanvasElement | null>(null)
  const workspaceRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<FabricCanvas | null>(null)
  const imageInputRef = useRef<HTMLInputElement | null>(null)
  const fontInputRef = useRef<HTMLInputElement | null>(null)
  const projectInputRef = useRef<HTMLInputElement | null>(null)
  const designRef = useRef<MAQuadroDesign | null>(null)
  const designNameRef = useRef('Design sem título')
  const clipboardRef = useRef<MAQuadroObject | null>(null)
  const historyRef = useRef<string[]>([])
  const historyIndexRef = useRef(-1)
  const isLoadingRef = useRef(false)
  const isApplyingHistoryRef = useRef(false)
  const initializedRef = useRef(false)
  const autosaveTimerRef = useRef<number | null>(null)
  const saveHandlerRef = useRef<(quiet?: boolean) => Promise<void>>(
    async () => undefined
  )
  const zoomRef = useRef(50)
  const backgroundColorRef = useRef('#FFFFFF')
  const transparentBackgroundRef = useRef(false)

  const [canvasReady, setCanvasReady] = useState(false)
  const [brand, setBrand] = useState<MAQuadroBrand>(fallbackBrand)
  const [design, setDesign] = useState<MAQuadroDesign | null>(null)
  const [designs, setDesigns] = useState<MAQuadroDesign[]>([])
  const [designName, setDesignName] = useState('Design sem título')
  const [localFonts, setLocalFonts] = useState<MAQuadroStoredFont[]>([])
  const [layers, setLayers] = useState<LayerItem[]>([])
  const [selectedObject, setSelectedObject] = useState<MAQuadroObject | null>(null)
  const [properties, setProperties] = useState<PropertiesState>(
    initialProperties
  )
  const [backgroundColor, setBackgroundColor] = useState('#FFFFFF')
  const [transparentBackground, setTransparentBackground] = useState(false)
  const [zoom, setZoom] = useState(50)
  const [guides, setGuides] = useState({
    vertical: false,
    horizontal: false
  })
  const [statusMessage, setStatusMessage] = useState(
    'Tudo fica guardado apenas neste dispositivo.'
  )
  const [saveState, setSaveState] = useState('Pronto')
  const [isBusy, setIsBusy] = useState(false)
  const [activePanel, setActivePanel] = useState<
    'templates' | 'elements' | 'brand' | 'designs'
  >('templates')
  const [showCustomSize, setShowCustomSize] = useState(false)
  const [customWidth, setCustomWidth] = useState('1200')
  const [customHeight, setCustomHeight] = useState('1200')
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  const availableFonts = useMemo(() => {
    const fonts = new Map<string, {
      name: string
      family: string
      fallback?: string
    }>()

    for (const font of brand.fonts) {
      fonts.set(font.family, font)
    }

    for (const font of localFonts) {
      fonts.set(font.family, {
        name: font.family,
        family: font.family
      })
    }

    return Array.from(fonts.values())
  }, [brand.fonts, localFonts])

  const refreshDesignLibrary = useCallback(async () => {
    setDesigns(await listMAQuadroDesigns())
  }, [])

  const syncLayers = useCallback(() => {
    const canvas = canvasRef.current

    if (!canvas) {
      return
    }

    const nextLayers = canvas
      .getObjects()
      .map((object, index) => {
        const entity = object as MAQuadroObject

        return {
          id: `${index}-${entity.type}-${entity.left}-${entity.top}`,
          name: getObjectName(entity, index),
          type: getObjectTypeLabel(entity),
          object: entity
        }
      })
      .reverse()

    setLayers(nextLayers)
  }, [])

  const syncSelection = useCallback(() => {
    const canvas = canvasRef.current
    const active = canvas?.getActiveObject() as
      | MAQuadroObject
      | undefined

    setSelectedObject(active || null)

    if (!active) {
      setProperties((current) => ({
        ...current,
        name: '',
        fill: colorAsString(
          canvas?.backgroundColor,
          '#FFFFFF'
        ),
        opacity: 100,
        angle: 0
      }))
      return
    }

    setProperties({
      name: active.maName || getObjectName(active, 0),
      fill: active instanceof Line
        ? colorAsString(active.stroke, '#0F172A')
        : colorAsString(active.fill, '#0F172A'),
      stroke: colorAsString(active.stroke, '#0F172A'),
      strokeWidth: Number(active.strokeWidth || 0),
      opacity: Math.round((active.opacity ?? 1) * 100),
      angle: Math.round(active.angle || 0),
      fontFamily: active.fontFamily || 'Arial',
      fontSize: Math.round(active.fontSize || 64),
      fontWeight: String(active.fontWeight || '400'),
      fontStyle: active.fontStyle || 'normal',
      textAlign: active.textAlign || 'left',
      lineHeight: Number(active.lineHeight || 1.16),
      charSpacing: Number(active.charSpacing || 0),
      cornerRadius: Number(active.rx || 0)
    })
  }, [])

  const applyZoom = useCallback((percent: number) => {
    const canvas = canvasRef.current

    if (!canvas) {
      return
    }

    const safePercent = Math.min(
      200,
      Math.max(5, percent)
    )

    zoomRef.current = safePercent
    setZoom(safePercent)
    canvas.setDimensions(
      {
        width: `${Math.round(
          canvas.getWidth() * safePercent / 100
        )}px`,
        height: `${Math.round(
          canvas.getHeight() * safePercent / 100
        )}px`
      },
      {
        cssOnly: true
      }
    )
    canvas.calcOffset()
  }, [])

  const fitCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const workspace = workspaceRef.current

    if (!canvas || !workspace) {
      return
    }

    const availableWidth = Math.max(
      260,
      workspace.clientWidth - 48
    )
    const availableHeight = Math.max(
      320,
      Math.min(window.innerHeight - 210, 880)
    )
    const scale = Math.min(
      availableWidth / canvas.getWidth(),
      availableHeight / canvas.getHeight(),
      1
    )

    applyZoom(
      Math.max(5, Math.round(scale * 100))
    )
  }, [applyZoom])

  const makeHistorySnapshot = useCallback(() => {
    const canvas = canvasRef.current

    if (!canvas) {
      return null
    }

    const snapshot: MAQuadroHistorySnapshot = {
      backgroundColor: backgroundColorRef.current,
      transparentBackground: transparentBackgroundRef.current,
      canvasJson: canvas.toObject([
        'maName',
        'maLocked'
      ]) as Record<string, unknown>
    }

    return JSON.stringify(snapshot)
  }, [])

  const updateHistoryButtons = useCallback(() => {
    setCanUndo(historyIndexRef.current > 0)
    setCanRedo(
      historyIndexRef.current <
      historyRef.current.length - 1
    )
  }, [])

  const resetHistory = useCallback(() => {
    const snapshot = makeHistorySnapshot()

    historyRef.current = snapshot
      ? [snapshot]
      : []
    historyIndexRef.current = snapshot
      ? 0
      : -1
    updateHistoryButtons()
  }, [makeHistorySnapshot, updateHistoryButtons])

  const pushHistory = useCallback(() => {
    if (
      isLoadingRef.current ||
      isApplyingHistoryRef.current
    ) {
      return
    }

    const snapshot = makeHistorySnapshot()

    if (!snapshot) {
      return
    }

    const current = historyRef.current[
      historyIndexRef.current
    ]

    if (current === snapshot) {
      updateHistoryButtons()
      return
    }

    const next = historyRef.current
      .slice(0, historyIndexRef.current + 1)
      .concat(snapshot)
      .slice(-60)

    historyRef.current = next
    historyIndexRef.current = next.length - 1
    updateHistoryButtons()
  }, [makeHistorySnapshot, updateHistoryButtons])

  const scheduleAutosave = useCallback((message: string) => {
    if (
      isLoadingRef.current ||
      isApplyingHistoryRef.current
    ) {
      return
    }

    setSaveState('Alterações por guardar')
    setStatusMessage(message)

    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current)
    }

    autosaveTimerRef.current = window.setTimeout(() => {
      void saveHandlerRef.current(true)
    }, 1200)
  }, [])

  const commitCanvasChange = useCallback((message: string) => {
    syncLayers()
    syncSelection()
    pushHistory()
    scheduleAutosave(message)
  }, [pushHistory, scheduleAutosave, syncLayers, syncSelection])

  const captureCurrentDesign = useCallback(() => {
    const canvas = canvasRef.current
    const current = designRef.current

    if (!canvas || !current) {
      return current
    }

    const updated: MAQuadroDesign = {
      ...current,
      name:
        designNameRef.current.trim() ||
        'Design sem título',
      width: canvas.getWidth(),
      height: canvas.getHeight(),
      backgroundColor: backgroundColorRef.current,
      transparentBackground:
        transparentBackgroundRef.current,
      canvasJson: canvas.toObject([
        'maName',
        'maLocked'
      ]) as Record<string, unknown>
    }

    designRef.current = updated
    setDesign(updated)

    return updated
  }, [])

  const loadDesign = useCallback(async (
    record: MAQuadroDesign
  ) => {
    const canvas = canvasRef.current

    if (!canvas) {
      return
    }

    isLoadingRef.current = true
    setIsBusy(true)

    try {
      canvas.discardActiveObject()
      canvas.clear()
      canvas.setDimensions({
        width: record.width,
        height: record.height
      })
      canvas.backgroundColor = record.transparentBackground
        ? ''
        : record.backgroundColor

      await canvas.loadFromJSON(
        normalizeCanvasJson(record.canvasJson)
      )

      canvas.backgroundColor = record.transparentBackground
        ? ''
        : record.backgroundColor
      canvas.requestRenderAll()

      designRef.current = structuredClone(record)
      designNameRef.current = record.name
      backgroundColorRef.current = record.backgroundColor
      transparentBackgroundRef.current =
        record.transparentBackground
      setDesign(structuredClone(record))
      setDesignName(record.name)
      setBackgroundColor(record.backgroundColor)
      setTransparentBackground(
        record.transparentBackground
      )
      setGuides({
        vertical: false,
        horizontal: false
      })
      syncLayers()
      syncSelection()
      window.requestAnimationFrame(fitCanvas)
      window.setTimeout(resetHistory, 0)
      setStatusMessage(`“${record.name}” aberto.`)
      setSaveState(
        record.isStarter
          ? 'Modelo original'
          : 'Guardado'
      )
    } catch (error) {
      console.error(error)
      setStatusMessage(
        'Não foi possível abrir este design.'
      )
    } finally {
      isLoadingRef.current = false
      setIsBusy(false)
    }
  }, [fitCanvas, resetHistory, syncLayers, syncSelection])

  const saveWorkingDesign = useCallback(async (
    quiet = false
  ) => {
    const canvas = canvasRef.current
    let current = captureCurrentDesign()

    if (!canvas || !current) {
      return
    }

    setIsBusy(true)
    setSaveState('A guardar…')

    try {
      const wasStarter = current.isStarter

      if (wasStarter) {
        current = cloneDesignAsUserCopy(
          current,
          `${current.name} — cópia`
        )
        designNameRef.current = current.name
      }

      const thumbnailMultiplier = Math.max(
        0.03,
        Math.min(
          0.22,
          240 / current.width,
          180 / current.height
        )
      )
      const saved: MAQuadroDesign = {
        ...current,
        name: wasStarter
          ? current.name
          : designNameRef.current.trim() || current.name,
        thumbnail: canvas.toDataURL({
          format: 'png',
          multiplier: thumbnailMultiplier,
          enableRetinaScaling: false
        }),
        isStarter: false,
        updatedAt: new Date().toISOString()
      }

      await saveMAQuadroDesign(saved)
      designRef.current = saved
      designNameRef.current = saved.name
      setDesign(saved)
      setDesignName(saved.name)
      await refreshDesignLibrary()
      setSaveState('Guardado automaticamente')

      if (!quiet) {
        setStatusMessage(
          `“${saved.name}” guardado neste dispositivo.`
        )
      }
    } catch (error) {
      console.error(error)
      setSaveState('Erro ao guardar')
      setStatusMessage(
        'Não foi possível guardar o design localmente.'
      )
    } finally {
      setIsBusy(false)
    }
  }, [captureCurrentDesign, refreshDesignLibrary])

  useEffect(() => {
    saveHandlerRef.current = saveWorkingDesign
  }, [saveWorkingDesign])

  useEffect(() => {
    designNameRef.current = designName
  }, [designName])

  useEffect(() => {
    backgroundColorRef.current = backgroundColor
  }, [backgroundColor])

  useEffect(() => {
    transparentBackgroundRef.current = transparentBackground
  }, [transparentBackground])

  useEffect(() => {
    const element = canvasElementRef.current

    if (!element) {
      return
    }

    const canvas = new FabricCanvas(element, {
      width: 1080,
      height: 1080,
      backgroundColor: '#FFFFFF',
      preserveObjectStacking: true,
      selection: true
    })

    canvasRef.current = canvas

    const syncEditor = () => {
      syncLayers()
      syncSelection()
    }

    const changed = () => {
      if (
        isLoadingRef.current ||
        isApplyingHistoryRef.current
      ) {
        return
      }

      commitCanvasChange('Alterações por guardar.')
    }

    canvas.on('selection:created', syncEditor)
    canvas.on('selection:updated', syncEditor)
    canvas.on('selection:cleared', syncEditor)
    canvas.on('object:added', changed)
    canvas.on('object:removed', changed)
    canvas.on('object:modified', changed)

    canvas.on('object:moving', (event) => {
      const target = event.target as
        | MAQuadroObject
        | undefined

      if (!target || target.maLocked) {
        return
      }

      const center = target.getCenterPoint()
      const snapDistance = Math.max(
        8,
        12 / Math.max(
          zoomRef.current / 100,
          0.05
        )
      )
      let vertical = false
      let horizontal = false

      if (
        Math.abs(
          center.x - canvas.getWidth() / 2
        ) <= snapDistance
      ) {
        target.left +=
          canvas.getWidth() / 2 - center.x
        vertical = true
      }

      if (
        Math.abs(
          center.y - canvas.getHeight() / 2
        ) <= snapDistance
      ) {
        target.top +=
          canvas.getHeight() / 2 - center.y
        horizontal = true
      }

      target.setCoords()
      setGuides({
        vertical,
        horizontal
      })
    })

    canvas.on('mouse:up', () => {
      setGuides({
        vertical: false,
        horizontal: false
      })
    })

    setCanvasReady(true)

    return () => {
      if (autosaveTimerRef.current !== null) {
        window.clearTimeout(autosaveTimerRef.current)
      }

      canvasRef.current = null
      void canvas.dispose()
    }
  }, [commitCanvasChange, syncLayers, syncSelection])

  useEffect(() => {
    if (!canvasReady || initializedRef.current) {
      return
    }

    initializedRef.current = true

    async function initialize() {
      setIsBusy(true)

      try {
        try {
          const response = await fetch(
            '/ma-quadro/brand.json',
            {
              cache: 'no-store'
            }
          )

          if (response.ok) {
            setBrand(
              await response.json() as MAQuadroBrand
            )
          }
        } catch (error) {
          console.error(error)
        }

        await seedMAQuadroStarterDesigns()

        const storedFonts = await listMAQuadroFonts()

        for (const font of storedFonts) {
          try {
            await registerLocalFont(font)
          } catch (error) {
            console.error(error)
          }
        }

        setLocalFonts(storedFonts)

        const storedDesigns = await listMAQuadroDesigns()
        setDesigns(storedDesigns)

        const first =
          storedDesigns.find((item) => !item.isStarter) ||
          storedDesigns[0]

        if (first) {
          await loadDesign(first)
        } else {
          const blank = createBlankMAQuadroDesign(
            1080,
            1080,
            'Design sem título'
          )

          await saveMAQuadroDesign(blank)
          await refreshDesignLibrary()
          await loadDesign(blank)
        }
      } catch (error) {
        console.error(error)
        const blank = createBlankMAQuadroDesign(
          1080,
          1080,
          'Design sem título'
        )

        designRef.current = blank
        setDesign(blank)
        setDesignName(blank.name)
        await loadDesign(blank)
        setStatusMessage(
          'O armazenamento local está indisponível. Pode editar e exportar, mas o browser poderá não guardar o trabalho.'
        )
      } finally {
        setIsBusy(false)
      }
    }

    void initialize()
  }, [canvasReady, loadDesign, refreshDesignLibrary])

  useEffect(() => {
    const handleResize = () => {
      fitCanvas()
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [fitCanvas])

  const addObject = useCallback((object: MAQuadroObject) => {
    const canvas = canvasRef.current

    if (!canvas) {
      return
    }

    canvas.add(object)
    canvas.setActiveObject(object)
    canvas.requestRenderAll()
  }, [])

  const addText = useCallback(() => {
    const canvas = canvasRef.current

    if (!canvas) {
      return
    }

    const text = new Textbox('Escreva aqui', {
      ...objectOrigin(),
      left: canvas.getWidth() * 0.15,
      top: canvas.getHeight() * 0.15,
      width: canvas.getWidth() * 0.7,
      fontFamily: brand.fonts[0]?.family || 'Arial',
      fontSize: Math.max(
        34,
        Math.round(
          Math.min(
            canvas.getWidth(),
            canvas.getHeight()
          ) * 0.07
        )
      ),
      fontWeight: 700,
      fill:
        backgroundColor.toUpperCase() === '#0F172A'
          ? '#FFFFFF'
          : '#0F172A',
      textAlign: 'center'
    }) as MAQuadroObject

    text.maName = 'Texto'
    addObject(text)
  }, [addObject, backgroundColor, brand.fonts])

  const addRectangle = useCallback(() => {
    const canvas = canvasRef.current

    if (!canvas) {
      return
    }

    const rectangle = new Rect({
      ...objectOrigin(),
      left: canvas.getWidth() * 0.25,
      top: canvas.getHeight() * 0.32,
      width: canvas.getWidth() * 0.5,
      height: canvas.getHeight() * 0.25,
      fill: brand.colors[0]?.value || '#22D3EE',
      rx: Math.max(
        12,
        Math.min(
          canvas.getWidth(),
          canvas.getHeight()
        ) * 0.02
      ),
      ry: Math.max(
        12,
        Math.min(
          canvas.getWidth(),
          canvas.getHeight()
        ) * 0.02
      )
    }) as MAQuadroObject

    rectangle.maName = 'Retângulo'
    addObject(rectangle)
  }, [addObject, brand.colors])

  const addLine = useCallback(() => {
    const canvas = canvasRef.current

    if (!canvas) {
      return
    }

    const line = new Line(
      [
        0,
        0,
        canvas.getWidth() * 0.6,
        0
      ],
      {
        ...objectOrigin(),
        left: canvas.getWidth() * 0.2,
        top: canvas.getHeight() * 0.5,
        stroke: brand.colors[2]?.value || '#8B5CF6',
        strokeWidth: Math.max(
          4,
          Math.min(
            canvas.getWidth(),
            canvas.getHeight()
          ) * 0.008
        )
      }
    ) as MAQuadroObject

    line.maName = 'Linha'
    addObject(line)
  }, [addObject, brand.colors])

  const handleImageUpload = useCallback(async (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0]
    const canvas = canvasRef.current

    event.target.value = ''

    if (!file || !canvas) {
      return
    }

    setIsBusy(true)

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()

        reader.onload = () => {
          if (typeof reader.result === 'string') {
            resolve(reader.result)
          } else {
            reject(new Error('Imagem inválida.'))
          }
        }

        reader.onerror = () => {
          reject(
            reader.error ||
            new Error('Não foi possível ler a imagem.')
          )
        }

        reader.readAsDataURL(file)
      })
      const image = await FabricImage.fromURL(dataUrl) as MAQuadroObject
      const imageWidth = image.width || 1
      const imageHeight = image.height || 1
      const scale = Math.min(
        canvas.getWidth() * 0.72 / imageWidth,
        canvas.getHeight() * 0.72 / imageHeight,
        1
      )

      image.set({
        ...objectOrigin(),
        left:
          (canvas.getWidth() - imageWidth * scale) / 2,
        top:
          (canvas.getHeight() - imageHeight * scale) / 2,
        scaleX: scale,
        scaleY: scale
      })
      image.maName = file.name
      addObject(image)
      setStatusMessage(
        'Imagem adicionada. O ficheiro permanece apenas neste dispositivo.'
      )
    } catch (error) {
      console.error(error)
      setStatusMessage(
        'Não foi possível adicionar esta imagem.'
      )
    } finally {
      setIsBusy(false)
    }
  }, [addObject])

  const removeSelection = useCallback(() => {
    const canvas = canvasRef.current
    const selected = canvas?.getActiveObjects() || []

    if (!canvas || selected.length === 0) {
      return
    }

    isLoadingRef.current = true

    try {
      canvas.remove(...selected)
      canvas.discardActiveObject()
      canvas.requestRenderAll()
    } finally {
      isLoadingRef.current = false
    }

    commitCanvasChange(
      selected.length === 1
        ? 'Elemento eliminado.'
        : 'Elementos eliminados.'
    )
  }, [commitCanvasChange])

  const copySelection = useCallback(async () => {
    const object = canvasRef.current?.getActiveObject() as
      | MAQuadroObject
      | undefined

    if (!object) {
      return
    }

    clipboardRef.current = await object.clone() as MAQuadroObject
    setStatusMessage('Elemento copiado.')
  }, [])

  const pasteSelection = useCallback(async () => {
    const canvas = canvasRef.current
    const source = clipboardRef.current

    if (!canvas || !source) {
      return
    }

    const clone = await source.clone() as MAQuadroObject

    clone.set({
      left: (source.left || 0) + 28,
      top: (source.top || 0) + 28,
      evented: true,
      selectable: true
    })
    clone.maName = `${getObjectName(source, 0)} cópia`
    canvas.add(clone)
    canvas.setActiveObject(clone)
    canvas.requestRenderAll()
    clipboardRef.current = clone
  }, [])

  const duplicateSelection = useCallback(async () => {
    await copySelection()
    await pasteSelection()
  }, [copySelection, pasteSelection])

  const alignSelection = useCallback((
    alignment:
      | 'left'
      | 'center-x'
      | 'right'
      | 'top'
      | 'center-y'
      | 'bottom'
  ) => {
    const canvas = canvasRef.current
    const object = canvas?.getActiveObject() as
      | MAQuadroObject
      | undefined

    if (!canvas || !object || object.maLocked) {
      return
    }

    const bounds = object.getBoundingRect()

    if (alignment === 'left') {
      object.left += -bounds.left
    }

    if (alignment === 'center-x') {
      object.left +=
        canvas.getWidth() / 2 -
        (bounds.left + bounds.width / 2)
    }

    if (alignment === 'right') {
      object.left +=
        canvas.getWidth() -
        (bounds.left + bounds.width)
    }

    if (alignment === 'top') {
      object.top += -bounds.top
    }

    if (alignment === 'center-y') {
      object.top +=
        canvas.getHeight() / 2 -
        (bounds.top + bounds.height / 2)
    }

    if (alignment === 'bottom') {
      object.top +=
        canvas.getHeight() -
        (bounds.top + bounds.height)
    }

    object.setCoords()
    canvas.requestRenderAll()
    commitCanvasChange('Alinhamento atualizado.')
  }, [commitCanvasChange])

  const moveSelectionBy = useCallback((
    x: number,
    y: number
  ) => {
    const canvas = canvasRef.current
    const object = canvas?.getActiveObject() as
      | MAQuadroObject
      | undefined

    if (!canvas || !object || object.maLocked) {
      return
    }

    object.set({
      left: (object.left || 0) + x,
      top: (object.top || 0) + y
    })
    object.setCoords()
    canvas.requestRenderAll()
    commitCanvasChange('Posição atualizada.')
  }, [commitCanvasChange])

  const applyHistorySnapshot = useCallback(async (
    serialized: string
  ) => {
    const canvas = canvasRef.current

    if (!canvas) {
      return
    }

    const snapshot = JSON.parse(
      serialized
    ) as MAQuadroHistorySnapshot

    isApplyingHistoryRef.current = true

    try {
      canvas.discardActiveObject()
      canvas.clear()
      await canvas.loadFromJSON(
        normalizeCanvasJson(snapshot.canvasJson)
      )
      canvas.backgroundColor = snapshot.transparentBackground
        ? ''
        : snapshot.backgroundColor
      canvas.requestRenderAll()
      backgroundColorRef.current = snapshot.backgroundColor
      transparentBackgroundRef.current =
        snapshot.transparentBackground
      setBackgroundColor(snapshot.backgroundColor)
      setTransparentBackground(
        snapshot.transparentBackground
      )
      syncLayers()
      syncSelection()
    } finally {
      isApplyingHistoryRef.current = false
    }

    scheduleAutosave('Histórico aplicado.')
  }, [scheduleAutosave, syncLayers, syncSelection])

  const undo = useCallback(async () => {
    if (historyIndexRef.current <= 0) {
      return
    }

    historyIndexRef.current -= 1
    await applyHistorySnapshot(
      historyRef.current[historyIndexRef.current]
    )
    updateHistoryButtons()
  }, [applyHistorySnapshot, updateHistoryButtons])

  const redo = useCallback(async () => {
    if (
      historyIndexRef.current >=
      historyRef.current.length - 1
    ) {
      return
    }

    historyIndexRef.current += 1
    await applyHistorySnapshot(
      historyRef.current[historyIndexRef.current]
    )
    updateHistoryButtons()
  }, [applyHistorySnapshot, updateHistoryButtons])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const canvas = canvasRef.current
      const active = canvas?.getActiveObject() as
        | MAQuadroObject
        | undefined
      const modifier = event.ctrlKey || event.metaKey

      if (
        targetIsFormControl(event.target) ||
        active?.isEditing
      ) {
        return
      }

      if (modifier && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        void (event.shiftKey ? redo() : undo())
        return
      }

      if (modifier && event.key.toLowerCase() === 'y') {
        event.preventDefault()
        void redo()
        return
      }

      if (modifier && event.key.toLowerCase() === 'c') {
        event.preventDefault()
        void copySelection()
        return
      }

      if (modifier && event.key.toLowerCase() === 'v') {
        event.preventDefault()
        void pasteSelection()
        return
      }

      if (modifier && event.key.toLowerCase() === 'd') {
        event.preventDefault()
        void duplicateSelection()
        return
      }

      if (
        event.key === 'Delete' ||
        event.key === 'Backspace'
      ) {
        if (canvas?.getActiveObjects().length) {
          event.preventDefault()
          removeSelection()
        }
        return
      }

      if (event.key === 'Escape') {
        canvas?.discardActiveObject()
        canvas?.requestRenderAll()
        syncSelection()
        return
      }

      const step = event.shiftKey ? 10 : 1

      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        moveSelectionBy(-step, 0)
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault()
        moveSelectionBy(step, 0)
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        moveSelectionBy(0, -step)
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        moveSelectionBy(0, step)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [
    copySelection,
    duplicateSelection,
    moveSelectionBy,
    pasteSelection,
    redo,
    removeSelection,
    syncSelection,
    undo
  ])

  const applyObjectPatch = useCallback((
    patch: Record<string, unknown>,
    message: string
  ) => {
    const canvas = canvasRef.current
    const object = canvas?.getActiveObject() as
      | MAQuadroObject
      | undefined

    if (!canvas || !object) {
      return
    }

    object.set(patch)
    object.setCoords()
    canvas.requestRenderAll()
    syncSelection()
    commitCanvasChange(message)
  }, [commitCanvasChange, syncSelection])

  const applyFillColor = useCallback((color: string) => {
    const canvas = canvasRef.current
    const object = canvas?.getActiveObject() as
      | MAQuadroObject
      | undefined

    setProperties((current) => ({
      ...current,
      fill: color
    }))

    if (!canvas) {
      return
    }

    if (!object) {
      backgroundColorRef.current = color
      setBackgroundColor(color)
      canvas.backgroundColor = transparentBackground
        ? ''
        : color
      canvas.requestRenderAll()
      pushHistory()
      scheduleAutosave('Cor de fundo atualizada.')
      return
    }

    if (object instanceof Line) {
      object.set({
        stroke: color
      })
    } else {
      object.set({
        fill: color
      })
    }

    object.setCoords()
    canvas.requestRenderAll()
    commitCanvasChange('Cor atualizada.')
  }, [
    commitCanvasChange,
    pushHistory,
    scheduleAutosave,
    transparentBackground
  ])

  const setBackgroundTransparency = useCallback((
    transparent: boolean
  ) => {
    const canvas = canvasRef.current

    if (!canvas) {
      return
    }

    transparentBackgroundRef.current = transparent
    setTransparentBackground(transparent)
    canvas.backgroundColor = transparent
      ? ''
      : backgroundColorRef.current
    canvas.requestRenderAll()
    pushHistory()
    scheduleAutosave(
      transparent
        ? 'Fundo transparente ativado.'
        : 'Fundo com cor ativado.'
    )
  }, [pushHistory, scheduleAutosave])

  const setLayerVisibility = useCallback((
    object: MAQuadroObject
  ) => {
    const canvas = canvasRef.current

    if (!canvas) {
      return
    }

    object.set({
      visible: object.visible === false
    })
    canvas.discardActiveObject()
    canvas.requestRenderAll()
    commitCanvasChange(
      'Visibilidade da camada atualizada.'
    )
  }, [commitCanvasChange])

  const setLayerLocked = useCallback((
    object: MAQuadroObject
  ) => {
    const canvas = canvasRef.current

    if (!canvas) {
      return
    }

    const locked = !object.maLocked

    object.maLocked = locked
    object.set({
      selectable: !locked,
      evented: !locked,
      lockMovementX: locked,
      lockMovementY: locked,
      lockRotation: locked,
      lockScalingX: locked,
      lockScalingY: locked
    })
    canvas.discardActiveObject()
    canvas.requestRenderAll()
    commitCanvasChange(
      locked
        ? 'Camada bloqueada.'
        : 'Camada desbloqueada.'
    )
  }, [commitCanvasChange])

  const moveLayer = useCallback((
    object: MAQuadroObject,
    direction: 'up' | 'down'
  ) => {
    const canvas = canvasRef.current

    if (!canvas) {
      return
    }

    const objects = canvas.getObjects()
    const index = objects.indexOf(object)
    const nextIndex = direction === 'up'
      ? Math.min(objects.length - 1, index + 1)
      : Math.max(0, index - 1)

    canvas.moveObjectTo(object, nextIndex)
    canvas.requestRenderAll()
    commitCanvasChange(
      'Ordem das camadas atualizada.'
    )
  }, [commitCanvasChange])

  const createDesignFromPreset = useCallback(async (
    width: number,
    height: number,
    name: string
  ) => {
    if (designRef.current) {
      await saveWorkingDesign(true)
    }

    const blank = createBlankMAQuadroDesign(
      width,
      height,
      name
    )

    await saveMAQuadroDesign(blank)
    await refreshDesignLibrary()
    await loadDesign(blank)
    setActivePanel('elements')
    setStatusMessage(
      'Novo design criado e guardado localmente.'
    )
  }, [loadDesign, refreshDesignLibrary, saveWorkingDesign])

  const applyCustomSize = useCallback(() => {
    const width = Number(customWidth)
    const height = Number(customHeight)

    if (
      !Number.isFinite(width) ||
      !Number.isFinite(height) ||
      width < 100 ||
      height < 100 ||
      width > 8000 ||
      height > 8000
    ) {
      setStatusMessage(
        'Use medidas entre 100 e 8000 píxeis.'
      )
      return
    }

    setShowCustomSize(false)
    void createDesignFromPreset(
      Math.round(width),
      Math.round(height),
      `Design ${Math.round(width)} × ${Math.round(height)}`
    )
  }, [
    createDesignFromPreset,
    customHeight,
    customWidth
  ])

  const openLibraryDesign = useCallback(async (
    record: MAQuadroDesign
  ) => {
    if (designRef.current) {
      await saveWorkingDesign(true)
    }

    await loadDesign(record)
    setActivePanel('elements')
  }, [loadDesign, saveWorkingDesign])

  const duplicateDesign = useCallback(async (
    record: MAQuadroDesign
  ) => {
    const copy = cloneDesignAsUserCopy(
      record,
      `${record.name} — cópia`
    )

    setIsBusy(true)

    try {
      await saveMAQuadroDesign(copy)
      await refreshDesignLibrary()
      await loadDesign(copy)
      setActivePanel('elements')
      setStatusMessage(
        'Modelo duplicado. A cópia pode ser alterada sem modificar o original.'
      )
    } catch (error) {
      console.error(error)
      setStatusMessage(
        'Não foi possível duplicar este design.'
      )
    } finally {
      setIsBusy(false)
    }
  }, [loadDesign, refreshDesignLibrary])

  const removeDesign = useCallback(async (
    record: MAQuadroDesign
  ) => {
    if (record.isStarter) {
      setStatusMessage(
        'Os três modelos iniciais permanecem sempre disponíveis.'
      )
      return
    }

    if (
      !window.confirm(
        `Eliminar “${record.name}” deste dispositivo?`
      )
    ) {
      return
    }

    setIsBusy(true)

    try {
      await deleteMAQuadroDesign(record.id)
      const remaining = await listMAQuadroDesigns()

      setDesigns(remaining)

      if (designRef.current?.id === record.id) {
        const next = remaining[0]

        if (next) {
          await loadDesign(next)
        }
      }

      setStatusMessage(
        'Design eliminado deste dispositivo.'
      )
    } catch (error) {
      console.error(error)
      setStatusMessage(
        'Não foi possível eliminar o design.'
      )
    } finally {
      setIsBusy(false)
    }
  }, [loadDesign])

  const exportProject = useCallback(() => {
    const current = captureCurrentDesign()

    if (!current) {
      return
    }

    exportMAQuadroDesignJson(current)
    setStatusMessage(
      'Projeto editável exportado em JSON.'
    )
  }, [captureCurrentDesign])

  const importProject = useCallback(async (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0]

    event.target.value = ''

    if (!file) {
      return
    }

    setIsBusy(true)

    try {
      const parsed = JSON.parse(
        await file.text()
      ) as unknown

      if (!isImportedDesign(parsed)) {
        throw new Error('Projeto inválido.')
      }

      const imported = cloneDesignAsUserCopy(
        parsed,
        parsed.name
      )

      await saveMAQuadroDesign(imported)
      await refreshDesignLibrary()
      await loadDesign(imported)
      setActivePanel('elements')
      setStatusMessage(
        `“${imported.name}” importado e guardado neste dispositivo.`
      )
    } catch (error) {
      console.error(error)
      setStatusMessage(
        'Este ficheiro não é um projeto MA-Quadro válido.'
      )
    } finally {
      setIsBusy(false)
    }
  }, [loadDesign, refreshDesignLibrary])

  const handleFontUpload = useCallback(async (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0]

    event.target.value = ''

    if (!file) {
      return
    }

    setIsBusy(true)

    try {
      const family = file.name
        .replace(/\.(ttf|otf|woff2?)$/i, '')
        .replace(/[-_]+/g, ' ')
        .trim() || 'Fonte local'
      const existing = localFonts.find(
        (font) =>
          font.family.toLowerCase() ===
          family.toLowerCase()
      )
      const record: MAQuadroStoredFont = {
        id: existing?.id || createMAQuadroId('font'),
        family,
        fileName: file.name,
        mimeType: file.type || 'font/ttf',
        data: await file.arrayBuffer(),
        createdAt:
          existing?.createdAt ||
          new Date().toISOString()
      }

      await registerLocalFont(record)
      await saveMAQuadroFont(record)
      setLocalFonts(await listMAQuadroFonts())
      setStatusMessage(
        `Fonte “${record.family}” adicionada e guardada neste dispositivo.`
      )
    } catch (error) {
      console.error(error)
      setStatusMessage(
        'Não foi possível carregar esta fonte.'
      )
    } finally {
      setIsBusy(false)
    }
  }, [localFonts])

  const removeFont = useCallback(async (
    fontId: string
  ) => {
    try {
      await deleteMAQuadroFont(fontId)
      setLocalFonts(await listMAQuadroFonts())
      setStatusMessage(
        'Fonte removida do armazenamento local. Deixará de estar ativa quando recarregar a página.'
      )
    } catch (error) {
      console.error(error)
      setStatusMessage(
        'Não foi possível eliminar a fonte.'
      )
    }
  }, [])

  const selectedIsText = selectedObject instanceof Textbox
  const selectedIsRectangle = selectedObject instanceof Rect

  return (
    <main className="ma-quadro">
      <header className="ma-quadro__header">
        <div className="ma-quadro__brand">
          <a
            href="/produtos"
            className="ma-quadro__back"
            aria-label="Voltar aos produtos"
          >
            ←
          </a>
          <a
            href="/"
            className="ma-quadro__brand-link"
            aria-label="MA-Code.pt"
          >
            <img
              src="/ma-code.png"
              alt="MA-Code.pt"
              className="ma-quadro__logo"
            />
            <span className="ma-quadro__brand-copy">
              <span className="ma-quadro__brand-title">
                MA-Quadro
              </span>
              <span className="ma-quadro__brand-subtitle">
                Editor de design local
              </span>
            </span>
          </a>
        </div>

        <div className="ma-quadro__header-center">
          <input
            className="ma-quadro__title-input"
            value={designName}
            onChange={(event) => {
              setDesignName(event.target.value)
              designNameRef.current = event.target.value
              scheduleAutosave(
                'Nome do design atualizado.'
              )
            }}
            aria-label="Nome do design"
          />
          <span className="ma-quadro__save-state">
            {saveState}
          </span>
        </div>

        <div className="ma-quadro__header-actions">
          <button
            type="button"
            className="ma-quadro__button"
            onClick={() =>
              projectInputRef.current?.click()
            }
          >
            Importar
          </button>
          <button
            type="button"
            className="ma-quadro__button ma-quadro__button--primary"
            onClick={() => void saveWorkingDesign(false)}
            disabled={isBusy || !design}
          >
            Guardar
          </button>
          <input
            ref={projectInputRef}
            type="file"
            accept="application/json,.json"
            onChange={(event) => void importProject(event)}
            hidden
          />
        </div>
      </header>

      <div className="ma-quadro__layout">
        <aside className="ma-quadro__panel ma-quadro__panel--left">
          <div className="ma-quadro__tabs">
            {([
              ['templates', 'Modelos'],
              ['elements', 'Elementos'],
              ['brand', 'Marca'],
              ['designs', 'Designs']
            ] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`ma-quadro__tab${
                  activePanel === id
                    ? ' ma-quadro__tab--active'
                    : ''
                }`}
                onClick={() => setActivePanel(id)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="ma-quadro__panel-scroll">
            {activePanel === 'templates' ? (
              <>
                <section className="ma-quadro__section">
                  <div className="ma-quadro__section-heading">
                    <h2 className="ma-quadro__section-title">
                      Novo design
                    </h2>
                    <button
                      type="button"
                      className="ma-quadro__text-link"
                      onClick={() => setShowCustomSize(true)}
                    >
                      Personalizado
                    </button>
                  </div>
                  <div className="ma-quadro__grid">
                    {MA_QUADRO_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        className="ma-quadro__preset"
                        onClick={() =>
                          void createDesignFromPreset(
                            preset.width,
                            preset.height,
                            preset.name
                          )
                        }
                      >
                        <strong>{preset.name}</strong>
                        <span>
                          {preset.width} × {preset.height} · {preset.description}
                        </span>
                      </button>
                    ))}
                  </div>
                </section>

                <section className="ma-quadro__section">
                  <div className="ma-quadro__section-heading">
                    <h2 className="ma-quadro__section-title">
                      Modelos iniciais
                    </h2>
                    <span className="ma-quadro__section-note">
                      Duplicar para editar
                    </span>
                  </div>
                  {designs
                    .filter((item) => item.isStarter)
                    .map((item) => (
                      <article
                        key={item.id}
                        className="ma-quadro__design-card"
                      >
                        <button
                          type="button"
                          className="ma-quadro__design-open"
                          onClick={() =>
                            void openLibraryDesign(item)
                          }
                        >
                          <span className="ma-quadro__thumbnail">
                            {item.thumbnail ? (
                              <img
                                src={item.thumbnail}
                                alt=""
                              />
                            ) : (
                              'MQ'
                            )}
                          </span>
                          <span className="ma-quadro__design-copy">
                            <strong>{item.name}</strong>
                            <span>
                              {item.width} × {item.height}
                            </span>
                            <span className="ma-quadro__badge">
                              Modelo
                            </span>
                          </span>
                        </button>
                        <div className="ma-quadro__card-actions">
                          <button
                            type="button"
                            className="ma-quadro__small-button"
                            onClick={() =>
                              void duplicateDesign(item)
                            }
                          >
                            Duplicar modelo
                          </button>
                          <button
                            type="button"
                            className="ma-quadro__small-button"
                            onClick={() =>
                              void openLibraryDesign(item)
                            }
                          >
                            Pré-visualizar
                          </button>
                        </div>
                      </article>
                    ))}
                </section>
              </>
            ) : null}

            {activePanel === 'elements' ? (
              <>
                <section className="ma-quadro__section">
                  <h2 className="ma-quadro__section-title">
                    Adicionar elementos
                  </h2>
                  <div
                    className="ma-quadro__tool-grid"
                    style={{
                      marginTop: '0.72rem'
                    }}
                  >
                    <button
                      type="button"
                      className="ma-quadro__tool"
                      onClick={addText}
                    >
                      <span>T</span>
                      Texto
                    </button>
                    <button
                      type="button"
                      className="ma-quadro__tool"
                      onClick={() =>
                        imageInputRef.current?.click()
                      }
                    >
                      <span>▧</span>
                      Imagem
                    </button>
                    <button
                      type="button"
                      className="ma-quadro__tool"
                      onClick={addRectangle}
                    >
                      <span>▭</span>
                      Retângulo
                    </button>
                    <button
                      type="button"
                      className="ma-quadro__tool"
                      onClick={addLine}
                    >
                      <span>─</span>
                      Linha
                    </button>
                  </div>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={(event) =>
                      void handleImageUpload(event)
                    }
                    hidden
                  />
                </section>

                <section className="ma-quadro__section">
                  <h2 className="ma-quadro__section-title">
                    Alinhar no quadro
                  </h2>
                  <div
                    className="ma-quadro__grid ma-quadro__grid--2"
                    style={{
                      marginTop: '0.72rem'
                    }}
                  >
                    <EditorButton
                      onClick={() => alignSelection('left')}
                      disabled={!selectedObject}
                    >
                      Esquerda
                    </EditorButton>
                    <EditorButton
                      onClick={() => alignSelection('right')}
                      disabled={!selectedObject}
                    >
                      Direita
                    </EditorButton>
                    <EditorButton
                      onClick={() => alignSelection('top')}
                      disabled={!selectedObject}
                    >
                      Superior
                    </EditorButton>
                    <EditorButton
                      onClick={() => alignSelection('bottom')}
                      disabled={!selectedObject}
                    >
                      Inferior
                    </EditorButton>
                    <EditorButton
                      onClick={() => alignSelection('center-x')}
                      disabled={!selectedObject}
                    >
                      Centro X
                    </EditorButton>
                    <EditorButton
                      onClick={() => alignSelection('center-y')}
                      disabled={!selectedObject}
                    >
                      Centro Y
                    </EditorButton>
                  </div>
                </section>

                <section className="ma-quadro__section">
                  <h2 className="ma-quadro__section-title">
                    Seleção
                  </h2>
                  <div
                    className="ma-quadro__grid ma-quadro__grid--2"
                    style={{
                      marginTop: '0.72rem'
                    }}
                  >
                    <EditorButton
                      onClick={() => void duplicateSelection()}
                      disabled={!selectedObject}
                    >
                      Duplicar
                    </EditorButton>
                    <EditorButton
                      onClick={removeSelection}
                      disabled={!selectedObject}
                      danger
                    >
                      Eliminar
                    </EditorButton>
                  </div>
                </section>

                <div className="ma-quadro__privacy">
                  Atalhos: Ctrl/Cmd + C, V, D, Z e Y. Use Delete para eliminar e as setas para mover. Segure Shift para mover 10 px.
                </div>
              </>
            ) : null}

            {activePanel === 'brand' ? (
              <>
                <section className="ma-quadro__section">
                  <div className="ma-quadro__section-heading">
                    <h2 className="ma-quadro__section-title">
                      Cores {brand.name}
                    </h2>
                    <span className="ma-quadro__section-note">
                      Fundo sem seleção
                    </span>
                  </div>
                  <div className="ma-quadro__swatches">
                    {brand.colors.map((color) => (
                      <button
                        key={color.value}
                        type="button"
                        className="ma-quadro__swatch"
                        onClick={() =>
                          applyFillColor(color.value)
                        }
                      >
                        <span
                          className="ma-quadro__swatch-color"
                          style={{
                            backgroundColor: color.value
                          }}
                        />
                        <strong>{color.name}</strong>
                        <small>{color.value}</small>
                      </button>
                    ))}
                  </div>
                </section>

                <section className="ma-quadro__section">
                  <h2 className="ma-quadro__section-title">
                    Fontes da marca
                  </h2>
                  <div style={{ marginTop: '0.72rem' }}>
                    {brand.fonts.map((font) => (
                      <button
                        key={font.family}
                        type="button"
                        className="ma-quadro__font-card"
                        onClick={() =>
                          applyObjectPatch(
                            {
                              fontFamily: font.family
                            },
                            'Fonte atualizada.'
                          )
                        }
                        disabled={!selectedIsText}
                      >
                        <span>
                          <span
                            className="ma-quadro__font-preview"
                            style={{
                              fontFamily: `${font.family}, ${font.fallback || 'sans-serif'}`
                            }}
                          >
                            Aa — {font.name}
                          </span>
                          <span className="ma-quadro__font-name">
                            {font.family}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                </section>

                <section className="ma-quadro__section">
                  <div className="ma-quadro__section-heading">
                    <h2 className="ma-quadro__section-title">
                      Fontes locais
                    </h2>
                    <button
                      type="button"
                      className="ma-quadro__text-link"
                      onClick={() =>
                        fontInputRef.current?.click()
                      }
                    >
                      Adicionar
                    </button>
                  </div>
                  <input
                    ref={fontInputRef}
                    type="file"
                    accept=".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2"
                    onChange={(event) =>
                      void handleFontUpload(event)
                    }
                    hidden
                  />
                  {localFonts.length === 0 ? (
                    <div className="ma-quadro__empty">
                      Adicione TTF, OTF, WOFF ou WOFF2. A fonte fica guardada apenas neste browser.
                    </div>
                  ) : (
                    localFonts.map((font) => (
                      <div
                        key={font.id}
                        className="ma-quadro__font-card"
                      >
                        <button
                          type="button"
                          className="ma-quadro__font-main"
                          onClick={() =>
                            applyObjectPatch(
                              {
                                fontFamily: font.family
                              },
                              'Fonte local aplicada.'
                            )
                          }
                          disabled={!selectedIsText}
                        >
                          <span
                            className="ma-quadro__font-preview"
                            style={{
                              fontFamily: font.family
                            }}
                          >
                            Aa — {font.family}
                          </span>
                          <span className="ma-quadro__font-name">
                            {font.fileName}
                          </span>
                        </button>
                        <button
                          type="button"
                          className="ma-quadro__mini-icon"
                          onClick={() =>
                            void removeFont(font.id)
                          }
                          title="Eliminar fonte local"
                        >
                          ×
                        </button>
                      </div>
                    ))
                  )}
                </section>
              </>
            ) : null}

            {activePanel === 'designs' ? (
              <>
                <section className="ma-quadro__section">
                  <div className="ma-quadro__grid ma-quadro__grid--2">
                    <EditorButton onClick={exportProject}>
                      Exportar JSON
                    </EditorButton>
                    <EditorButton
                      onClick={() =>
                        projectInputRef.current?.click()
                      }
                    >
                      Importar JSON
                    </EditorButton>
                  </div>
                </section>

                <section className="ma-quadro__section">
                  <div className="ma-quadro__section-heading">
                    <h2 className="ma-quadro__section-title">
                      Os seus designs
                    </h2>
                    <span className="ma-quadro__section-note">
                      {designs.filter((item) => !item.isStarter).length}
                    </span>
                  </div>
                  {designs.filter((item) => !item.isStarter).length === 0 ? (
                    <div className="ma-quadro__empty">
                      Os designs guardados neste browser aparecem aqui.
                    </div>
                  ) : null}
                  {designs
                    .filter((item) => !item.isStarter)
                    .map((item) => (
                      <article
                        key={item.id}
                        className={`ma-quadro__design-card${
                          design?.id === item.id
                            ? ' ma-quadro__design-card--active'
                            : ''
                        }`}
                      >
                        <button
                          type="button"
                          className="ma-quadro__design-open"
                          onClick={() =>
                            void openLibraryDesign(item)
                          }
                        >
                          <span className="ma-quadro__thumbnail">
                            {item.thumbnail ? (
                              <img
                                src={item.thumbnail}
                                alt=""
                              />
                            ) : (
                              'MQ'
                            )}
                          </span>
                          <span className="ma-quadro__design-copy">
                            <strong>{item.name}</strong>
                            <span>
                              {item.width} × {item.height}
                            </span>
                            <span>
                              {new Date(
                                item.updatedAt
                              ).toLocaleDateString('pt-PT')}
                            </span>
                          </span>
                        </button>
                        <div className="ma-quadro__card-actions">
                          <button
                            type="button"
                            className="ma-quadro__small-button"
                            onClick={() =>
                              void duplicateDesign(item)
                            }
                          >
                            Duplicar
                          </button>
                          <button
                            type="button"
                            className="ma-quadro__small-button"
                            onClick={() =>
                              void removeDesign(item)
                            }
                          >
                            Eliminar
                          </button>
                        </div>
                      </article>
                    ))}
                </section>

                <div className="ma-quadro__privacy">
                  Os designs vivem no IndexedDB deste browser. Exporte regularmente o JSON para ter uma cópia de segurança e abrir o projeto noutro dispositivo.
                </div>
              </>
            ) : null}
          </div>
        </aside>

        <section className="ma-quadro__workspace-shell">
          <div className="ma-quadro__toolbar">
            <div className="ma-quadro__toolbar-group">
              <button
                type="button"
                className="ma-quadro__icon-button"
                onClick={() => void undo()}
                disabled={!canUndo}
                title="Desfazer"
              >
                ↶
              </button>
              <button
                type="button"
                className="ma-quadro__icon-button"
                onClick={() => void redo()}
                disabled={!canRedo}
                title="Refazer"
              >
                ↷
              </button>
              <EditorButton
                onClick={() => void duplicateSelection()}
                disabled={!selectedObject}
              >
                Duplicar
              </EditorButton>
              <EditorButton
                onClick={removeSelection}
                disabled={!selectedObject}
                danger
              >
                Eliminar
              </EditorButton>
            </div>

            <div className="ma-quadro__toolbar-group">
              <EditorButton
                onClick={() => {
                  const canvas = canvasRef.current

                  if (canvas) {
                    exportMAQuadroPng(
                      canvas,
                      designNameRef.current,
                      1
                    )
                  }
                }}
              >
                PNG 1x
              </EditorButton>
              <EditorButton
                onClick={() => {
                  const canvas = canvasRef.current

                  if (canvas) {
                    exportMAQuadroPng(
                      canvas,
                      designNameRef.current,
                      2
                    )
                  }
                }}
              >
                PNG 2x
              </EditorButton>
              <EditorButton
                onClick={() => {
                  const canvas = canvasRef.current

                  if (canvas) {
                    void exportMAQuadroPdf(
                      canvas,
                      designNameRef.current
                    )
                  }
                }}
                disabled={isBusy}
              >
                PDF
              </EditorButton>
              <EditorButton onClick={exportProject}>
                Projeto
              </EditorButton>
            </div>
          </div>

          <div
            ref={workspaceRef}
            className="ma-quadro__workspace"
          >
            <div
              className="ma-quadro__canvas-wrap"
              style={{
                width: design
                  ? design.width * zoom / 100
                  : 540,
                height: design
                  ? design.height * zoom / 100
                  : 540
              }}
            >
              <canvas ref={canvasElementRef} />
              {guides.vertical && design ? (
                <span
                  className="ma-quadro__guide ma-quadro__guide--vertical"
                  style={{
                    left: design.width * zoom / 200
                  }}
                />
              ) : null}
              {guides.horizontal && design ? (
                <span
                  className="ma-quadro__guide ma-quadro__guide--horizontal"
                  style={{
                    top: design.height * zoom / 200
                  }}
                />
              ) : null}
            </div>
          </div>

          <div
            className="ma-quadro__status"
            role="status"
            aria-live="polite"
          >
            <span>
              <strong>
                {isBusy ? 'A processar… ' : ''}
              </strong>
              {statusMessage}
            </span>
            <span className="ma-quadro__zoom">
              <button
                type="button"
                className="ma-quadro__mini-icon"
                onClick={fitCanvas}
              >
                Ajustar
              </button>
              <input
                type="range"
                min="5"
                max="200"
                value={zoom}
                onChange={(event) =>
                  applyZoom(Number(event.target.value))
                }
                aria-label="Zoom"
              />
              <span>{zoom}%</span>
            </span>
          </div>
        </section>

        <aside className="ma-quadro__panel ma-quadro__panel--right">
          <div className="ma-quadro__panel-scroll">
            <section className="ma-quadro__section">
              <div className="ma-quadro__section-heading">
                <h2 className="ma-quadro__section-title">
                  Propriedades
                </h2>
                <span className="ma-quadro__section-note">
                  {selectedObject
                    ? getObjectTypeLabel(selectedObject)
                    : 'Fundo'}
                </span>
              </div>

              {selectedObject ? (
                <label className="ma-quadro__field">
                  <span className="ma-quadro__label-row">
                    Nome da camada
                  </span>
                  <input
                    className="ma-quadro__input"
                    value={properties.name}
                    onChange={(event) => {
                      const name = event.target.value

                      setProperties((current) => ({
                        ...current,
                        name
                      }))
                      selectedObject.maName = name
                      commitCanvasChange(
                        'Nome da camada atualizado.'
                      )
                    }}
                  />
                </label>
              ) : null}

              <label className="ma-quadro__field">
                <span className="ma-quadro__label-row">
                  {selectedObject
                    ? 'Cor principal'
                    : 'Cor do fundo'}
                </span>
                <span className="ma-quadro__color-row">
                  <input
                    type="color"
                    className="ma-quadro__color"
                    value={properties.fill}
                    onChange={(event) =>
                      applyFillColor(event.target.value)
                    }
                    disabled={
                      !selectedObject &&
                      transparentBackground
                    }
                  />
                  <input
                    className="ma-quadro__input"
                    value={properties.fill}
                    onChange={(event) =>
                      applyFillColor(event.target.value)
                    }
                    disabled={
                      !selectedObject &&
                      transparentBackground
                    }
                  />
                </span>
              </label>

              {!selectedObject ? (
                <label className="ma-quadro__field ma-quadro__toggle-row">
                  <input
                    type="checkbox"
                    checked={transparentBackground}
                    onChange={(event) =>
                      setBackgroundTransparency(
                        event.target.checked
                      )
                    }
                  />
                  <span className="ma-quadro__muted">
                    Fundo transparente
                  </span>
                </label>
              ) : null}

              {selectedObject ? (
                <>
                  <label className="ma-quadro__field">
                    <span className="ma-quadro__label-row">
                      <span>Opacidade</span>
                      <span>{properties.opacity}%</span>
                    </span>
                    <input
                      type="range"
                      className="ma-quadro__range"
                      min="0"
                      max="100"
                      value={properties.opacity}
                      onChange={(event) => {
                        const value = Number(
                          event.target.value
                        )

                        setProperties((current) => ({
                          ...current,
                          opacity: value
                        }))
                        applyObjectPatch(
                          {
                            opacity: value / 100
                          },
                          'Opacidade atualizada.'
                        )
                      }}
                    />
                  </label>

                  <label className="ma-quadro__field">
                    <span className="ma-quadro__label-row">
                      <span>Rotação</span>
                      <span>{properties.angle}°</span>
                    </span>
                    <input
                      type="range"
                      className="ma-quadro__range"
                      min="-180"
                      max="180"
                      value={properties.angle}
                      onChange={(event) => {
                        const value = Number(
                          event.target.value
                        )

                        setProperties((current) => ({
                          ...current,
                          angle: value
                        }))
                        applyObjectPatch(
                          {
                            angle: value
                          },
                          'Rotação atualizada.'
                        )
                      }}
                    />
                  </label>

                  <label className="ma-quadro__field">
                    <span className="ma-quadro__label-row">
                      Contorno
                    </span>
                    <span className="ma-quadro__color-row">
                      <input
                        type="color"
                        className="ma-quadro__color"
                        value={properties.stroke}
                        onChange={(event) => {
                          const value = event.target.value

                          setProperties((current) => ({
                            ...current,
                            stroke: value
                          }))
                          applyObjectPatch(
                            {
                              stroke: value
                            },
                            'Contorno atualizado.'
                          )
                        }}
                      />
                      <input
                        type="number"
                        className="ma-quadro__number"
                        min="0"
                        max="100"
                        value={properties.strokeWidth}
                        onChange={(event) => {
                          const value = Number(
                            event.target.value
                          )

                          setProperties((current) => ({
                            ...current,
                            strokeWidth: value
                          }))
                          applyObjectPatch(
                            {
                              strokeWidth: value
                            },
                            'Espessura do contorno atualizada.'
                          )
                        }}
                        aria-label="Espessura do contorno"
                      />
                    </span>
                  </label>
                </>
              ) : null}

              {selectedIsText ? (
                <>
                  <label className="ma-quadro__field">
                    <span className="ma-quadro__label-row">
                      Fonte
                    </span>
                    <select
                      className="ma-quadro__select"
                      value={properties.fontFamily}
                      onChange={(event) => {
                        const value = event.target.value

                        setProperties((current) => ({
                          ...current,
                          fontFamily: value
                        }))
                        applyObjectPatch(
                          {
                            fontFamily: value
                          },
                          'Fonte atualizada.'
                        )
                      }}
                    >
                      {availableFonts.map((font) => (
                        <option
                          key={font.family}
                          value={font.family}
                        >
                          {font.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="ma-quadro__field">
                    <span className="ma-quadro__label-row">
                      <span>Tamanho</span>
                      <span>{properties.fontSize}px</span>
                    </span>
                    <input
                      type="range"
                      className="ma-quadro__range"
                      min="8"
                      max="420"
                      value={properties.fontSize}
                      onChange={(event) => {
                        const value = Number(
                          event.target.value
                        )

                        setProperties((current) => ({
                          ...current,
                          fontSize: value
                        }))
                        applyObjectPatch(
                          {
                            fontSize: value
                          },
                          'Tamanho do texto atualizado.'
                        )
                      }}
                    />
                  </label>

                  <div className="ma-quadro__field">
                    <span className="ma-quadro__label-row">
                      Estilo
                    </span>
                    <div className="ma-quadro__property-buttons">
                      <EditorButton
                        onClick={() => {
                          const bold =
                            properties.fontWeight === '700'
                          const value = bold ? '400' : '700'

                          setProperties((current) => ({
                            ...current,
                            fontWeight: value
                          }))
                          applyObjectPatch(
                            {
                              fontWeight: Number(value)
                            },
                            'Peso do texto atualizado.'
                          )
                        }}
                        active={
                          properties.fontWeight === '700'
                        }
                      >
                        Negrito
                      </EditorButton>
                      <EditorButton
                        onClick={() => {
                          const italic =
                            properties.fontStyle === 'italic'
                          const value = italic
                            ? 'normal'
                            : 'italic'

                          setProperties((current) => ({
                            ...current,
                            fontStyle: value
                          }))
                          applyObjectPatch(
                            {
                              fontStyle: value
                            },
                            'Estilo do texto atualizado.'
                          )
                        }}
                        active={
                          properties.fontStyle === 'italic'
                        }
                      >
                        Itálico
                      </EditorButton>
                    </div>
                  </div>

                  <label className="ma-quadro__field">
                    <span className="ma-quadro__label-row">
                      Alinhamento do texto
                    </span>
                    <select
                      className="ma-quadro__select"
                      value={properties.textAlign}
                      onChange={(event) => {
                        const value = event.target.value

                        setProperties((current) => ({
                          ...current,
                          textAlign: value
                        }))
                        applyObjectPatch(
                          {
                            textAlign: value
                          },
                          'Alinhamento do texto atualizado.'
                        )
                      }}
                    >
                      <option value="left">Esquerda</option>
                      <option value="center">Centro</option>
                      <option value="right">Direita</option>
                      <option value="justify">Justificado</option>
                    </select>
                  </label>

                  <label className="ma-quadro__field">
                    <span className="ma-quadro__label-row">
                      <span>Espaçamento entre linhas</span>
                      <span>
                        {properties.lineHeight.toFixed(2)}
                      </span>
                    </span>
                    <input
                      type="range"
                      className="ma-quadro__range"
                      min="0.7"
                      max="2.5"
                      step="0.05"
                      value={properties.lineHeight}
                      onChange={(event) => {
                        const value = Number(
                          event.target.value
                        )

                        setProperties((current) => ({
                          ...current,
                          lineHeight: value
                        }))
                        applyObjectPatch(
                          {
                            lineHeight: value
                          },
                          'Espaçamento entre linhas atualizado.'
                        )
                      }}
                    />
                  </label>

                  <label className="ma-quadro__field">
                    <span className="ma-quadro__label-row">
                      <span>Espaçamento entre letras</span>
                      <span>{properties.charSpacing}</span>
                    </span>
                    <input
                      type="range"
                      className="ma-quadro__range"
                      min="-100"
                      max="500"
                      step="10"
                      value={properties.charSpacing}
                      onChange={(event) => {
                        const value = Number(
                          event.target.value
                        )

                        setProperties((current) => ({
                          ...current,
                          charSpacing: value
                        }))
                        applyObjectPatch(
                          {
                            charSpacing: value
                          },
                          'Espaçamento entre letras atualizado.'
                        )
                      }}
                    />
                  </label>
                </>
              ) : null}

              {selectedIsRectangle ? (
                <label className="ma-quadro__field">
                  <span className="ma-quadro__label-row">
                    <span>Cantos arredondados</span>
                    <span>{properties.cornerRadius}px</span>
                  </span>
                  <input
                    type="range"
                    className="ma-quadro__range"
                    min="0"
                    max="300"
                    value={properties.cornerRadius}
                    onChange={(event) => {
                      const value = Number(
                        event.target.value
                      )

                      setProperties((current) => ({
                        ...current,
                        cornerRadius: value
                      }))
                      applyObjectPatch(
                        {
                          rx: value,
                          ry: value
                        },
                        'Cantos atualizados.'
                      )
                    }}
                  />
                </label>
              ) : null}
            </section>

            <section className="ma-quadro__section">
              <div className="ma-quadro__section-heading">
                <h2 className="ma-quadro__section-title">
                  Camadas
                </h2>
                <span className="ma-quadro__section-note">
                  {layers.length}
                </span>
              </div>

              {layers.length === 0 ? (
                <div className="ma-quadro__empty">
                  Adicione texto, imagens ou formas para criar as primeiras camadas.
                </div>
              ) : null}

              {layers.map((layer) => (
                <article
                  key={layer.id}
                  className={`ma-quadro__layer${
                    selectedObject === layer.object
                      ? ' ma-quadro__layer--active'
                      : ''
                  }`}
                >
                  <button
                    type="button"
                    className="ma-quadro__layer-main"
                    onClick={() => {
                      const canvas = canvasRef.current

                      if (
                        !canvas ||
                        layer.object.maLocked ||
                        layer.object.visible === false
                      ) {
                        return
                      }

                      canvas.setActiveObject(layer.object)
                      canvas.requestRenderAll()
                      syncSelection()
                    }}
                  >
                    <span className="ma-quadro__layer-copy">
                      <strong>{layer.name}</strong>
                      <span>{layer.type}</span>
                    </span>
                    <span className="ma-quadro__muted">
                      {layer.object.visible === false
                        ? 'Oculta '
                        : ''}
                      {layer.object.maLocked ? '🔒' : ''}
                    </span>
                  </button>
                  <div className="ma-quadro__layer-actions">
                    <button
                      type="button"
                      className="ma-quadro__mini-icon"
                      onClick={() =>
                        moveLayer(layer.object, 'up')
                      }
                      title="Subir uma camada"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="ma-quadro__mini-icon"
                      onClick={() =>
                        moveLayer(layer.object, 'down')
                      }
                      title="Descer uma camada"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="ma-quadro__mini-icon"
                      onClick={() =>
                        setLayerVisibility(layer.object)
                      }
                      title="Mostrar ou ocultar"
                    >
                      {layer.object.visible === false
                        ? '◌'
                        : '◉'}
                    </button>
                    <button
                      type="button"
                      className="ma-quadro__mini-icon"
                      onClick={() =>
                        setLayerLocked(layer.object)
                      }
                      title="Bloquear ou desbloquear"
                    >
                      {layer.object.maLocked ? '🔒' : '🔓'}
                    </button>
                  </div>
                </article>
              ))}
            </section>
          </div>
        </aside>
      </div>

      {showCustomSize ? (
        <div
          className="ma-quadro__modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Tamanho personalizado"
        >
          <div className="ma-quadro__modal">
            <h2>Tamanho personalizado</h2>
            <p>
              Introduza a largura e a altura em píxeis. O limite é 8000 × 8000.
            </p>
            <div className="ma-quadro__modal-grid">
              <label className="ma-quadro__field">
                <span className="ma-quadro__label-row">
                  Largura
                </span>
                <input
                  type="number"
                  className="ma-quadro__number"
                  min="100"
                  max="8000"
                  value={customWidth}
                  onChange={(event) =>
                    setCustomWidth(event.target.value)
                  }
                />
              </label>
              <label className="ma-quadro__field">
                <span className="ma-quadro__label-row">
                  Altura
                </span>
                <input
                  type="number"
                  className="ma-quadro__number"
                  min="100"
                  max="8000"
                  value={customHeight}
                  onChange={(event) =>
                    setCustomHeight(event.target.value)
                  }
                />
              </label>
            </div>
            <div className="ma-quadro__modal-actions">
              <button
                type="button"
                className="ma-quadro__button"
                onClick={() => setShowCustomSize(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="ma-quadro__button ma-quadro__button--primary"
                onClick={applyCustomSize}
              >
                Criar quadro
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}
