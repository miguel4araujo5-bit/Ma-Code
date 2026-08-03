import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent
} from 'react'
import {
  ActiveSelection,
  Canvas as FabricCanvas,
  FabricImage,
  Gradient,
  Group,
  Shadow,
  Textbox
} from 'fabric'

import {
  deleteMAQuadroFont,
  deleteMAQuadroProject,
  listMAQuadroFonts,
  listMAQuadroProjects,
  saveMAQuadroFont,
  saveMAQuadroProject
} from '../../lib/maQuadro/db'
import {
  exportMAQuadroPageImage,
  exportMAQuadroPageSvg,
  exportMAQuadroPagesZip,
  exportMAQuadroPdf,
  exportMAQuadroProjectFile
} from '../../lib/maQuadro/export'
import {
  applyMAQuadroImageFilters,
  cropMAQuadroImageSymmetrically,
  DEFAULT_IMAGE_FILTERS,
  getMAQuadroImageFilters,
  removeSimpleImageBackground,
  resetMAQuadroImageCrop,
  resetMAQuadroImageFilters
} from '../../lib/maQuadro/imageFilters'
import {
  createBlankPage,
  createBlankProject,
  createMAQuadroId,
  duplicatePage,
  duplicateProject,
  getActiveProjectPage,
  isMAQuadroProject,
  migrateLegacyMAQuadroDesign,
  replaceProjectPage
} from '../../lib/maQuadro/project'
import {
  MA_QUADRO_PRESETS,
  seedMAQuadroTemplates
} from '../../lib/maQuadro/templates'
import {
  alignMAQuadroSelection,
  applyMAQuadroLock,
  applyMAQuadroPageBackground,
  arrangeMAQuadroObject,
  configureMAQuadroBrush,
  createMAQuadroImage,
  createMAQuadroShape,
  createMAQuadroText,
  distributeMAQuadroSelection,
  getMAQuadroObjectGeometry,
  getMAQuadroObjectLabel,
  getMAQuadroObjectRole,
  groupMAQuadroSelection,
  loadMAQuadroCanvasJson,
  MA_QUADRO_SERIALIZED_PROPERTIES,
  prepareMAQuadroObject,
  selectAllMAQuadroObjects,
  serializeMAQuadroCanvas,
  setMAQuadroObjectGeometry,
  setMAQuadroObjectGradient,
  setMAQuadroObjectShadow,
  ungroupMAQuadroSelection,
  type MAQuadroAlignAction,
  type MAQuadroArrangeAction,
  type MAQuadroFabricObject
} from '../../lib/maQuadro/canvasObjects'
import type {
  MAQuadroBackground,
  MAQuadroBrand,
  MAQuadroCanvasPreset,
  MAQuadroImageFilterState,
  MAQuadroPage,
  MAQuadroPanelId,
  MAQuadroProject,
  MAQuadroShapeKind,
  MAQuadroStoredFont,
  MAQuadroTextPreset
} from '../../types/maQuadro'
import type {
  MAQuadroEditor,
  MAQuadroExportOptions,
  MAQuadroLayerItem,
  MAQuadroNewDesignValues,
  MAQuadroSelectionState
} from './editorTypes'

const fallbackBrand:
  MAQuadroBrand = {
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
      },
      {
        name: 'Branco',
        value: '#FFFFFF'
      },
      {
        name: 'Cinza claro',
        value: '#E2E8F0'
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

const emptySelection:
  MAQuadroSelectionState = {
    count: 0,
    role: null,
    name: '',
    fill: '#0F172A',
    stroke: '#0F172A',
    strokeWidth: 0,
    opacity: 100,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    angle: 0,
    flipX: false,
    flipY: false,
    fontFamily: 'Arial',
    fontSize: 64,
    fontWeight: '400',
    fontStyle: 'normal',
    textAlign: 'left',
    lineHeight: 1.16,
    charSpacing: 0,
    underline: false,
    linethrough: false,
    cornerRadius: 0,
    shadowEnabled: false,
    shadowColor:
      'rgba(15, 23, 42, 0.32)',
    shadowBlur: 24,
    shadowOffsetX: 0,
    shadowOffsetY: 12,
    gradientEnabled: false,
    gradientFrom: '#22D3EE',
    gradientTo: '#8B5CF6',
    gradientAngle: 45,
    imageFilters:
      DEFAULT_IMAGE_FILTERS,
    cropHorizontal: 0,
    cropVertical: 0
  }

const defaultExportOptions:
  MAQuadroExportOptions = {
    format: 'png',
    scale: 2,
    quality: 92,
    scope: 'current'
  }

type HistoryState = {
  entries: string[]
  index: number
}

function colorToString(
  value: unknown,
  fallback: string
) {
  return typeof value === 'string'
    ? value
    : fallback
}

function registerLocalFont(
  font: MAQuadroStoredFont
) {
  const face =
    new FontFace(
      font.family,
      font.data
    )

  return face
    .load()
    .then((loaded) => {
      document.fonts.add(
        loaded
      )
    })
}

function targetIsFormControl(
  target: EventTarget | null
) {
  const element =
    target as HTMLElement | null

  return Boolean(
    element &&
      (
        element.tagName ===
          'INPUT' ||
        element.tagName ===
          'TEXTAREA' ||
        element.tagName ===
          'SELECT' ||
        element.isContentEditable
      )
  )
}

function getGradientColours(
  fill: unknown
) {
  if (
    !(
      fill instanceof
      Gradient
    )
  ) {
    return null
  }

  const stops =
    fill.colorStops || []

  return {
    from:
      stops[0]?.color ||
      '#22D3EE',
    to:
      stops[
        stops.length - 1
      ]?.color ||
      '#8B5CF6'
  }
}

function titleCase(
  value: string
) {
  return value
    .toLocaleLowerCase(
      'pt-PT'
    )
    .replace(
      /(^|\s|[-–—])\p{L}/gu,
      (letter) =>
        letter.toLocaleUpperCase(
          'pt-PT'
        )
    )
}

export function
useMAQuadroEditor():
  MAQuadroEditor {
  const canvasElementRef =
    useRef<
      HTMLCanvasElement | null
    >(null)

  const workspaceRef =
    useRef<
      HTMLDivElement | null
    >(null)

  const imageInputRef =
    useRef<
      HTMLInputElement | null
    >(null)

  const fontInputRef =
    useRef<
      HTMLInputElement | null
    >(null)

  const projectInputRef =
    useRef<
      HTMLInputElement | null
    >(null)

  const canvasRef =
    useRef<
      FabricCanvas | null
    >(null)

  const projectRef =
    useRef<
      MAQuadroProject | null
    >(null)

  const selectedObjectRef =
    useRef<
      MAQuadroFabricObject | null
    >(null)

  const clipboardRef =
    useRef<
      MAQuadroFabricObject | null
    >(null)

  const historiesRef =
    useRef<
      Map<
        string,
        HistoryState
      >
    >(
      new Map()
    )

  const isLoadingRef =
    useRef(false)

  const isApplyingHistoryRef =
    useRef(false)

  const initializedRef =
    useRef(false)

  const autosaveTimerRef =
    useRef<number | null>(
      null
    )

  const saveHandlerRef =
    useRef<
      (
        quiet?: boolean
      ) => Promise<void>
    >(
      async () =>
        undefined
    )

  const zoomRef =
    useRef(50)

  const brushColorRef =
    useRef('#0F172A')

  const brushWidthRef =
    useRef(8)

  const spacePressedRef =
    useRef(false)

  const panStateRef =
    useRef<{
      active: boolean
      startX: number
      startY: number
      scrollLeft: number
      scrollTop: number
    }>({
      active: false,
      startX: 0,
      startY: 0,
      scrollLeft: 0,
      scrollTop: 0
    })

  const [
    ready,
    setReady
  ] = useState(false)

  const [
    busy,
    setBusy
  ] = useState(false)

  const [
    statusMessage,
    setStatusMessage
  ] = useState(
    'Os projetos ficam guardados apenas neste dispositivo.'
  )

  const [
    saveState,
    setSaveState
  ] = useState<
    MAQuadroEditor['saveState']
  >('ready')

  const [
    project,
    setProject
  ] = useState<
    MAQuadroProject | null
  >(null)

  const [
    projects,
    setProjects
  ] = useState<
    MAQuadroProject[]
  >([])

  const [
    activePage,
    setActivePageState
  ] = useState<
    MAQuadroPage | null
  >(null)

  const [
    brand,
    setBrand
  ] = useState<
    MAQuadroBrand
  >(fallbackBrand)

  const [
    localFonts,
    setLocalFonts
  ] = useState<
    MAQuadroStoredFont[]
  >([])

  const [
    layers,
    setLayers
  ] = useState<
    MAQuadroLayerItem[]
  >([])

  const [
    selection,
    setSelection
  ] = useState<
    MAQuadroSelectionState
  >(emptySelection)

  const [
    activePanel,
    setActivePanel
  ] = useState<
    MAQuadroPanelId
  >('templates')

  const [
    zoom,
    setZoomState
  ] = useState(50)

  const [
    canUndo,
    setCanUndo
  ] = useState(false)

  const [
    canRedo,
    setCanRedo
  ] = useState(false)

  const [
    drawingMode,
    setDrawingModeState
  ] = useState(false)

  const [
    brushColor,
    setBrushColorState
  ] = useState(
    '#0F172A'
  )

  const [
    brushWidth,
    setBrushWidthState
  ] = useState(8)

  const [
    showGrid,
    setShowGrid
  ] = useState(false)

  const [
    showSafeArea,
    setShowSafeArea
  ] = useState(false)

  const [
    guides,
    setGuides
  ] = useState({
    vertical: false,
    horizontal: false
  })

  const [
    isSpacePressed,
    setIsSpacePressed
  ] = useState(false)

  const [
    exportOpen,
    setExportOpen
  ] = useState(false)

  const [
    newDesignOpen,
    setNewDesignOpen
  ] = useState(false)

  const [
    exportOptions,
    setExportOptionsState
  ] = useState<
    MAQuadroExportOptions
  >(defaultExportOptions)

  const availableFonts =
    useMemo(() => {
      const map =
        new Map<
          string,
          {
            name: string
            family: string
            fallback?: string
          }
        >()

      for (
        const font
        of brand.fonts
      ) {
        map.set(
          font.family,
          font
        )
      }

      for (
        const font
        of localFonts
      ) {
        map.set(
          font.family,
          {
            name:
              font.family,
            family:
              font.family
          }
        )
      }

      return Array.from(
        map.values()
      )
    }, [
      brand.fonts,
      localFonts
    ])

  const refreshProjectLibrary =
    useCallback(
      async () => {
        setProjects(
          await listMAQuadroProjects()
        )
      },
      []
    )

  const findCanvasObject =
    useCallback(
      (
        objectId: string
      ) => {
        return canvasRef.current
          ?.getObjects()
          .find(
            (object) =>
              (
                object as
                  MAQuadroFabricObject
              ).maId ===
              objectId
          ) as
            | MAQuadroFabricObject
            | undefined
      },
      []
    )

  const syncLayers =
    useCallback(() => {
      const canvas =
        canvasRef.current

      if (!canvas) {
        setLayers([])
        return
      }

      const activeObjects =
        new Set(
          canvas
            .getActiveObjects()
        )

      const next =
        canvas
          .getObjects()
          .map(
            (
              object,
              index
            ) => {
              const editorObject =
                object as
                  MAQuadroFabricObject

              editorObject.maId ||=
                createMAQuadroId(
                  'object'
                )

              return {
                id:
                  editorObject.maId,
                name:
                  getMAQuadroObjectLabel(
                    editorObject,
                    index
                  ),
                type:
                  getMAQuadroObjectRole(
                    editorObject
                  ),
                visible:
                  editorObject
                    .visible !==
                  false,
                locked:
                  Boolean(
                    editorObject
                      .maLocked
                  ),
                active:
                  activeObjects.has(
                    editorObject
                  )
              }
            }
          )
          .reverse()

      setLayers(next)
    }, [])

  const syncSelection =
    useCallback(() => {
      const canvas =
        canvasRef.current

      const active =
        canvas
          ?.getActiveObject() as
          | MAQuadroFabricObject
          | undefined

      const activeObjects =
        canvas
          ?.getActiveObjects() ||
        []

      selectedObjectRef.current =
        active || null

      if (
        !active ||
        activeObjects.length ===
          0
      ) {
        setSelection(
          emptySelection
        )
        syncLayers()
        return
      }

      const geometry =
        getMAQuadroObjectGeometry(
          active
        )

      const gradient =
        getGradientColours(
          active.fill
        )

      const shadow =
        active.shadow
          instanceof Shadow
          ? active.shadow
          : null

      const single =
        activeObjects.length ===
        1

      const image =
        single &&
        active instanceof
          FabricImage
          ? active as
              FabricImage &
              MAQuadroFabricObject
          : null

      const text =
        single &&
        active instanceof
          Textbox
          ? active as
              Textbox &
              MAQuadroFabricObject
          : null

      const sourceWidth =
        image
          ?.maOriginalWidth ||
        image?.width ||
        1

      const sourceHeight =
        image
          ?.maOriginalHeight ||
        image?.height ||
        1

      const cropHorizontal =
        image
          ? Math.round(
              (
                image.cropX ||
                0
              ) /
              sourceWidth *
              100
            )
          : 0

      const cropVertical =
        image
          ? Math.round(
              (
                image.cropY ||
                0
              ) /
              sourceHeight *
              100
            )
          : 0

      setSelection({
        count:
          activeObjects.length,

        role:
          activeObjects.length >
          1
            ? 'group'
            : getMAQuadroObjectRole(
                active
              ),

        name:
          active.maName ||
          getMAQuadroObjectLabel(
            active
          ),

        fill:
          colorToString(
            active.fill,
            '#0F172A'
          ),

        stroke:
          colorToString(
            active.stroke,
            '#0F172A'
          ),

        strokeWidth:
          Number(
            active.strokeWidth ||
            0
          ),

        opacity:
          Math.round(
            (
              active.opacity ??
              1
            ) *
            100
          ),

        x: geometry.x,
        y: geometry.y,
        width: geometry.width,
        height: geometry.height,
        angle: geometry.angle,

        flipX:
          Boolean(
            active.flipX
          ),

        flipY:
          Boolean(
            active.flipY
          ),

        fontFamily:
          text?.fontFamily ||
          'Arial',

        fontSize:
          Math.round(
            text?.fontSize ||
            64
          ),

        fontWeight:
          String(
            text?.fontWeight ||
            '400'
          ),

        fontStyle:
          text?.fontStyle ||
          'normal',

        textAlign:
          text?.textAlign ||
          'left',

        lineHeight:
          Number(
            text?.lineHeight ||
            1.16
          ),

        charSpacing:
          Number(
            text?.charSpacing ||
            0
          ),

        underline:
          Boolean(
            text?.underline
          ),

        linethrough:
          Boolean(
            text?.linethrough
          ),

        cornerRadius:
          Number(
            active.rx || 0
          ),

        shadowEnabled:
          Boolean(shadow),

        shadowColor:
          shadow?.color ||
          'rgba(15, 23, 42, 0.32)',

        shadowBlur:
          Number(
            shadow?.blur ||
            24
          ),

        shadowOffsetX:
          Number(
            shadow?.offsetX ||
            0
          ),

        shadowOffsetY:
          Number(
            shadow?.offsetY ||
            12
          ),

        gradientEnabled:
          Boolean(gradient),

        gradientFrom:
          gradient?.from ||
          '#22D3EE',

        gradientTo:
          gradient?.to ||
          '#8B5CF6',

        gradientAngle: 45,

        imageFilters:
          image
            ? getMAQuadroImageFilters(
                image
              )
            : DEFAULT_IMAGE_FILTERS,

        cropHorizontal,
        cropVertical
      })

      syncLayers()
    }, [
      syncLayers
    ])

  const historySnapshot =
    useCallback(() => {
      const canvas =
        canvasRef.current

      const currentProject =
        projectRef.current

      if (
        !canvas ||
        !currentProject
      ) {
        return null
      }

      const page =
        getActiveProjectPage(
          currentProject
        )

      return JSON.stringify({
        pageId: page.id,
        background:
          page.background,
        canvasJson:
          serializeMAQuadroCanvas(
            canvas
          )
      })
    }, [])

  const updateHistoryButtons =
    useCallback(() => {
      const pageId =
        projectRef.current
          ?.activePageId

      const history =
        pageId
          ? historiesRef.current
              .get(pageId)
          : undefined

      setCanUndo(
        Boolean(
          history &&
          history.index > 0
        )
      )

      setCanRedo(
        Boolean(
          history &&
          history.index <
            history.entries
              .length -
              1
        )
      )
    }, [])

  const resetHistory =
    useCallback(() => {
      const pageId =
        projectRef.current
          ?.activePageId

      const snapshot =
        historySnapshot()

      if (
        !pageId ||
        !snapshot
      ) {
        return
      }

      historiesRef.current.set(
        pageId,
        {
          entries: [
            snapshot
          ],
          index: 0
        }
      )

      updateHistoryButtons()
    }, [
      historySnapshot,
      updateHistoryButtons
    ])

  const pushHistory =
    useCallback(() => {
      if (
        isLoadingRef.current ||
        isApplyingHistoryRef
          .current
      ) {
        return
      }

      const pageId =
        projectRef.current
          ?.activePageId

      const snapshot =
        historySnapshot()

      if (
        !pageId ||
        !snapshot
      ) {
        return
      }

      const current =
        historiesRef.current
          .get(pageId) || {
            entries: [],
            index: -1
          }

      const activeSnapshot =
        current.entries[
          current.index
        ]

      if (
        activeSnapshot ===
        snapshot
      ) {
        updateHistoryButtons()
        return
      }

      const entries =
        current.entries
          .slice(
            0,
            current.index + 1
          )
          .concat(snapshot)
          .slice(-80)

      historiesRef.current.set(
        pageId,
        {
          entries,
          index:
            entries.length -
            1
        }
      )

      updateHistoryButtons()
    }, [
      historySnapshot,
      updateHistoryButtons
    ])

  const markDirty =
    useCallback(
      (
        message: string
      ) => {
        if (
          isLoadingRef.current ||
          isApplyingHistoryRef
            .current
        ) {
          return
        }

        setSaveState(
          'dirty'
        )

        setStatusMessage(
          message
        )

        if (
          autosaveTimerRef
            .current !==
          null
        ) {
          window.clearTimeout(
            autosaveTimerRef
              .current
          )
        }

        autosaveTimerRef.current =
          window.setTimeout(
            () => {
              void saveHandlerRef
                .current(true)
            },
            1100
          )
      },
      []
    )

  const commitChange =
    useCallback(
      (
        message: string
      ) => {
        syncLayers()
        syncSelection()
        pushHistory()
        markDirty(message)
      },
      [
        markDirty,
        pushHistory,
        syncLayers,
        syncSelection
      ]
    )

  const setZoom =
    useCallback(
      (
        value: number
      ) => {
        const canvas =
          canvasRef.current

        if (!canvas) {
          return
        }

        const safe =
          Math.min(
            220,
            Math.max(
              5,
              Math.round(value)
            )
          )

        zoomRef.current =
          safe

        setZoomState(
          safe
        )

        canvas.setDimensions(
          {
            width:
              `${
                Math.round(
                  canvas
                    .getWidth() *
                  safe /
                  100
                )
              }px`,

            height:
              `${
                Math.round(
                  canvas
                    .getHeight() *
                  safe /
                  100
                )
              }px`
          },
          {
            cssOnly: true
          }
        )

        canvas.calcOffset()
      },
      []
    )

  const fitCanvas =
    useCallback(() => {
      const canvas =
        canvasRef.current

      const workspace =
        workspaceRef.current

      if (
        !canvas ||
        !workspace
      ) {
        return
      }

      const availableWidth =
        Math.max(
          280,
          workspace.clientWidth -
          72
        )

      const availableHeight =
        Math.max(
          320,
          Math.min(
            window.innerHeight -
              250,
            900
          )
        )

      const scale =
        Math.min(
          availableWidth /
            canvas.getWidth(),
          availableHeight /
            canvas.getHeight(),
          1
        )

      setZoom(
        Math.max(
          5,
          Math.round(
            scale * 100
          )
        )
      )
    }, [
      setZoom
    ])

  const captureCurrentPage =
    useCallback(
      (
        sourceProject =
          projectRef.current
      ) => {
        const canvas =
          canvasRef.current

        if (
          !canvas ||
          !sourceProject
        ) {
          return sourceProject
        }

        const currentPage =
          getActiveProjectPage(
            sourceProject
          )

        const thumbnailScale =
          Math.max(
            0.02,
            Math.min(
              0.18,
              260 /
                currentPage.width,
              180 /
                currentPage.height
            )
          )

        const updatedPage:
          MAQuadroPage = {
            ...currentPage,

            width:
              canvas.getWidth(),

            height:
              canvas.getHeight(),

            canvasJson:
              serializeMAQuadroCanvas(
                canvas
              ),

            thumbnail:
              canvas.toDataURL({
                format: 'png',
                multiplier:
                  thumbnailScale,
                enableRetinaScaling:
                  false
              })
          }

        const next =
          replaceProjectPage(
            sourceProject,
            updatedPage
          )

        projectRef.current =
          next

        setProject(next)
        setActivePageState(
          updatedPage
        )

        return next
      },
      []
    )

  const loadPage =
    useCallback(
      async (
        nextProject:
          MAQuadroProject,
        pageId: string,
        resetPageHistory =
          false
      ) => {
        const canvas =
          canvasRef.current

        const page =
          nextProject.pages.find(
            (item) =>
              item.id ===
              pageId
          )

        if (
          !canvas ||
          !page
        ) {
          return
        }

        isLoadingRef.current =
          true

        setBusy(true)

        try {
          canvas
            .discardActiveObject()

          canvas.clear()

          canvas.setDimensions({
            width:
              page.width,
            height:
              page.height
          })

          await loadMAQuadroCanvasJson(
            canvas,
            page.canvasJson
          )

          applyMAQuadroPageBackground(
            canvas,
            page
          )

          canvas.requestRenderAll()

          const withActivePage = {
            ...nextProject,
            activePageId:
              page.id
          }

          projectRef.current =
            withActivePage

          setProject(
            withActivePage
          )

          setActivePageState(
            page
          )

          setDrawingModeState(
            false
          )

          canvas.isDrawingMode =
            false

          selectedObjectRef.current =
            null

          setSelection(
            emptySelection
          )

          syncLayers()

          window.requestAnimationFrame(
            fitCanvas
          )

          if (
            resetPageHistory ||
            !historiesRef.current
              .has(page.id)
          ) {
            window.setTimeout(
              resetHistory,
              0
            )
          } else {
            updateHistoryButtons()
          }
        } finally {
          isLoadingRef.current =
            false

          setBusy(false)
        }
      },
      [
        fitCanvas,
        resetHistory,
        syncLayers,
        updateHistoryButtons
      ]
    )

  const saveProject =
    useCallback(
      async (
        quiet = false
      ) => {
        let current =
          captureCurrentPage()

        if (!current) {
          return
        }

        setBusy(true)
        setSaveState(
          'saving'
        )

        try {
          if (
            current.isTemplate
          ) {
            current =
              duplicateProject(
                current,
                `${current.name} — cópia`
              )

            const activeIndex =
              Math.max(
                0,
                projectRef.current
                  ?.pages
                  .findIndex(
                    (page) =>
                      page.id ===
                      projectRef
                        .current
                        ?.activePageId
                  ) ||
                  0
              )

            current.activePageId =
              current.pages[
                activeIndex
              ]?.id ||
              current.pages[0].id
          }

          const saved:
            MAQuadroProject = {
              ...current,
              isTemplate: false,
              updatedAt:
                new Date()
                  .toISOString()
            }

          await saveMAQuadroProject(
            saved
          )

          projectRef.current =
            saved

          setProject(saved)

          setActivePageState(
            getActiveProjectPage(
              saved
            )
          )

          await refreshProjectLibrary()

          setSaveState(
            'saved'
          )

          if (!quiet) {
            setStatusMessage(
              `“${saved.name}” guardado neste dispositivo.`
            )
          }
        } catch (error) {
          console.error(
            error
          )

          setSaveState(
            'error'
          )

          setStatusMessage(
            'Não foi possível guardar o projeto localmente.'
          )
        } finally {
          setBusy(false)
        }
      },
      [
        captureCurrentPage,
        refreshProjectLibrary
      ]
    )

  useEffect(() => {
    saveHandlerRef.current =
      saveProject
  }, [
    saveProject
  ])

  useEffect(() => {
    const element =
      canvasElementRef.current

    if (!element) {
      return
    }

    const canvas =
      new FabricCanvas(
        element,
        {
          width: 1080,
          height: 1080,
          backgroundColor:
            '#FFFFFF',
          preserveObjectStacking:
            true,
          selection: true,
          stopContextMenu:
            true,
          fireRightClick:
            true
        }
      )

    canvasRef.current =
      canvas

    configureMAQuadroBrush(
      canvas,
      brushColorRef.current,
      brushWidthRef.current
    )

    const selectionChanged =
      () => {
        syncSelection()
      }

    const objectChanged =
      () => {
        if (
          isLoadingRef.current ||
          isApplyingHistoryRef
            .current
        ) {
          return
        }

        commitChange(
          'Alterações por guardar.'
        )
      }

    canvas.on(
      'selection:created',
      selectionChanged
    )

    canvas.on(
      'selection:updated',
      selectionChanged
    )

    canvas.on(
      'selection:cleared',
      selectionChanged
    )

    canvas.on(
      'object:added',
      objectChanged
    )

    canvas.on(
      'object:removed',
      objectChanged
    )

    canvas.on(
      'object:modified',
      objectChanged
    )

    canvas.on(
      'text:changed',
      objectChanged
    )

    canvas.on(
      'path:created',
      (event) => {
        const path =
          (
            event as unknown as {
              path?:
                MAQuadroFabricObject
            }
          ).path

        if (path) {
          prepareMAQuadroObject(
            path,
            'drawing',
            'Desenho livre'
          )
        }

        objectChanged()
      }
    )

    canvas.on(
      'object:moving',
      (event) => {
        const target =
          event.target as
            | MAQuadroFabricObject
            | undefined

        if (
          !target ||
          target.maLocked
        ) {
          return
        }

        const bounds =
          target
            .getBoundingRect()

        const centerX =
          bounds.left +
          bounds.width /
            2

        const centerY =
          bounds.top +
          bounds.height /
            2

        const threshold =
          Math.max(
            6,
            12 /
            Math.max(
              zoomRef.current /
                100,
              0.05
            )
          )

        let vertical =
          false

        let horizontal =
          false

        if (
          Math.abs(
            centerX -
            canvas.getWidth() /
              2
          ) <= threshold
        ) {
          target.left +=
            canvas.getWidth() /
              2 -
            centerX

          vertical = true
        } else if (
          Math.abs(
            bounds.left
          ) <= threshold
        ) {
          target.left +=
            -bounds.left

          vertical = true
        } else if (
          Math.abs(
            bounds.left +
            bounds.width -
            canvas.getWidth()
          ) <= threshold
        ) {
          target.left +=
            canvas.getWidth() -
            (
              bounds.left +
              bounds.width
            )

          vertical = true
        }

        if (
          Math.abs(
            centerY -
            canvas.getHeight() /
              2
          ) <= threshold
        ) {
          target.top +=
            canvas.getHeight() /
              2 -
            centerY

          horizontal = true
        } else if (
          Math.abs(
            bounds.top
          ) <= threshold
        ) {
          target.top +=
            -bounds.top

          horizontal = true
        } else if (
          Math.abs(
            bounds.top +
            bounds.height -
            canvas.getHeight()
          ) <= threshold
        ) {
          target.top +=
            canvas.getHeight() -
            (
              bounds.top +
              bounds.height
            )

          horizontal = true
        }

        target.setCoords()

        setGuides({
          vertical,
          horizontal
        })
      }
    )

    canvas.on(
      'mouse:up',
      () => {
        setGuides({
          vertical: false,
          horizontal: false
        })
      }
    )

    setReady(true)

    return () => {
      if (
        autosaveTimerRef
          .current !==
        null
      ) {
        window.clearTimeout(
          autosaveTimerRef
            .current
        )
      }

      canvasRef.current =
        null

      void canvas.dispose()
    }
  }, [
    commitChange,
    syncSelection
  ])

  useEffect(() => {
    if (
      !ready ||
      initializedRef.current
    ) {
      return
    }

    initializedRef.current =
      true

    async function initialize() {
      setBusy(true)

      try {
        try {
          const response =
            await fetch(
              '/ma-quadro/brand.json',
              {
                cache:
                  'no-store'
              }
            )

          if (
            response.ok
          ) {
            setBrand(
              (await response.json()) as MAQuadroBrand
            )
          }
        } catch (error) {
          console.error(
            error
          )
        }

        await seedMAQuadroTemplates()

        const fonts =
          await listMAQuadroFonts()

        for (
          const font
          of fonts
        ) {
          try {
            await registerLocalFont(
              font
            )
          } catch (error) {
            console.error(
              error
            )
          }
        }

        setLocalFonts(
          fonts
        )

        let storedProjects =
          await listMAQuadroProjects()

        let initialProject =
          storedProjects.find(
            (record) =>
              !record.isTemplate
          )

        if (!initialProject) {
          initialProject =
            createBlankProject(
              1080,
              1080,
              'O meu primeiro design',
              'social'
            )

          await saveMAQuadroProject(
            initialProject
          )

          storedProjects =
            await listMAQuadroProjects()
        }

        setProjects(
          storedProjects
        )

        await loadPage(
          initialProject,
          initialProject
            .activePageId,
          true
        )

        setStatusMessage(
          'Projeto aberto. A gravação automática está ativa.'
        )

        setSaveState(
          'saved'
        )
      } catch (error) {
        console.error(
          error
        )

        const fallback =
          createBlankProject(
            1080,
            1080,
            'Design sem título',
            'social'
          )

        projectRef.current =
          fallback

        setProject(
          fallback
        )

        setActivePageState(
          fallback.pages[0]
        )

        await loadPage(
          fallback,
          fallback.activePageId,
          true
        )

        setStatusMessage(
          'O armazenamento local está indisponível. Pode editar e exportar, mas o browser poderá não guardar o trabalho.'
        )
      } finally {
        setBusy(false)
      }
    }

    void initialize()
  }, [
    loadPage,
    ready
  ])

  useEffect(() => {
    const handleResize =
      () => fitCanvas()

    window.addEventListener(
      'resize',
      handleResize
    )

    return () => {
      window.removeEventListener(
        'resize',
        handleResize
      )
    }
  }, [
    fitCanvas
  ])

  const setProjectName =
    useCallback(
      (
        name: string
      ) => {
        const current =
          projectRef.current

        if (!current) {
          return
        }

        const next = {
          ...current,
          name
        }

        projectRef.current =
          next

        setProject(next)

        markDirty(
          'Nome do projeto atualizado.'
        )
      },
      [
        markDirty
      ]
    )

  const openProject =
    useCallback(
      async (
        projectId: string
      ) => {
        const target =
          projects.find(
            (item) =>
              item.id ===
              projectId
          )

        if (!target) {
          return
        }

        if (
          projectRef.current &&
          !projectRef.current
            .isTemplate
        ) {
          await saveProject(
            true
          )
        }

        await loadPage(
          target,
          target.activePageId,
          true
        )

        setActivePanel(
          'elements'
        )

        setStatusMessage(
          `“${target.name}” aberto.`
        )

        setSaveState(
          target.isTemplate
            ? 'ready'
            : 'saved'
        )
      },
      [
        loadPage,
        projects,
        saveProject
      ]
    )

  const duplicateProjectAction =
    useCallback(
      async (
        projectId: string
      ) => {
        const source =
          projects.find(
            (item) =>
              item.id ===
              projectId
          )

        if (!source) {
          return
        }

        setBusy(true)

        try {
          const copy =
            duplicateProject(
              source
            )

          await saveMAQuadroProject(
            copy
          )

          await refreshProjectLibrary()

          await loadPage(
            copy,
            copy.activePageId,
            true
          )

          setActivePanel(
            'elements'
          )

          setStatusMessage(
            'Cópia criada. O projeto original foi preservado.'
          )

          setSaveState(
            'saved'
          )
        } catch (error) {
          console.error(
            error
          )

          setStatusMessage(
            'Não foi possível duplicar o projeto.'
          )
        } finally {
          setBusy(false)
        }
      },
      [
        loadPage,
        projects,
        refreshProjectLibrary
      ]
    )

  const deleteProjectAction =
    useCallback(
      async (
        projectId: string
      ) => {
        const source =
          projects.find(
            (item) =>
              item.id ===
              projectId
          )

        if (!source) {
          return
        }

        if (
          source.isTemplate
        ) {
          setStatusMessage(
            'Os modelos de origem permanecem sempre disponíveis.'
          )
          return
        }

        if (
          !window.confirm(
            `Eliminar “${source.name}” deste dispositivo?`
          )
        ) {
          return
        }

        setBusy(true)

        try {
          await deleteMAQuadroProject(
            projectId
          )

          let remaining =
            await listMAQuadroProjects()

          if (
            projectRef.current
              ?.id ===
            projectId
          ) {
            let next =
              remaining.find(
                (item) =>
                  !item.isTemplate
              )

            if (!next) {
              next =
                createBlankProject(
                  1080,
                  1080,
                  'Novo design',
                  'social'
                )

              await saveMAQuadroProject(
                next
              )

              remaining =
                await listMAQuadroProjects()
            }

            await loadPage(
              next,
              next.activePageId,
              true
            )
          }

          setProjects(
            remaining
          )

          setStatusMessage(
            'Projeto eliminado deste dispositivo.'
          )
        } catch (error) {
          console.error(
            error
          )

          setStatusMessage(
            'Não foi possível eliminar o projeto.'
          )
        } finally {
          setBusy(false)
        }
      },
      [
        loadPage,
        projects
      ]
    )

  const saveProjectAsTemplate =
    useCallback(
      async () => {
        const current =
          captureCurrentPage()

        if (!current) {
          return
        }

        setBusy(true)

        try {
          const template =
            duplicateProject(
              current,
              `${current.name} — modelo`
            )

          template.isTemplate =
            true

          await saveMAQuadroProject(
            template
          )

          await refreshProjectLibrary()

          setStatusMessage(
            'Modelo pessoal guardado. Pode duplicá-lo sempre que precisar.'
          )
        } catch (error) {
          console.error(
            error
          )

          setStatusMessage(
            'Não foi possível guardar o modelo.'
          )
        } finally {
          setBusy(false)
        }
      },
      [
        captureCurrentPage,
        refreshProjectLibrary
      ]
    )

  const createFromPreset =
    useCallback(
      async (
        preset:
          MAQuadroCanvasPreset
      ) => {
        if (
          projectRef.current &&
          !projectRef.current
            .isTemplate
        ) {
          await saveProject(
            true
          )
        }

        const created =
          createBlankProject(
            preset.width,
            preset.height,
            preset.name,
            preset.category
          )

        await saveMAQuadroProject(
          created
        )

        await refreshProjectLibrary()

        await loadPage(
          created,
          created.activePageId,
          true
        )

        setActivePanel(
          'elements'
        )

        setStatusMessage(
          'Novo design criado.'
        )

        setSaveState(
          'saved'
        )
      },
      [
        loadPage,
        refreshProjectLibrary,
        saveProject
      ]
    )

  const createCustomDesign =
    useCallback(
      async (
        values:
          MAQuadroNewDesignValues
      ) => {
        const width =
          Math.round(
            values.width
          )

        const height =
          Math.round(
            values.height
          )

        if (
          !Number.isFinite(
            width
          ) ||
          !Number.isFinite(
            height
          ) ||
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

        if (
          projectRef.current &&
          !projectRef.current
            .isTemplate
        ) {
          await saveProject(
            true
          )
        }

        const created =
          createBlankProject(
            width,
            height,
            values.name.trim() ||
              `Design ${width} × ${height}`,
            values.category
          )

        await saveMAQuadroProject(
          created
        )

        await refreshProjectLibrary()

        await loadPage(
          created,
          created.activePageId,
          true
        )

        setNewDesignOpen(
          false
        )

        setActivePanel(
          'elements'
        )

        setStatusMessage(
          'Design personalizado criado.'
        )

        setSaveState(
          'saved'
        )
      },
      [
        loadPage,
        refreshProjectLibrary,
        saveProject
      ]
    )

  const importProject =
    useCallback(
      async (
        event:
          ChangeEvent<HTMLInputElement>
      ) => {
        const file =
          event.target.files
            ?.[0]

        event.target.value =
          ''

        if (!file) {
          return
        }

        setBusy(true)

        try {
          const parsed =
            JSON.parse(
              await file.text()
            ) as unknown

          const normalized =
            isMAQuadroProject(
              parsed
            )
              ? parsed
              : migrateLegacyMAQuadroDesign(
                  parsed
                )

          if (!normalized) {
            throw new Error(
              'Projeto inválido.'
            )
          }

          const imported =
            duplicateProject(
              normalized,
              normalized.name
            )

          await saveMAQuadroProject(
            imported
          )

          await refreshProjectLibrary()

          await loadPage(
            imported,
            imported.activePageId,
            true
          )

          setActivePanel(
            'elements'
          )

          setStatusMessage(
            `“${imported.name}” importado e guardado neste dispositivo.`
          )

          setSaveState(
            'saved'
          )
        } catch (error) {
          console.error(
            error
          )

          setStatusMessage(
            'Este ficheiro não é um projeto MA-Quadro válido.'
          )
        } finally {
          setBusy(false)
        }
      },
      [
        loadPage,
        refreshProjectLibrary
      ]
    )

  const ensureEditableProject =
    useCallback(
      (
        source:
          MAQuadroProject
      ) => {
        if (
          !source.isTemplate
        ) {
          return source
        }

        return duplicateProject(
          source,
          `${source.name} — cópia`
        )
      },
      []
    )

  const setActivePage =
    useCallback(
      async (
        pageId: string
      ) => {
        const captured =
          captureCurrentPage()

        if (
          !captured ||
          captured.activePageId ===
            pageId
        ) {
          return
        }

        if (
          !captured.isTemplate
        ) {
          await saveMAQuadroProject(
            captured
          )

          await refreshProjectLibrary()
        }

        await loadPage(
          {
            ...captured,
            activePageId:
              pageId
          },
          pageId
        )
      },
      [
        captureCurrentPage,
        loadPage,
        refreshProjectLibrary
      ]
    )

  const addPage =
    useCallback(
      async () => {
        const captured =
          captureCurrentPage()

        if (!captured) {
          return
        }

        const editable =
          ensureEditableProject(
            captured
          )

        const sourcePage =
          getActiveProjectPage(
            editable
          )

        const nextPage =
          createBlankPage(
            sourcePage.width,
            sourcePage.height,
            `Página ${
              editable.pages
                .length +
              1
            }`,
            sourcePage.background
          )

        const next = {
          ...editable,
          pages: [
            ...editable.pages,
            nextPage
          ],
          activePageId:
            nextPage.id,
          updatedAt:
            new Date()
              .toISOString()
        }

        await saveMAQuadroProject(
          next
        )

        await refreshProjectLibrary()

        await loadPage(
          next,
          nextPage.id,
          true
        )

        setStatusMessage(
          'Nova página adicionada.'
        )
      },
      [
        captureCurrentPage,
        ensureEditableProject,
        loadPage,
        refreshProjectLibrary
      ]
    )

  const duplicateActivePage =
    useCallback(
      async () => {
        const captured =
          captureCurrentPage()

        if (!captured) {
          return
        }

        const editable =
          ensureEditableProject(
            captured
          )

        const currentPage =
          getActiveProjectPage(
            editable
          )

        const copy =
          duplicatePage(
            currentPage
          )

        const index =
          editable.pages
            .findIndex(
              (page) =>
                page.id ===
                currentPage.id
            )

        const pages =
          [...editable.pages]

        pages.splice(
          index + 1,
          0,
          copy
        )

        const next = {
          ...editable,
          pages,
          activePageId:
            copy.id,
          updatedAt:
            new Date()
              .toISOString()
        }

        await saveMAQuadroProject(
          next
        )

        await refreshProjectLibrary()

        await loadPage(
          next,
          copy.id,
          true
        )

        setStatusMessage(
          'Página duplicada.'
        )
      },
      [
        captureCurrentPage,
        ensureEditableProject,
        loadPage,
        refreshProjectLibrary
      ]
    )

  const deleteActivePage =
    useCallback(
      async () => {
        const captured =
          captureCurrentPage()

        if (!captured) {
          return
        }

        if (
          captured.pages
            .length ===
          1
        ) {
          setStatusMessage(
            'O projeto precisa de ter pelo menos uma página.'
          )
          return
        }

        if (
          !window.confirm(
            'Eliminar a página atual?'
          )
        ) {
          return
        }

        const editable =
          ensureEditableProject(
            captured
          )

        const index =
          editable.pages
            .findIndex(
              (page) =>
                page.id ===
                editable
                  .activePageId
            )

        const pages =
          editable.pages
            .filter(
              (page) =>
                page.id !==
                editable
                  .activePageId
            )

        const nextPage =
          pages[
            Math.min(
              index,
              pages.length - 1
            )
          ]

        const next = {
          ...editable,
          pages,
          activePageId:
            nextPage.id,
          updatedAt:
            new Date()
              .toISOString()
        }

        historiesRef.current
          .delete(
            editable.activePageId
          )

        await saveMAQuadroProject(
          next
        )

        await refreshProjectLibrary()

        await loadPage(
          next,
          nextPage.id
        )

        setStatusMessage(
          'Página eliminada.'
        )
      },
      [
        captureCurrentPage,
        ensureEditableProject,
        loadPage,
        refreshProjectLibrary
      ]
    )

  const renamePage =
    useCallback(
      (
        pageId: string,
        name: string
      ) => {
        const current =
          projectRef.current

        if (!current) {
          return
        }

        const next = {
          ...current,
          pages:
            current.pages.map(
              (page) =>
                page.id ===
                pageId
                  ? {
                      ...page,
                      name
                    }
                  : page
            )
        }

        projectRef.current =
          next

        setProject(next)

        setActivePageState(
          getActiveProjectPage(
            next
          )
        )

        markDirty(
          'Nome da página atualizado.'
        )
      },
      [
        markDirty
      ]
    )

  const movePage =
    useCallback(
      (
        pageId: string,
        direction:
          | 'left'
          | 'right'
      ) => {
        const current =
          projectRef.current

        if (!current) {
          return
        }

        const index =
          current.pages
            .findIndex(
              (page) =>
                page.id ===
                pageId
            )

        const target =
          direction ===
            'left'
            ? index - 1
            : index + 1

        if (
          index < 0 ||
          target < 0 ||
          target >=
            current.pages
              .length
        ) {
          return
        }

        const pages =
          [...current.pages]

        const [
          moved
        ] = pages.splice(
          index,
          1
        )

        pages.splice(
          target,
          0,
          moved
        )

        const next = {
          ...current,
          pages,
          updatedAt:
            new Date()
              .toISOString()
        }

        projectRef.current =
          next

        setProject(next)

        markDirty(
          'Ordem das páginas atualizada.'
        )
      },
      [
        markDirty
      ]
    )

  const resizeAllPages =
    useCallback(
      async (
        width: number,
        height: number
      ) => {
        const captured =
          captureCurrentPage()

        if (!captured) {
          return
        }

        if (
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

        const editable =
          ensureEditableProject(
            captured
          )

        const pages =
          editable.pages.map(
            (page) => ({
              ...page,
              width:
                Math.round(
                  width
                ),
              height:
                Math.round(
                  height
                )
            })
          )

        const next = {
          ...editable,
          pages,
          updatedAt:
            new Date()
              .toISOString()
        }

        await saveMAQuadroProject(
          next
        )

        await refreshProjectLibrary()

        await loadPage(
          next,
          next.activePageId,
          true
        )

        setStatusMessage(
          'Todas as páginas foram redimensionadas. Os elementos mantiveram a escala e a posição.'
        )
      },
      [
        captureCurrentPage,
        ensureEditableProject,
        loadPage,
        refreshProjectLibrary
      ]
    )

  const addText =
    useCallback(
      (
        preset:
          MAQuadroTextPreset
      ) => {
        const canvas =
          canvasRef.current

        if (!canvas) {
          return
        }

        const object =
          createMAQuadroText(
            canvas,
            preset,
            availableFonts[0]
              ?.family ||
              'Arial'
          )

        canvas.add(
          object
        )

        canvas.setActiveObject(
          object
        )

        canvas.requestRenderAll()

        setActivePanel(
          'text'
        )
      },
      [
        availableFonts
      ]
    )

  const addShape =
    useCallback(
      (
        kind:
          MAQuadroShapeKind
      ) => {
        const canvas =
          canvasRef.current

        if (!canvas) {
          return
        }

        const object =
          createMAQuadroShape(
            canvas,
            kind,
            brand.colors[0]
              ?.value ||
              '#22D3EE'
          )

        canvas.add(
          object
        )

        canvas.setActiveObject(
          object
        )

        canvas.requestRenderAll()

        setActivePanel(
          'elements'
        )
      },
      [
        brand.colors
      ]
    )

  const addFilesToCanvas =
    useCallback(
      async (
        files:
          | FileList
          | File[]
      ) => {
        const canvas =
          canvasRef.current

        const imageFiles =
          Array.from(
            files
          ).filter(
            (file) =>
              file.type
                .startsWith(
                  'image/'
                )
          )

        if (
          !canvas ||
          imageFiles.length ===
            0
        ) {
          if (
            files.length >
            0
          ) {
            setStatusMessage(
              'Selecione ficheiros de imagem compatíveis.'
            )
          }

          return
        }

        setBusy(true)

        isLoadingRef.current =
          true

        try {
          const added:
            MAQuadroFabricObject[] =
              []

          for (
            let index = 0;
            index <
              imageFiles.length;
            index += 1
          ) {
            const object =
              await createMAQuadroImage(
                canvas,
                imageFiles[
                  index
                ]
              )

            object.set({
              left:
                (
                  object.left ||
                  0
                ) +
                index *
                32,

              top:
                (
                  object.top ||
                  0
                ) +
                index *
                32
            })

            object.setCoords()

            canvas.add(
              object
            )

            added.push(
              object
            )
          }

          if (
            added.length ===
            1
          ) {
            canvas.setActiveObject(
              added[0]
            )
          } else {
            canvas.setActiveObject(
              new ActiveSelection(
                added,
                {
                  canvas
                }
              )
            )
          }

          canvas.requestRenderAll()
        } catch (error) {
          console.error(
            error
          )

          setStatusMessage(
            'Não foi possível adicionar uma ou mais imagens.'
          )
        } finally {
          isLoadingRef.current =
            false

          setBusy(false)
        }

        commitChange(
          imageFiles.length ===
            1
            ? 'Imagem adicionada.'
            : `${imageFiles.length} imagens adicionadas.`
        )
      },
      [
        commitChange
      ]
    )

  const addImages =
    useCallback(
      async (
        event:
          ChangeEvent<HTMLInputElement>
      ) => {
        const files =
          event.target.files

        event.target.value =
          ''

        if (files) {
          await addFilesToCanvas(
            files
          )
        }
      },
      [
        addFilesToCanvas
      ]
    )

  const handleDroppedFiles =
    useCallback(
      async (
        files:
          | FileList
          | File[]
      ) => {
        await addFilesToCanvas(
          files
        )
      },
      [
        addFilesToCanvas
      ]
    )

  const setDrawingMode =
    useCallback(
      (
        enabled: boolean
      ) => {
        const canvas =
          canvasRef.current

        if (!canvas) {
          return
        }

        canvas
          .discardActiveObject()

        canvas.isDrawingMode =
          enabled

        setDrawingModeState(
          enabled
        )

        setActivePanel(
          'elements'
        )

        syncSelection()

        setStatusMessage(
          enabled
            ? 'Desenho livre ativo. Arraste no quadro para desenhar.'
            : 'Desenho livre desativado.'
        )
      },
      [
        syncSelection
      ]
    )

  const setBrushColor =
    useCallback(
      (
        color: string
      ) => {
        const canvas =
          canvasRef.current

        brushColorRef.current =
          color

        setBrushColorState(
          color
        )

        if (canvas) {
          configureMAQuadroBrush(
            canvas,
            color,
            brushWidthRef
              .current
          )
        }
      },
      []
    )

  const setBrushWidth =
    useCallback(
      (
        width: number
      ) => {
        const canvas =
          canvasRef.current

        const safe =
          Math.min(
            120,
            Math.max(
              1,
              width
            )
          )

        brushWidthRef.current =
          safe

        setBrushWidthState(
          safe
        )

        if (canvas) {
          configureMAQuadroBrush(
            canvas,
            brushColorRef
              .current,
            safe
          )
        }
      },
      []
    )

  const deleteSelection =
    useCallback(() => {
      const canvas =
        canvasRef.current

      const objects =
        canvas
          ?.getActiveObjects() ||
        []

      if (
        !canvas ||
        objects.length ===
          0
      ) {
        return
      }

      isLoadingRef.current =
        true

      try {
        canvas
          .discardActiveObject()

        canvas.remove(
          ...objects
        )

        canvas.requestRenderAll()
      } finally {
        isLoadingRef.current =
          false
      }

      commitChange(
        objects.length === 1
          ? 'Elemento eliminado.'
          : 'Elementos eliminados.'
      )
    }, [
      commitChange
    ])

  const copySelection =
    useCallback(
      async () => {
        const canvas =
          canvasRef.current

        const active =
          canvas
            ?.getActiveObject() as
            | MAQuadroFabricObject
            | undefined

        if (!active) {
          return
        }

        clipboardRef.current =
          await active.clone(
            MA_QUADRO_SERIALIZED_PROPERTIES
          ) as
            MAQuadroFabricObject

        setStatusMessage(
          'Seleção copiada.'
        )
      },
      []
    )

  const pasteSelection =
    useCallback(
      async () => {
        const canvas =
          canvasRef.current

        const source =
          clipboardRef.current

        if (
          !canvas ||
          !source
        ) {
          return
        }

        const clone =
          await source.clone(
            MA_QUADRO_SERIALIZED_PROPERTIES
          ) as
            MAQuadroFabricObject

        isLoadingRef.current =
          true

        try {
          canvas
            .discardActiveObject()

          if (
            clone instanceof
              ActiveSelection
          ) {
            const objects =
              clone.removeAll() as MAQuadroFabricObject[]

            for (
              const object
              of objects
            ) {
              object.set({
                left:
                  (
                    object.left ||
                    0
                  ) +
                  28,

                top:
                  (
                    object.top ||
                    0
                  ) +
                  28
              })

              object.maId =
                createMAQuadroId(
                  'object'
                )

              object.maName =
                `${
                  getMAQuadroObjectLabel(
                    object
                  )
                } — cópia`

              prepareMAQuadroObject(
                object,
                getMAQuadroObjectRole(
                  object
                ),
                object.maName
              )

              canvas.add(
                object
              )
            }

            canvas.setActiveObject(
              new ActiveSelection(
                objects,
                {
                  canvas
                }
              )
            )
          } else {
            clone.set({
              left:
                (
                  source.left ||
                  0
                ) +
                28,

              top:
                (
                  source.top ||
                  0
                ) +
                28,

              evented: true,
              selectable: true
            })

            clone.maId =
              createMAQuadroId(
                'object'
              )

            clone.maName =
              `${
                getMAQuadroObjectLabel(
                  source
                )
              } — cópia`

            prepareMAQuadroObject(
              clone,
              getMAQuadroObjectRole(
                clone
              ),
              clone.maName
            )

            canvas.add(
              clone
            )

            canvas.setActiveObject(
              clone
            )
          }

          canvas.requestRenderAll()
        } finally {
          isLoadingRef.current =
            false
        }

        clipboardRef.current =
          clone

        commitChange(
          'Seleção colada.'
        )
      },
      [
        commitChange
      ]
    )

  const duplicateSelection =
    useCallback(
      async () => {
        await copySelection()
        await pasteSelection()
      },
      [
        copySelection,
        pasteSelection
      ]
    )

  const selectAll =
    useCallback(() => {
      const canvas =
        canvasRef.current

      if (!canvas) {
        return
      }

      selectAllMAQuadroObjects(
        canvas
      )

      syncSelection()
    }, [
      syncSelection
    ])

  const groupSelection =
    useCallback(() => {
      const canvas =
        canvasRef.current

      if (
        !canvas ||
        canvas
          .getActiveObjects()
          .length <
          2
      ) {
        return
      }

      isLoadingRef.current =
        true

      try {
        groupMAQuadroSelection(
          canvas
        )
      } finally {
        isLoadingRef.current =
          false
      }

      commitChange(
        'Elementos agrupados.'
      )
    }, [
      commitChange
    ])

  const ungroupSelection =
    useCallback(() => {
      const canvas =
        canvasRef.current

      const active =
        canvas
          ?.getActiveObject()

      if (
        !canvas ||
        !(
          active instanceof
          Group
        ) ||
        active instanceof
          ActiveSelection
      ) {
        return
      }

      isLoadingRef.current =
        true

      try {
        ungroupMAQuadroSelection(
          canvas
        )
      } finally {
        isLoadingRef.current =
          false
      }

      commitChange(
        'Grupo desagrupado.'
      )
    }, [
      commitChange
    ])

  const alignSelection =
    useCallback(
      (
        alignment:
          MAQuadroAlignAction
      ) => {
        const canvas =
          canvasRef.current

        const active =
          canvas
            ?.getActiveObject() as
            | MAQuadroFabricObject
            | undefined

        if (
          !canvas ||
          !active ||
          active.maLocked
        ) {
          return
        }

        alignMAQuadroSelection(
          canvas,
          active,
          alignment
        )

        commitChange(
          'Alinhamento atualizado.'
        )
      },
      [
        commitChange
      ]
    )

  const distributeSelection =
    useCallback(
      (
        direction:
          | 'horizontal'
          | 'vertical'
      ) => {
        const canvas =
          canvasRef.current

        if (!canvas) {
          return
        }

        if (
          !distributeMAQuadroSelection(
            canvas,
            direction
          )
        ) {
          setStatusMessage(
            'Selecione pelo menos três elementos para distribuir.'
          )
          return
        }

        commitChange(
          'Espaçamento distribuído uniformemente.'
        )
      },
      [
        commitChange
      ]
    )

  const arrangeSelection =
    useCallback(
      (
        action:
          MAQuadroArrangeAction
      ) => {
        const canvas =
          canvasRef.current

        const active =
          canvas
            ?.getActiveObject() as
            | MAQuadroFabricObject
            | undefined

        if (
          !canvas ||
          !active
        ) {
          return
        }

        arrangeMAQuadroObject(
          canvas,
          active,
          action
        )

        commitChange(
          'Ordem do elemento atualizada.'
        )
      },
      [
        commitChange
      ]
    )

  const moveSelection =
    useCallback(
      (
        x: number,
        y: number
      ) => {
        const canvas =
          canvasRef.current

        const active =
          canvas
            ?.getActiveObject() as
            | MAQuadroFabricObject
            | undefined

        if (
          !canvas ||
          !active ||
          active.maLocked
        ) {
          return
        }

        active.set({
          left:
            (
              active.left ||
              0
            ) +
            x,

          top:
            (
              active.top ||
              0
            ) +
            y
        })

        active.setCoords()

        canvas.requestRenderAll()

        commitChange(
          'Posição atualizada.'
        )
      },
      [
        commitChange
      ]
    )

  const applyHistory =
    useCallback(
      async (
        serialized: string
      ) => {
        const canvas =
          canvasRef.current

        const current =
          projectRef.current

        if (
          !canvas ||
          !current
        ) {
          return
        }

        const snapshot =
          JSON.parse(
            serialized
          ) as {
            pageId: string
            background:
              MAQuadroBackground
            canvasJson:
              Record<
                string,
                unknown
              >
          }

        const page =
          current.pages.find(
            (item) =>
              item.id ===
              snapshot.pageId
          )

        if (!page) {
          return
        }

        isApplyingHistoryRef
          .current = true

        isLoadingRef.current =
          true

        try {
          canvas
            .discardActiveObject()

          canvas.clear()

          await loadMAQuadroCanvasJson(
            canvas,
            snapshot.canvasJson
          )

          const updatedPage = {
            ...page,
            background:
              snapshot.background,
            canvasJson:
              snapshot.canvasJson
          }

          const next =
            replaceProjectPage(
              current,
              updatedPage
            )

          applyMAQuadroPageBackground(
            canvas,
            updatedPage
          )

          projectRef.current =
            next

          setProject(next)

          setActivePageState(
            updatedPage
          )

          canvas.requestRenderAll()

          syncLayers()
          syncSelection()
        } finally {
          isLoadingRef.current =
            false

          isApplyingHistoryRef
            .current = false
        }

        markDirty(
          'Histórico aplicado.'
        )
      },
      [
        markDirty,
        syncLayers,
        syncSelection
      ]
    )

  const undo =
    useCallback(
      async () => {
        const pageId =
          projectRef.current
            ?.activePageId

        const history =
          pageId
            ? historiesRef.current
                .get(pageId)
            : undefined

        if (
          !history ||
          history.index <=
            0
        ) {
          return
        }

        history.index -= 1

        await applyHistory(
          history.entries[
            history.index
          ]
        )

        updateHistoryButtons()
      },
      [
        applyHistory,
        updateHistoryButtons
      ]
    )

  const redo =
    useCallback(
      async () => {
        const pageId =
          projectRef.current
            ?.activePageId

        const history =
          pageId
            ? historiesRef.current
                .get(pageId)
            : undefined

        if (
          !history ||
          history.index >=
            history.entries
              .length -
              1
        ) {
          return
        }

        history.index += 1

        await applyHistory(
          history.entries[
            history.index
          ]
        )

        updateHistoryButtons()
      },
      [
        applyHistory,
        updateHistoryButtons
      ]
    )

  const selectLayer =
    useCallback(
      (
        layerId: string
      ) => {
        const canvas =
          canvasRef.current

        const object =
          findCanvasObject(
            layerId
          )

        if (
          !canvas ||
          !object ||
          object.maLocked ||
          object.visible ===
            false
        ) {
          return
        }

        canvas.setActiveObject(
          object
        )

        canvas.requestRenderAll()

        syncSelection()
      },
      [
        findCanvasObject,
        syncSelection
      ]
    )

  const toggleLayerVisibility =
    useCallback(
      (
        layerId: string
      ) => {
        const canvas =
          canvasRef.current

        const object =
          findCanvasObject(
            layerId
          )

        if (
          !canvas ||
          !object
        ) {
          return
        }

        object.set({
          visible:
            object.visible ===
            false
        })

        canvas
          .discardActiveObject()

        canvas.requestRenderAll()

        commitChange(
          'Visibilidade da camada atualizada.'
        )
      },
      [
        commitChange,
        findCanvasObject
      ]
    )

  const toggleLayerLock =
    useCallback(
      (
        layerId: string
      ) => {
        const canvas =
          canvasRef.current

        const object =
          findCanvasObject(
            layerId
          )

        if (
          !canvas ||
          !object
        ) {
          return
        }

        applyMAQuadroLock(
          object,
          !object.maLocked
        )

        canvas
          .discardActiveObject()

        canvas.requestRenderAll()

        commitChange(
          object.maLocked
            ? 'Camada bloqueada.'
            : 'Camada desbloqueada.'
        )
      },
      [
        commitChange,
        findCanvasObject
      ]
    )

  const moveLayer =
    useCallback(
      (
        layerId: string,
        direction:
          | 'up'
          | 'down'
      ) => {
        const canvas =
          canvasRef.current

        const object =
          findCanvasObject(
            layerId
          )

        if (
          !canvas ||
          !object
        ) {
          return
        }

        arrangeMAQuadroObject(
          canvas,
          object,
          direction ===
            'up'
            ? 'forward'
            : 'backward'
        )

        commitChange(
          'Ordem da camada atualizada.'
        )
      },
      [
        commitChange,
        findCanvasObject
      ]
    )

  const applyToSelectedObjects =
    useCallback(
      (
        operation: (
          object:
            MAQuadroFabricObject
        ) => void,
        message: string
      ) => {
        const canvas =
          canvasRef.current

        const objects =
          canvas?.getActiveObjects() as
            | MAQuadroFabricObject[]
            | undefined

        if (
          !canvas ||
          !objects ||
          objects.length ===
            0
        ) {
          return
        }

        for (
          const object
          of objects
        ) {
          if (
            !object.maLocked
          ) {
            operation(
              object
            )

            object.setCoords()
          }
        }

        canvas.requestRenderAll()

        syncSelection()

        commitChange(
          message
        )
      },
      [
        commitChange,
        syncSelection
      ]
    )

  const setSelectionName =
    useCallback(
      (
        name: string
      ) => {
        const active =
          canvasRef.current
            ?.getActiveObject() as
            | MAQuadroFabricObject
            | undefined

        if (!active) {
          return
        }

        active.maName =
          name

        syncSelection()

        commitChange(
          'Nome da camada atualizado.'
        )
      },
      [
        commitChange,
        syncSelection
      ]
    )

  const setSelectionFill =
    useCallback(
      (
        color: string
      ) => {
        applyToSelectedObjects(
          (object) => {
            if (
              getMAQuadroObjectRole(
                object
              ) === 'line'
            ) {
              object.set({
                stroke: color,
                fill: color
              })
            } else if (
              getMAQuadroObjectRole(
                object
              ) !== 'image'
            ) {
              object.set({
                fill: color
              })
            }
          },
          'Cor atualizada.'
        )
      },
      [
        applyToSelectedObjects
      ]
    )

  const setSelectionStroke =
    useCallback(
      (
        color: string
      ) => {
        applyToSelectedObjects(
          (object) => {
            object.set({
              stroke: color
            })
          },
          'Contorno atualizado.'
        )
      },
      [
        applyToSelectedObjects
      ]
    )

  const setSelectionStrokeWidth =
    useCallback(
      (
        width: number
      ) => {
        const safe =
          Math.min(
            200,
            Math.max(
              0,
              width
            )
          )

        applyToSelectedObjects(
          (object) => {
            object.set({
              strokeWidth:
                safe
            })
          },
          'Espessura do contorno atualizada.'
        )
      },
      [
        applyToSelectedObjects
      ]
    )

  const setSelectionOpacity =
    useCallback(
      (
        opacity: number
      ) => {
        const safe =
          Math.min(
            100,
            Math.max(
              0,
              opacity
            )
          )

        applyToSelectedObjects(
          (object) => {
            object.set({
              opacity:
                safe / 100
            })
          },
          'Opacidade atualizada.'
        )
      },
      [
        applyToSelectedObjects
      ]
    )

  const setSelectionGeometry =
    useCallback(
      (
        field:
          | 'x'
          | 'y'
          | 'width'
          | 'height'
          | 'angle',
        value: number
      ) => {
        const canvas =
          canvasRef.current

        const active =
          canvas
            ?.getActiveObject() as
            | MAQuadroFabricObject
            | undefined

        if (
          !canvas ||
          !active ||
          !Number.isFinite(
            value
          )
        ) {
          return
        }

        setMAQuadroObjectGeometry(
          active,
          {
            [field]:
              value
          }
        )

        canvas.requestRenderAll()

        syncSelection()

        commitChange(
          'Geometria atualizada.'
        )
      },
      [
        commitChange,
        syncSelection
      ]
    )

  const setSelectionFlip =
    useCallback(
      (
        axis:
          | 'x'
          | 'y'
      ) => {
        applyToSelectedObjects(
          (object) => {
            object.set(
              axis === 'x'
                ? {
                    flipX:
                      !object.flipX
                  }
                : {
                    flipY:
                      !object.flipY
                  }
            )
          },
          axis === 'x'
            ? 'Elemento virado horizontalmente.'
            : 'Elemento virado verticalmente.'
        )
      },
      [
        applyToSelectedObjects
      ]
    )

  const setTextProperty =
    useCallback(
      (
        property:
          | 'fontFamily'
          | 'fontSize'
          | 'fontWeight'
          | 'fontStyle'
          | 'textAlign'
          | 'lineHeight'
          | 'charSpacing'
          | 'underline'
          | 'linethrough',

        value:
          | string
          | number
          | boolean
      ) => {
        applyToSelectedObjects(
          (object) => {
            if (
              object instanceof
              Textbox
            ) {
              object.set({
                [property]:
                  value
              })
            }
          },
          'Texto atualizado.'
        )
      },
      [
        applyToSelectedObjects
      ]
    )

  const transformTextCase =
    useCallback(
      (
        mode:
          | 'upper'
          | 'lower'
          | 'title'
      ) => {
        applyToSelectedObjects(
          (object) => {
            if (
              !(
                object instanceof
                Textbox
              )
            ) {
              return
            }

            const value =
              object.text ||
              ''

            object.set({
              text:
                mode ===
                  'upper'
                  ? value
                      .toLocaleUpperCase(
                        'pt-PT'
                      )
                  : mode ===
                      'lower'
                    ? value
                        .toLocaleLowerCase(
                          'pt-PT'
                        )
                    : titleCase(
                        value
                      )
            })
          },
          'Capitalização do texto atualizada.'
        )
      },
      [
        applyToSelectedObjects
      ]
    )

  const setCornerRadius =
    useCallback(
      (
        value: number
      ) => {
        const safe =
          Math.min(
            1000,
            Math.max(
              0,
              value
            )
          )

        applyToSelectedObjects(
          (object) => {
            if (
              'rx' in object
            ) {
              object.set({
                rx: safe,
                ry: safe
              })
            }
          },
          'Cantos arredondados atualizados.'
        )
      },
      [
        applyToSelectedObjects
      ]
    )

  const setShadow =
    useCallback(
      (
        values:
          Partial<{
            enabled: boolean
            color: string
            blur: number
            offsetX: number
            offsetY: number
          }>
      ) => {
        const next = {
          enabled:
            values.enabled ??
            selection
              .shadowEnabled,

          color:
            values.color ??
            selection
              .shadowColor,

          blur:
            values.blur ??
            selection
              .shadowBlur,

          offsetX:
            values.offsetX ??
            selection
              .shadowOffsetX,

          offsetY:
            values.offsetY ??
            selection
              .shadowOffsetY
        }

        applyToSelectedObjects(
          (object) => {
            setMAQuadroObjectShadow(
              object,
              next.enabled,
              next.color,
              next.blur,
              next.offsetX,
              next.offsetY
            )
          },
          'Sombra atualizada.'
        )
      },
      [
        applyToSelectedObjects,
        selection
      ]
    )

  const setGradient =
    useCallback(
      (
        values:
          Partial<{
            enabled: boolean
            from: string
            to: string
            angle: number
          }>
      ) => {
        const next = {
          enabled:
            values.enabled ??
            selection
              .gradientEnabled,

          from:
            values.from ??
            selection
              .gradientFrom,

          to:
            values.to ??
            selection
              .gradientTo,

          angle:
            values.angle ??
            selection
              .gradientAngle
        }

        applyToSelectedObjects(
          (object) => {
            if (
              next.enabled
            ) {
              setMAQuadroObjectGradient(
                object,
                next.from,
                next.to,
                next.angle
              )
            } else {
              object.set({
                fill:
                  next.from
              })
            }
          },
          'Gradiente atualizado.'
        )
      },
      [
        applyToSelectedObjects,
        selection
      ]
    )

  const getSelectedImage =
    useCallback(() => {
      const canvas =
        canvasRef.current

      const activeObjects =
        canvas
          ?.getActiveObjects() ||
        []

      if (
        activeObjects.length !==
          1 ||
        !(
          activeObjects[0]
          instanceof
            FabricImage
        )
      ) {
        return null
      }

      return (
        activeObjects[0] as
          FabricImage &
          MAQuadroFabricObject
      )
    }, [])

  const setImageFilters =
    useCallback(
      (
        values:
          Partial<MAQuadroImageFilterState>
      ) => {
        const image =
          getSelectedImage()

        const canvas =
          canvasRef.current

        if (
          !image ||
          !canvas
        ) {
          return
        }

        applyMAQuadroImageFilters(
          image,
          {
            ...getMAQuadroImageFilters(
              image
            ),
            ...values
          }
        )

        canvas.requestRenderAll()

        syncSelection()

        commitChange(
          'Ajustes da imagem atualizados.'
        )
      },
      [
        commitChange,
        getSelectedImage,
        syncSelection
      ]
    )

  const resetImageFilters =
    useCallback(() => {
      const image =
        getSelectedImage()

      const canvas =
        canvasRef.current

      if (
        !image ||
        !canvas
      ) {
        return
      }

      resetMAQuadroImageFilters(
        image
      )

      canvas.requestRenderAll()

      syncSelection()

      commitChange(
        'Filtros da imagem repostos.'
      )
    }, [
      commitChange,
      getSelectedImage,
      syncSelection
    ])

  const setImageCrop =
    useCallback(
      (
        horizontal:
          number,
        vertical:
          number
      ) => {
        const image =
          getSelectedImage()

        const canvas =
          canvasRef.current

        if (
          !image ||
          !canvas
        ) {
          return
        }

        cropMAQuadroImageSymmetrically(
          image,
          horizontal,
          vertical
        )

        canvas.requestRenderAll()

        syncSelection()

        commitChange(
          'Recorte da imagem atualizado.'
        )
      },
      [
        commitChange,
        getSelectedImage,
        syncSelection
      ]
    )

  const resetImageCrop =
    useCallback(() => {
      const image =
        getSelectedImage()

      const canvas =
        canvasRef.current

      if (
        !image ||
        !canvas
      ) {
        return
      }

      resetMAQuadroImageCrop(
        image
      )

      canvas.requestRenderAll()

      syncSelection()

      commitChange(
        'Recorte da imagem reposto.'
      )
    }, [
      commitChange,
      getSelectedImage,
      syncSelection
    ])

  const removeImageBackground =
    useCallback(
      async () => {
        const image =
          getSelectedImage()

        const canvas =
          canvasRef.current

        if (
          !image ||
          !canvas ||
          !image.maSourceDataUrl
        ) {
          setStatusMessage(
            'A remoção local de fundo só está disponível para imagens carregadas neste editor.'
          )
          return
        }

        setBusy(true)

        setStatusMessage(
          'A remover o fundo localmente…'
        )

        try {
          const transparentDataUrl =
            await removeSimpleImageBackground(
              image
                .maSourceDataUrl
            )

          const replacement =
            await FabricImage
              .fromURL(
                transparentDataUrl
              ) as
                FabricImage &
                MAQuadroFabricObject

          const index =
            canvas
              .getObjects()
              .indexOf(
                image
              )

          const displayWidth =
            image
              .getScaledWidth()

          const displayHeight =
            image
              .getScaledHeight()

          replacement.set({
            left:
              image.left,

            top:
              image.top,

            originX:
              image.originX,

            originY:
              image.originY,

            angle:
              image.angle,

            skewX:
              image.skewX,

            skewY:
              image.skewY,

            flipX:
              image.flipX,

            flipY:
              image.flipY,

            opacity:
              image.opacity,

            stroke:
              image.stroke,

            strokeWidth:
              image.strokeWidth,

            shadow:
              image.shadow,

            cropX: 0,
            cropY: 0,

            scaleX:
              displayWidth /
              Math.max(
                1,
                replacement.width ||
                1
              ),

            scaleY:
              displayHeight /
              Math.max(
                1,
                replacement.height ||
                1
              )
          })

          replacement.maId =
            image.maId

          replacement.maName =
            image.maName

          replacement.maRole =
            'image'

          replacement
            .maSourceDataUrl =
              transparentDataUrl

          replacement
            .maOriginalWidth =
              replacement.width ||
              1

          replacement
            .maOriginalHeight =
              replacement.height ||
              1

          prepareMAQuadroObject(
            replacement,
            'image',
            image.maName ||
              'Imagem sem fundo'
          )

          isLoadingRef.current =
            true

          try {
            canvas
              .discardActiveObject()

            canvas.remove(
              image
            )

            canvas.add(
              replacement
            )

            canvas.moveObjectTo(
              replacement,
              Math.max(
                0,
                index
              )
            )

            canvas.setActiveObject(
              replacement
            )

            canvas.requestRenderAll()
          } finally {
            isLoadingRef.current =
              false
          }

          commitChange(
            'Fundo removido localmente.'
          )
        } catch (error) {
          console.error(
            error
          )

          setStatusMessage(
            'Não foi possível remover este fundo automaticamente. Esta ferramenta funciona melhor com fundos lisos e uniformes.'
          )
        } finally {
          setBusy(false)
        }
      },
      [
        commitChange,
        getSelectedImage
      ]
    )

  const setBackground =
    useCallback(
      (
        background:
          Partial<MAQuadroBackground>
      ) => {
        const canvas =
          canvasRef.current

        const current =
          projectRef.current

        if (
          !canvas ||
          !current
        ) {
          return
        }

        const page =
          getActiveProjectPage(
            current
          )

        const updatedPage = {
          ...page,
          background: {
            ...page.background,
            ...background
          }
        }

        const next =
          replaceProjectPage(
            current,
            updatedPage
          )

        projectRef.current =
          next

        setProject(next)

        setActivePageState(
          updatedPage
        )

        applyMAQuadroPageBackground(
          canvas,
          updatedPage
        )

        pushHistory()

        markDirty(
          'Fundo da página atualizado.'
        )
      },
      [
        markDirty,
        pushHistory
      ]
    )

  const applyBrandColor =
    useCallback(
      (
        color: string
      ) => {
        const canvas =
          canvasRef.current

        if (
          canvas
            ?.getActiveObjects()
            .length
        ) {
          setSelectionFill(
            color
          )
        } else {
          setBackground({
            type: 'solid',
            color
          })
        }
      },
      [
        setBackground,
        setSelectionFill
      ]
    )

  const uploadFont =
    useCallback(
      async (
        event:
          ChangeEvent<HTMLInputElement>
      ) => {
        const file =
          event.target.files
            ?.[0]

        event.target.value =
          ''

        if (!file) {
          return
        }

        setBusy(true)

        try {
          const family =
            file.name
              .replace(
                /\.(ttf|otf|woff2?)$/i,
                ''
              )
              .replace(
                /[-_]+/g,
                ' '
              )
              .trim() ||
            'Fonte local'

          const existing =
            localFonts.find(
              (font) =>
                font.family
                  .toLocaleLowerCase(
                    'pt-PT'
                  ) ===
                family
                  .toLocaleLowerCase(
                    'pt-PT'
                  )
            )

          const record:
            MAQuadroStoredFont = {
              id:
                existing?.id ||
                createMAQuadroId(
                  'font'
                ),

              family,

              fileName:
                file.name,

              mimeType:
                file.type ||
                'font/ttf',

              data:
                await file
                  .arrayBuffer(),

              createdAt:
                existing
                  ?.createdAt ||
                new Date()
                  .toISOString()
            }

          await registerLocalFont(
            record
          )

          await saveMAQuadroFont(
            record
          )

          setLocalFonts(
            await listMAQuadroFonts()
          )

          setStatusMessage(
            `Fonte “${record.family}” adicionada localmente.`
          )
        } catch (error) {
          console.error(
            error
          )

          setStatusMessage(
            'Não foi possível carregar esta fonte.'
          )
        } finally {
          setBusy(false)
        }
      },
      [
        localFonts
      ]
    )

  const deleteFont =
    useCallback(
      async (
        fontId: string
      ) => {
        try {
          await deleteMAQuadroFont(
            fontId
          )

          setLocalFonts(
            await listMAQuadroFonts()
          )

          setStatusMessage(
            'Fonte eliminada do armazenamento local. Deixará de estar ativa depois de recarregar a página.'
          )
        } catch (error) {
          console.error(
            error
          )

          setStatusMessage(
            'Não foi possível eliminar a fonte.'
          )
        }
      },
      []
    )

  const toggleGrid =
    useCallback(() => {
      setShowGrid(
        (current) =>
          !current
      )
    }, [])

  const toggleSafeArea =
    useCallback(() => {
      setShowSafeArea(
        (current) =>
          !current
      )
    }, [])

  const onWorkspaceWheel =
    useCallback(
      (
        event:
          ReactWheelEvent<HTMLDivElement>
      ) => {
        if (
          !(
            event.ctrlKey ||
            event.metaKey
          )
        ) {
          return
        }

        event.preventDefault()

        const direction =
          event.deltaY >
          0
            ? -5
            : 5

        setZoom(
          zoomRef.current +
          direction
        )
      },
      [
        setZoom
      ]
    )

  const onWorkspacePointerDown =
    useCallback(
      (
        event:
          ReactPointerEvent<HTMLDivElement>
      ) => {
        const workspace =
          workspaceRef.current

        const shouldPan =
          spacePressedRef
            .current ||
          event.button ===
            1

        if (
          !workspace ||
          !shouldPan
        ) {
          return
        }

        event.preventDefault()

        panStateRef.current = {
          active: true,
          startX:
            event.clientX,
          startY:
            event.clientY,
          scrollLeft:
            workspace
              .scrollLeft,
          scrollTop:
            workspace
              .scrollTop
        }

        const move = (
          moveEvent:
            PointerEvent
        ) => {
          const pan =
            panStateRef.current

          if (!pan.active) {
            return
          }

          workspace.scrollLeft =
            pan.scrollLeft -
            (
              moveEvent.clientX -
              pan.startX
            )

          workspace.scrollTop =
            pan.scrollTop -
            (
              moveEvent.clientY -
              pan.startY
            )
        }

        const finish = () => {
          panStateRef.current
            .active = false

          window.removeEventListener(
            'pointermove',
            move
          )

          window.removeEventListener(
            'pointerup',
            finish
          )
        }

        window.addEventListener(
          'pointermove',
          move
        )

        window.addEventListener(
          'pointerup',
          finish
        )
      },
      []
    )

  const setExportOptions =
    useCallback(
      (
        values:
          Partial<MAQuadroExportOptions>
      ) => {
        setExportOptionsState(
          (current) => ({
            ...current,
            ...values
          })
        )
      },
      []
    )

  const runExport =
    useCallback(
      async () => {
        const captured =
          captureCurrentPage()

        if (!captured) {
          return
        }

        const page =
          getActiveProjectPage(
            captured
          )

        setBusy(true)

        setStatusMessage(
          'A preparar a exportação…'
        )

        try {
          if (
            exportOptions
              .format ===
            'project'
          ) {
            exportMAQuadroProjectFile(
              captured
            )
          } else if (
            exportOptions
              .format ===
            'pdf'
          ) {
            await exportMAQuadroPdf(
              captured,
              exportOptions
                .scope ===
              'current'
                ? [page.id]
                : undefined
            )
          } else if (
            exportOptions
              .format ===
            'zip'
          ) {
            await exportMAQuadroPagesZip(
              captured,
              'png',
              exportOptions
                .scale,
              exportOptions
                .quality /
                100
            )
          } else if (
            exportOptions
              .format ===
            'svg'
          ) {
            await exportMAQuadroPageSvg(
              captured,
              page
            )
          } else {
            await exportMAQuadroPageImage(
              captured,
              page,
              exportOptions
                .format,
              exportOptions
                .scale,
              exportOptions
                .quality /
                100
            )
          }

          setExportOpen(
            false
          )

          setStatusMessage(
            'Exportação concluída.'
          )
        } catch (error) {
          console.error(
            error
          )

          setStatusMessage(
            'Não foi possível concluir a exportação.'
          )
        } finally {
          setBusy(false)
        }
      },
      [
        captureCurrentPage,
        exportOptions
      ]
    )

  useEffect(() => {
    const handleKeyDown =
      (
        event:
          KeyboardEvent
      ) => {
        const canvas =
          canvasRef.current

        const active =
          canvas
            ?.getActiveObject() as
            | MAQuadroFabricObject
            | undefined

        const modifier =
          event.ctrlKey ||
          event.metaKey

        if (
          event.code ===
            'Space' &&
          !targetIsFormControl(
            event.target
          )
        ) {
          event.preventDefault()

          spacePressedRef
            .current = true

          setIsSpacePressed(
            true
          )
        }

        if (
          targetIsFormControl(
            event.target
          ) ||
          active?.isEditing
        ) {
          return
        }

        if (
          modifier &&
          event.key
            .toLocaleLowerCase(
              'pt-PT'
            ) ===
            'z'
        ) {
          event.preventDefault()

          void (
            event.shiftKey
              ? redo()
              : undo()
          )
        } else if (
          modifier &&
          event.key
            .toLocaleLowerCase(
              'pt-PT'
            ) ===
            'y'
        ) {
          event.preventDefault()
          void redo()
        } else if (
          modifier &&
          event.key
            .toLocaleLowerCase(
              'pt-PT'
            ) ===
            'c'
        ) {
          event.preventDefault()
          void copySelection()
        } else if (
          modifier &&
          event.key
            .toLocaleLowerCase(
              'pt-PT'
            ) ===
            'v'
        ) {
          event.preventDefault()
          void pasteSelection()
        } else if (
          modifier &&
          event.key
            .toLocaleLowerCase(
              'pt-PT'
            ) ===
            'd'
        ) {
          event.preventDefault()
          void duplicateSelection()
        } else if (
          modifier &&
          event.key
            .toLocaleLowerCase(
              'pt-PT'
            ) ===
            'a'
        ) {
          event.preventDefault()
          selectAll()
        } else if (
          modifier &&
          event.key
            .toLocaleLowerCase(
              'pt-PT'
            ) ===
            's'
        ) {
          event.preventDefault()
          void saveProject(
            false
          )
        } else if (
          event.key ===
            'Delete' ||
          event.key ===
            'Backspace'
        ) {
          if (
            canvas
              ?.getActiveObjects()
              .length
          ) {
            event.preventDefault()
            deleteSelection()
          }
        } else if (
          event.key ===
          'Escape'
        ) {
          if (
            canvas
              ?.isDrawingMode
          ) {
            setDrawingMode(
              false
            )
          } else {
            canvas
              ?.discardActiveObject()

            canvas
              ?.requestRenderAll()

            syncSelection()
          }
        } else if (
          event.key ===
          'ArrowLeft'
        ) {
          event.preventDefault()

          moveSelection(
            event.shiftKey
              ? -10
              : -1,
            0
          )
        } else if (
          event.key ===
          'ArrowRight'
        ) {
          event.preventDefault()

          moveSelection(
            event.shiftKey
              ? 10
              : 1,
            0
          )
        } else if (
          event.key ===
          'ArrowUp'
        ) {
          event.preventDefault()

          moveSelection(
            0,
            event.shiftKey
              ? -10
              : -1
          )
        } else if (
          event.key ===
          'ArrowDown'
        ) {
          event.preventDefault()

          moveSelection(
            0,
            event.shiftKey
              ? 10
              : 1
          )
        }
      }

    const handleKeyUp =
      (
        event:
          KeyboardEvent
      ) => {
        if (
          event.code ===
          'Space'
        ) {
          spacePressedRef
            .current = false

          setIsSpacePressed(
            false
          )
        }
      }

    const handleBlur = () => {
      spacePressedRef.current =
        false

      setIsSpacePressed(
        false
      )
    }

    window.addEventListener(
      'keydown',
      handleKeyDown
    )

    window.addEventListener(
      'keyup',
      handleKeyUp
    )

    window.addEventListener(
      'blur',
      handleBlur
    )

    return () => {
      window.removeEventListener(
        'keydown',
        handleKeyDown
      )

      window.removeEventListener(
        'keyup',
        handleKeyUp
      )

      window.removeEventListener(
        'blur',
        handleBlur
      )
    }
  }, [
    copySelection,
    deleteSelection,
    duplicateSelection,
    moveSelection,
    pasteSelection,
    redo,
    saveProject,
    selectAll,
    setDrawingMode,
    syncSelection,
    undo
  ])

  return {
    canvasElementRef,
    workspaceRef,
    imageInputRef,
    fontInputRef,
    projectInputRef,

    ready,
    busy,
    statusMessage,
    saveState,

    project,
    projects,
    activePage,

    brand,
    localFonts,
    availableFonts,

    layers,
    selection,
    activePanel,

    zoom,
    canUndo,
    canRedo,

    drawingMode,
    brushColor,
    brushWidth,

    showGrid,
    showSafeArea,
    guides,
    isSpacePressed,

    exportOpen,
    newDesignOpen,
    exportOptions,

    presets:
      MA_QUADRO_PRESETS,

    setActivePanel,
    setProjectName,
    saveProject,
    openProject,

    duplicateProject:
      duplicateProjectAction,

    deleteProject:
      deleteProjectAction,

    saveProjectAsTemplate,
    createFromPreset,
    createCustomDesign,
    importProject,

    setActivePage,
    addPage,
    duplicateActivePage,
    deleteActivePage,
    renamePage,
    movePage,
    resizeAllPages,

    addText,
    addShape,
    addImages,
    handleDroppedFiles,

    setDrawingMode,
    setBrushColor,
    setBrushWidth,

    deleteSelection,
    duplicateSelection,
    copySelection,
    pasteSelection,
    selectAll,
    groupSelection,
    ungroupSelection,
    alignSelection,
    distributeSelection,
    arrangeSelection,
    moveSelection,

    undo,
    redo,

    selectLayer,
    toggleLayerVisibility,
    toggleLayerLock,
    moveLayer,

    setSelectionName,
    setSelectionFill,
    setSelectionStroke,
    setSelectionStrokeWidth,
    setSelectionOpacity,
    setSelectionGeometry,
    setSelectionFlip,
    setTextProperty,
    transformTextCase,
    setCornerRadius,
    setShadow,
    setGradient,

    setImageFilters,
    resetImageFilters,
    setImageCrop,
    resetImageCrop,
    removeImageBackground,

    setBackground,
    applyBrandColor,
    uploadFont,
    deleteFont,

    setZoom,
    fitCanvas,
    toggleGrid,
    toggleSafeArea,
    onWorkspaceWheel,
    onWorkspacePointerDown,

    setExportOpen,
    setNewDesignOpen,
    setExportOptions,
    runExport
  }
}
