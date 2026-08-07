import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ChangeEvent,
    type PointerEvent as ReactPointerEvent,
    type WheelEvent as ReactWheelEvent
} from 'react';

import {
    ActiveSelection,
    Canvas as FabricCanvas,
    FabricImage,
    Group,
    Shadow,
    Textbox
} from 'fabric';

import {
    deleteMAQuadroFont,
    deleteMAQuadroProject,
    listMAQuadroFonts,
    listMAQuadroProjects,
    saveMAQuadroFont,
    saveMAQuadroProject
} from '../../lib/maQuadro/db';

import {
    applyMAQuadroImageFrame,
    emptyMAQuadroGuides,
    getMAQuadroCropViewportState,
    getMAQuadroImageFrameKind,
    setMAQuadroCropViewport,
    snapMAQuadroObject,
    type MAQuadroImageFrameKind
} from '../../lib/maQuadro/editorEnhancements';

import {
    exportMAQuadroPageImage,
    exportMAQuadroPageSvg,
    exportMAQuadroPagesZip,
    exportMAQuadroPdf,
    exportMAQuadroProjectFile
} from '../../lib/maQuadro/export';

import {
    applyMAQuadroImageFilters,
    cropMAQuadroImageSymmetrically,
    DEFAULT_IMAGE_FILTERS,
    getMAQuadroImageCropPercentages,
    getMAQuadroImageFilters,
    getMAQuadroImageSourceDataUrl,
    removeSimpleImageBackground,
    resetMAQuadroImageCrop,
    resetMAQuadroImageFilters
} from '../../lib/maQuadro/imageFilters';

import {
    createBlankPage,
    createBlankProject,
    createMAQuadroId,
    duplicatePage,
    duplicateProject,
    getActiveProjectPage,
    replaceProjectPage
} from '../../lib/maQuadro/project';

import {
    normalizeImportedMAQuadroProject
} from '../../lib/maQuadro/projectSafety';

import {
    MA_QUADRO_PRESETS,
    seedMAQuadroTemplates
} from '../../lib/maQuadro/templates';

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
    getMAQuadroObjectGradient,
    getMAQuadroObjectLabel,
    getMAQuadroObjectRole,
    getMAQuadroShapeKind,
    groupMAQuadroSelection,
    loadMAQuadroCanvasJson,
    MA_QUADRO_SERIALIZED_PROPERTIES,
    prepareMAQuadroObject,
    resizeMAQuadroCanvasJson,
    selectAllMAQuadroObjects,
    serializeMAQuadroCanvas,
    setMAQuadroObjectFill,
    setMAQuadroObjectGeometry,
    setMAQuadroObjectGradient,
    setMAQuadroObjectShadow,
    setMAQuadroObjectStroke,
    setMAQuadroObjectStrokeWidth,
    ungroupMAQuadroSelection,
    type MAQuadroAlignAction,
    type MAQuadroArrangeAction,
    type MAQuadroFabricObject
} from '../../lib/maQuadro/canvasObjects';

import type {
    MAQuadroBackground,
    MAQuadroBrand,
    MAQuadroCanvasPreset,
    MAQuadroImageFilterState,
    MAQuadroPage,
    MAQuadroPanelId,
    MAQuadroProject,
    MAQuadroResizeStrategy,
    MAQuadroShapeKind,
    MAQuadroStoredFont,
    MAQuadroTextPreset
} from '../../types/maQuadro';

import type {
    MAQuadroEditor,
    MAQuadroExportOptions,
    MAQuadroLayerItem,
    MAQuadroNewDesignValues,
    MAQuadroSelectionState
} from './editorTypes';

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
    };

const emptySelection:
    MAQuadroSelectionState = {
        count: 0,
        role: null,
        shapeKind: null,
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
        cropVertical: 0,
        cropZoom: 100,
        cropPositionX: 50,
        cropPositionY: 50,
        imageFrame: 'none'
    };

const defaultExportOptions:
    MAQuadroExportOptions = {
        format: 'png',
        scale: 2,
        quality: 92,
        scope: 'current'
    };

const MAX_HISTORY_ENTRIES =
    50;

const MAX_HISTORY_CHARACTERS =
    12_000_000;

type HistoryState = {
    entries: string[];
    index: number;
};

type ImageCropSession = {
    objectId: string;
    left: number;
    top: number;
    width: number;
    height: number;
    cropX: number;
    cropY: number;
    scaleX: number;
    scaleY: number;
    angle: number;
    lockScalingX: boolean;
    lockScalingY: boolean;
    lockRotation: boolean;
    hasControls: boolean;
    startCropX: number;
    startCropY: number;
};

function colorToString(
    value: unknown,
    fallback: string
) {
    return typeof value ===
        'string'
        ? value
        : fallback;
}

function clamp(
    value: number,
    minimum: number,
    maximum: number
) {
    return Math.min(
        maximum,
        Math.max(
            minimum,
            Number.isFinite(
                value
            )
                ? value
                : minimum
        )
    );
}

function registerLocalFont(
    font:
        MAQuadroStoredFont
) {
    const face =
        new FontFace(
            font.family,
            font.data
        );

    return face
        .load()
        .then(
            (loaded) => {
                document.fonts.add(
                    loaded
                );
            }
        );
}

function targetIsFormControl(
    target:
        EventTarget | null
) {
    const element =
        target as
            HTMLElement | null;

    if (!element) {
        return false;
    }

    return Boolean(
        element.tagName ===
        'INPUT' ||
        element.tagName ===
        'TEXTAREA' ||
        element.tagName ===
        'SELECT' ||
        element.tagName ===
        'BUTTON' ||
        element.tagName ===
        'A' ||
        element.isContentEditable ||
        element.closest(
            '[role="dialog"]'
        )
    );
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
                letter
                    .toLocaleUpperCase(
                        'pt-PT'
                    )
        );
}

function renewObjectTreeIdentifiers(
    object:
        MAQuadroFabricObject
) {
    object.maId =
        createMAQuadroId(
            'object'
        );

    if (
        object instanceof
        Group
    ) {
        for (
            const child
            of object.getObjects()
        ) {
            renewObjectTreeIdentifiers(
                child as
                    MAQuadroFabricObject
            );
        }
    }
}

function cropSessionForImage(
    image:
        FabricImage &
        MAQuadroFabricObject,
    previous?:
        ImageCropSession | null
): ImageCropSession {
    return {
        objectId:
            image.maId ||
            '',

        left:
            previous?.left ??
            Number(
                image.left ||
                0
            ),

        top:
            previous?.top ??
            Number(
                image.top ||
                0
            ),

        width:
            previous?.width ??
            Number(
                image.width ||
                1
            ),

        height:
            previous?.height ??
            Number(
                image.height ||
                1
            ),

        cropX:
            previous?.cropX ??
            Number(
                image.cropX ||
                0
            ),

        cropY:
            previous?.cropY ??
            Number(
                image.cropY ||
                0
            ),

        scaleX:
            previous?.scaleX ??
            Number(
                image.scaleX ||
                1
            ),

        scaleY:
            previous?.scaleY ??
            Number(
                image.scaleY ||
                1
            ),

        angle:
            previous?.angle ??
            Number(
                image.angle ||
                0
            ),

        lockScalingX:
            previous
                ?.lockScalingX ??
            Boolean(
                image.lockScalingX
            ),

        lockScalingY:
            previous
                ?.lockScalingY ??
            Boolean(
                image.lockScalingY
            ),

        lockRotation:
            previous
                ?.lockRotation ??
            Boolean(
                image.lockRotation
            ),

        hasControls:
            previous
                ?.hasControls ??
            Boolean(
                image.hasControls
            ),

        startCropX:
            Number(
                image.cropX ||
                0
            ),

        startCropY:
            Number(
                image.cropY ||
                0
            )
    };
}

export function
useMAQuadroEditor():
    MAQuadroEditor {
    const canvasElementRef =
        useRef<
            HTMLCanvasElement | null
        >(null);

    const workspaceRef =
        useRef<
            HTMLDivElement | null
        >(null);

    const imageInputRef =
        useRef<
            HTMLInputElement | null
        >(null);

    const fontInputRef =
        useRef<
            HTMLInputElement | null
        >(null);

    const projectInputRef =
        useRef<
            HTMLInputElement | null
        >(null);

    const canvasRef =
        useRef<
            FabricCanvas | null
        >(null);

    const projectRef =
        useRef<
            MAQuadroProject | null
        >(null);

    const clipboardRef =
        useRef<
            MAQuadroFabricObject | null
        >(null);

    const clipboardPasteCountRef =
        useRef(0);

    const historiesRef =
        useRef<
            Map<
                string,
                HistoryState
            >
        >(
            new Map()
        );

    const isLoadingRef =
        useRef(false);

    const isApplyingHistoryRef =
        useRef(false);

    const initializedRef =
        useRef(false);

    const autosaveTimerRef =
        useRef<
            number | null
        >(null);

    const saveHandlerRef =
        useRef<
            (
                quiet?: boolean
            ) => Promise<boolean>
        >(
            async () =>
                false
        );

    const busyCountRef =
        useRef(0);

    const structuralLockRef =
        useRef(false);

    const uploadLockRef =
        useRef(false);

    const imageCropEditingRef =
        useRef(false);

    const cropSessionRef =
        useRef<
            ImageCropSession | null
        >(null);

    const drawingPathRef =
        useRef<
            MAQuadroFabricObject | null
        >(null);

    const saveStateRef =
        useRef<
            MAQuadroEditor['saveState']
        >('ready');

    const zoomRef =
        useRef(50);

    const brushColorRef =
        useRef(
            '#0F172A'
        );

    const brushWidthRef =
        useRef(8);

    const spacePressedRef =
        useRef(false);

    const panStateRef =
        useRef<{
            active: boolean;
            startX: number;
            startY: number;
            scrollLeft: number;
            scrollTop: number;
        }>({
            active: false,
            startX: 0,
            startY: 0,
            scrollLeft: 0,
            scrollTop: 0
        });

    const [
        ready,
        setReady
    ] = useState(false);

    const [
        canvasReady,
        setCanvasReady
    ] = useState(false);

    const [
        busy,
        setBusyState
    ] = useState(false);

    const [
        structureBusy,
        setStructureBusy
    ] = useState(false);

    const [
        statusMessage,
        setStatusMessage
    ] = useState(
        'Os projetos ficam guardados apenas neste dispositivo.'
    );

    const [
        saveState,
        setSaveState
    ] = useState<
        MAQuadroEditor['saveState']
    >('ready');

    const [
        project,
        setProject
    ] = useState<
        MAQuadroProject | null
    >(null);

    const [
        projects,
        setProjects
    ] = useState<
        MAQuadroProject[]
    >([]);

    const [
        activePage,
        setActivePageState
    ] = useState<
        MAQuadroPage | null
    >(null);

    const [
        brand,
        setBrand
    ] = useState<
        MAQuadroBrand
    >(fallbackBrand);

    const [
        localFonts,
        setLocalFonts
    ] = useState<
        MAQuadroStoredFont[]
    >([]);

    const [
        layers,
        setLayers
    ] = useState<
        MAQuadroLayerItem[]
    >([]);

    const [
        selection,
        setSelection
    ] = useState<
        MAQuadroSelectionState
    >(emptySelection);

    const [
        activePanel,
        setActivePanel
    ] = useState<
        MAQuadroPanelId
    >('templates');

    const [
        zoom,
        setZoomState
    ] = useState(50);

    const [
        canUndo,
        setCanUndo
    ] = useState(false);

    const [
        canRedo,
        setCanRedo
    ] = useState(false);

    const [
        drawingMode,
        setDrawingModeState
    ] = useState(false);

    const [
        brushColor,
        setBrushColorState
    ] = useState(
        '#0F172A'
    );

    const [
        brushWidth,
        setBrushWidthState
    ] = useState(8);

    const [
        showGrid,
        setShowGrid
    ] = useState(false);

    const [
        showSafeArea,
        setShowSafeArea
    ] = useState(false);

    const [
        guides,
        setGuides
    ] = useState(
        emptyMAQuadroGuides()
    );

    const [
        isSpacePressed,
        setIsSpacePressed
    ] = useState(false);

    const [
        imageCropEditing,
        setImageCropEditing
    ] = useState(false);

    const [
        exportOpen,
        setExportOpen
    ] = useState(false);

    const [
        newDesignOpen,
        setNewDesignOpen
    ] = useState(false);

    const [
        exportOptions,
        setExportOptionsState
    ] = useState<
        MAQuadroExportOptions
    >(
        defaultExportOptions
    );

    const setBusy =
        useCallback(
            (
                active: boolean
            ) => {
                busyCountRef.current =
                    active
                        ? busyCountRef
                            .current +
                            1
                        : Math.max(
                            0,
                            busyCountRef
                                .current -
                            1
                        );

                setBusyState(
                    busyCountRef.current >
                    0
                );
            },
            []
        );

    const interactionLocked =
        useCallback(() => {
            return (
                uploadLockRef.current ||
                structuralLockRef.current ||
                busyCountRef.current > 0 ||
                imageCropEditingRef.current
            );
        }, []);

    const runStructuralOperation =
        useCallback(
            async <T,>(
                operation:
                    () => Promise<T>
            ): Promise<
                T | undefined
            > => {
                if (
                    structuralLockRef
                        .current ||
                    uploadLockRef.current ||
                    busyCountRef.current >
                    0 ||
                    imageCropEditingRef
                        .current
                ) {
                    setStatusMessage(
                        imageCropEditingRef
                            .current
                            ? 'Conclua ou cancele o recorte antes de mudar a estrutura do projeto.'
                            : 'Aguarde pela conclusão da operação atual.'
                    );

                    return undefined;
                }

                structuralLockRef
                    .current =
                    true;

                setStructureBusy(
                    true
                );

                try {
                    return await operation();
                } finally {
                    structuralLockRef
                        .current =
                        false;

                    setStructureBusy(
                        false
                    );
                }
            },
            []
        );

    useEffect(() => {
        saveStateRef.current =
            saveState;
    }, [
        saveState
    ]);

    const availableFonts =
        useMemo(() => {
            const map =
                new Map<
                    string,
                    {
                        name: string;
                        family: string;
                        fallback?: string;
                    }
                >();

            for (
                const font
                of brand.fonts
            ) {
                map.set(
                    font.family,
                    font
                );
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
                );
            }

            return Array.from(
                map.values()
            );
        }, [
            brand.fonts,
            localFonts
        ]);

    const refreshProjectLibrary =
        useCallback(
            async () => {
                setProjects(
                    await listMAQuadroProjects()
                );
            },
            []
        );

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
                    | undefined;
            },
            []
        );

    const syncLayers =
        useCallback(() => {
            const canvas =
                canvasRef.current;

            if (!canvas) {
                setLayers([]);
                return;
            }

            const activeObjects =
                new Set(
                    canvas
                        .getActiveObjects()
                );

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
                                    MAQuadroFabricObject;

                            editorObject.maId ||=
                                createMAQuadroId(
                                    'object'
                                );

                            return {
                                id:
                                    editorObject
                                        .maId,

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
                                    activeObjects
                                        .has(
                                            editorObject
                                        )
                            };
                        }
                    )
                    .reverse();

            setLayers(
                next
            );
        }, []);

    const syncSelection =
        useCallback(() => {
            const canvas =
                canvasRef.current;

            const active =
                canvas
                    ?.getActiveObject() as
                    | MAQuadroFabricObject
                    | undefined;

            const activeObjects =
                canvas
                    ?.getActiveObjects() ||
                [];

            if (
                !active ||
                activeObjects.length ===
                0
            ) {
                setSelection(
                    emptySelection
                );

                syncLayers();
                return;
            }

            const geometry =
                getMAQuadroObjectGeometry(
                    active
                );

            const gradient =
                getMAQuadroObjectGradient(
                    active
                );

            const shadow =
                active.shadow instanceof
                Shadow
                    ? active.shadow
                    : null;

            const single =
                activeObjects.length ===
                1;

            const image =
                single &&
                active instanceof
                FabricImage
                    ? active as
                        FabricImage &
                        MAQuadroFabricObject
                    : null;

            const text =
                single &&
                active instanceof
                Textbox
                    ? active as
                        Textbox &
                        MAQuadroFabricObject
                    : null;

            const crop =
                image
                    ? getMAQuadroImageCropPercentages(
                        image
                    )
                    : {
                        horizontal: 0,
                        vertical: 0
                    };

            const viewport =
                image
                    ? getMAQuadroCropViewportState(
                        image
                    )
                    : {
                        zoom: 100,
                        positionX: 50,
                        positionY: 50
                    };

            const actualGroup =
                single &&
                active instanceof
                Group &&
                !(
                    active instanceof
                    ActiveSelection
                );

            setSelection({
                count:
                    activeObjects.length,

                role:
                    activeObjects.length >
                    1
                        ? null
                        : actualGroup
                            ? 'group'
                            : getMAQuadroObjectRole(
                                active
                            ),

                shapeKind:
                    single
                        ? getMAQuadroShapeKind(
                            active
                        )
                        : null,

                name:
                    activeObjects.length >
                    1
                        ? `${activeObjects.length} elementos selecionados`
                        : active.maName ||
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
                width:
                    geometry.width,
                height:
                    geometry.height,
                angle:
                    geometry.angle,

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
                    active.maShapeKind ===
                    'rectangle'
                        ? Number(
                            active.rx ||
                            0
                        )
                        : 0,

                shadowEnabled:
                    Boolean(
                        shadow
                    ),

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
                    Boolean(
                        gradient
                    ),

                gradientFrom:
                    gradient?.from ||
                    '#22D3EE',

                gradientTo:
                    gradient?.to ||
                    '#8B5CF6',

                gradientAngle:
                    gradient?.angle ??
                    45,

                imageFilters:
                    image
                        ? getMAQuadroImageFilters(
                            image
                        )
                        : DEFAULT_IMAGE_FILTERS,

                cropHorizontal:
                    crop.horizontal,

                cropVertical:
                    crop.vertical,

                cropZoom:
                    viewport.zoom,

                cropPositionX:
                    viewport.positionX,

                cropPositionY:
                    viewport.positionY,

                imageFrame:
                    image
                        ? getMAQuadroImageFrameKind(
                            image
                        )
                        : 'none'
            });

            syncLayers();
        }, [
            syncLayers
        ]);

    const historySnapshot =
        useCallback(() => {
            const canvas =
                canvasRef.current;

            const currentProject =
                projectRef.current;

            if (
                !canvas ||
                !currentProject
            ) {
                return null;
            }

            const page =
                getActiveProjectPage(
                    currentProject
                );

            return JSON.stringify({
                pageId:
                    page.id,

                background:
                    page.background,

                canvasJson:
                    serializeMAQuadroCanvas(
                        canvas
                    )
            });
        }, []);

    const updateHistoryButtons =
        useCallback(() => {
            const pageId =
                projectRef.current
                    ?.activePageId;

            const history =
                pageId
                    ? historiesRef
                        .current
                        .get(pageId)
                    : undefined;

            setCanUndo(
                Boolean(
                    history &&
                    history.index > 0
                )
            );

            setCanRedo(
                Boolean(
                    history &&
                    history.index <
                    history.entries
                        .length -
                    1
                )
            );
        }, []);

    const resetHistory =
        useCallback(
            (
                pageId =
                    projectRef.current
                        ?.activePageId
            ) => {
                const snapshot =
                    historySnapshot();

                if (
                    !pageId ||
                    !snapshot
                ) {
                    return;
                }

                historiesRef.current
                    .set(
                        pageId,
                        {
                            entries: [
                                snapshot
                            ],
                            index: 0
                        }
                    );

                updateHistoryButtons();
            },
            [
                historySnapshot,
                updateHistoryButtons
            ]
        );

    const pushHistory =
        useCallback(() => {
            if (
                isLoadingRef.current ||
                isApplyingHistoryRef
                    .current ||
                imageCropEditingRef
                    .current
            ) {
                return false;
            }

            const pageId =
                projectRef.current
                    ?.activePageId;

            const snapshot =
                historySnapshot();

            if (
                !pageId ||
                !snapshot
            ) {
                return false;
            }

            const current =
                historiesRef.current
                    .get(pageId) || {
                    entries: [],
                    index: -1
                };

            const activeSnapshot =
                current.entries[
                    current.index
                ];

            if (
                activeSnapshot ===
                snapshot
            ) {
                updateHistoryButtons();
                return false;
            }

            let entries =
                current.entries
                    .slice(
                        0,
                        current.index +
                        1
                    )
                    .concat(
                        snapshot
                    )
                    .slice(
                        -MAX_HISTORY_ENTRIES
                    );

            let totalCharacters =
                entries.reduce(
                    (
                        total,
                        entry
                    ) =>
                        total +
                        entry.length,
                    0
                );

            while (
                entries.length > 1 &&
                totalCharacters >
                MAX_HISTORY_CHARACTERS
            ) {
                const removed =
                    entries.shift();

                totalCharacters -=
                    removed?.length ||
                    0;
            }

            historiesRef.current
                .set(
                    pageId,
                    {
                        entries,
                        index:
                            entries.length -
                            1
                    }
                );

            updateHistoryButtons();

            return true;
        }, [
            historySnapshot,
            updateHistoryButtons
        ]);

    const markDirty =
        useCallback(
            (
                message: string
            ) => {
                if (
                    isLoadingRef.current ||
                    isApplyingHistoryRef
                        .current ||
                    imageCropEditingRef
                        .current
                ) {
                    return;
                }

                saveStateRef.current =
                    'dirty';

                setSaveState(
                    'dirty'
                );

                setStatusMessage(
                    message
                );

                if (
                    autosaveTimerRef
                        .current !==
                    null
                ) {
                    window.clearTimeout(
                        autosaveTimerRef
                            .current
                    );
                }

                const scheduledProjectId =
                    projectRef.current
                        ?.id;

                autosaveTimerRef.current =
                    window.setTimeout(
                        () => {
                            autosaveTimerRef
                                .current =
                                null;

                            if (
                                !scheduledProjectId ||
                                projectRef.current
                                    ?.id !==
                                scheduledProjectId
                            ) {
                                return;
                            }

                            void saveHandlerRef
                                .current(
                                    true
                                );
                        },
                        1100
                    );
            },
            []
        );

    const commitChange =
        useCallback(
            (
                message: string
            ) => {
                syncSelection();

                if (!pushHistory()) {
                    return false;
                }

                markDirty(
                    message
                );

                return true;
            },
            [
                markDirty,
                pushHistory,
                syncSelection
            ]
        );

    const setZoom =
        useCallback(
            (
                value: number
            ) => {
                const canvas =
                    canvasRef.current;

                if (!canvas) {
                    return;
                }

                const safe =
                    Math.min(
                        220,
                        Math.max(
                            5,
                            Math.round(
                                value
                            )
                        )
                    );

                zoomRef.current =
                    safe;

                setZoomState(
                    safe
                );

                canvas.setDimensions(
                    {
                        width:
                            `${Math.round(
                                canvas.getWidth() *
                                safe /
                                100
                            )}px`,

                        height:
                            `${Math.round(
                                canvas.getHeight() *
                                safe /
                                100
                            )}px`
                    },
                    {
                        cssOnly: true
                    }
                );

                canvas.calcOffset();
            },
            []
        );

    const fitCanvas =
        useCallback(() => {
            const canvas =
                canvasRef.current;

            const workspace =
                workspaceRef.current;

            if (
                !canvas ||
                !workspace
            ) {
                return;
            }

            const availableWidth =
                Math.max(
                    280,
                    workspace.clientWidth -
                    72
                );

            const availableHeight =
                Math.max(
                    320,
                    Math.min(
                        window.innerHeight -
                        250,
                        900
                    )
                );

            const scale =
                Math.min(
                    availableWidth /
                    canvas.getWidth(),

                    availableHeight /
                    canvas.getHeight(),

                    1
                );

            setZoom(
                Math.max(
                    5,
                    Math.round(
                        scale *
                        100
                    )
                )
            );
        }, [
            setZoom
        ]);

    const captureCurrentPage =
        useCallback(
            (
                sourceProject =
                    projectRef.current
            ) => {
                const canvas =
                    canvasRef.current;

                if (
                    !canvas ||
                    !sourceProject
                ) {
                    return sourceProject;
                }

                const currentPage =
                    getActiveProjectPage(
                        sourceProject
                    );

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
                    );

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
                    };

                const next =
                    replaceProjectPage(
                        sourceProject,
                        updatedPage
                    );

                projectRef.current =
                    next;

                setProject(
                    next
                );

                setActivePageState(
                    updatedPage
                );

                return next;
            },
            []
        );

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
                    canvasRef.current;

                const page =
                    nextProject.pages
                        .find(
                            (item) =>
                                item.id ===
                                pageId
                        );

                if (
                    !canvas ||
                    !page
                ) {
                    throw new Error(
                        'A página pedida não existe ou o quadro ainda não está disponível.'
                    );
                }

                const previousProject =
                    projectRef.current;

                const previousPage =
                    previousProject
                        ? getActiveProjectPage(
                            previousProject
                        )
                        : null;

                const previousCanvasJson =
                    previousProject
                        ? serializeMAQuadroCanvas(
                            canvas
                        )
                        : null;

                const previousWidth =
                    canvas.getWidth();

                const previousHeight =
                    canvas.getHeight();

                isLoadingRef.current =
                    true;

                setBusy(
                    true
                );

                try {
                    canvas
                        .discardActiveObject();

                    canvas.clear();

                    canvas.setDimensions({
                        width:
                            page.width,
                        height:
                            page.height
                    });

                    await loadMAQuadroCanvasJson(
                        canvas,
                        page.canvasJson
                    );

                    applyMAQuadroPageBackground(
                        canvas,
                        page
                    );

                    canvas.requestRenderAll();

                    const withActivePage = {
                        ...nextProject,
                        activePageId:
                            page.id
                    };

                    projectRef.current =
                        withActivePage;

                    setProject(
                        withActivePage
                    );

                    setActivePageState(
                        page
                    );

                    setDrawingModeState(
                        false
                    );

                    canvas.isDrawingMode =
                        false;

                    imageCropEditingRef
                        .current =
                        false;

                    cropSessionRef.current =
                        null;

                    setImageCropEditing(
                        false
                    );

                    setGuides(
                        emptyMAQuadroGuides()
                    );

                    setSelection(
                        emptySelection
                    );

                    syncLayers();

                    window
                        .requestAnimationFrame(
                            fitCanvas
                        );

                    if (
                        resetPageHistory ||
                        !historiesRef.current
                            .has(page.id)
                    ) {
                        resetHistory(
                            page.id
                        );
                    } else {
                        updateHistoryButtons();
                    }
                } catch (error) {
                    if (
                        previousProject &&
                        previousPage &&
                        previousCanvasJson
                    ) {
                        try {
                            canvas.clear();

                            canvas.setDimensions({
                                width:
                                    previousWidth,
                                height:
                                    previousHeight
                            });

                            await loadMAQuadroCanvasJson(
                                canvas,
                                previousCanvasJson
                            );

                            applyMAQuadroPageBackground(
                                canvas,
                                {
                                    ...previousPage,
                                    width:
                                        previousWidth,
                                    height:
                                        previousHeight
                                }
                            );

                            projectRef.current =
                                previousProject;

                            setProject(
                                previousProject
                            );

                            setActivePageState(
                                previousPage
                            );

                            syncLayers();
                            syncSelection();

                            canvas.requestRenderAll();
                        } catch (
                            rollbackError
                        ) {
                            console.error(
                                'Não foi possível repor a página anterior.',
                                rollbackError
                            );
                        }
                    }

                    throw error;
                } finally {
                    isLoadingRef.current =
                        false;

                    setBusy(
                        false
                    );
                }
            },
            [
                fitCanvas,
                resetHistory,
                setBusy,
                syncLayers,
                syncSelection,
                updateHistoryButtons
            ]
        );

    const saveProject =
        useCallback(
            async (
                quiet = false
            ): Promise<boolean> => {
                if (
                    imageCropEditingRef
                        .current
                ) {
                    if (!quiet) {
                        setStatusMessage(
                            'Conclua ou cancele o recorte antes de guardar.'
                        );
                    }

                    return false;
                }

                if (
                    uploadLockRef.current
                ) {
                    if (!quiet) {
                        setStatusMessage(
                            'Aguarde pelo fim do carregamento das imagens antes de guardar.'
                        );
                    }

                    return false;
                }

                if (
                    autosaveTimerRef
                        .current !==
                    null
                ) {
                    window.clearTimeout(
                        autosaveTimerRef
                            .current
                    );

                    autosaveTimerRef.current =
                        null;
                }

                setBusy(
                    true
                );

                saveStateRef.current =
                    'saving';

                setSaveState(
                    'saving'
                );

                try {
                    let current =
                        captureCurrentPage();

                    if (!current) {
                        throw new Error(
                            'O quadro atual não está disponível para gravação.'
                        );
                    }

                    if (
                        current.isTemplate
                    ) {
                        current =
                            duplicateProject(
                                current,
                                `${current.name} — cópia`
                            );

                        const source =
                            projectRef.current;

                        const activeIndex =
                            Math.max(
                                0,
                                source
                                    ?.pages
                                    .findIndex(
                                        (page) =>
                                            page.id ===
                                            source
                                                .activePageId
                                    ) ??
                                0
                            );

                        current.activePageId =
                            current.pages[
                                activeIndex
                            ]?.id ||
                            current.pages[0]
                                .id;
                    }

                    const saved:
                        MAQuadroProject = {
                            ...current,
                            isTemplate: false,
                            updatedAt:
                                new Date()
                                    .toISOString()
                        };

                    await saveMAQuadroProject(
                        saved
                    );

                    projectRef.current =
                        saved;

                    setProject(
                        saved
                    );

                    setActivePageState(
                        getActiveProjectPage(
                            saved
                        )
                    );

                    await refreshProjectLibrary();

                    saveStateRef.current =
                        'saved';

                    setSaveState(
                        'saved'
                    );

                    if (!quiet) {
                        setStatusMessage(
                            `“${saved.name}” guardado neste dispositivo.`
                        );
                    }

                    return true;
                } catch (error) {
                    console.error(
                        error
                    );

                    saveStateRef.current =
                        'error';

                    setSaveState(
                        'error'
                    );

                    setStatusMessage(
                        'Não foi possível guardar o projeto localmente. A navegação foi interrompida para proteger o trabalho atual.'
                    );

                    return false;
                } finally {
                    setBusy(
                        false
                    );
                }
            },
            [
                captureCurrentPage,
                refreshProjectLibrary,
                setBusy
            ]
        );

    useEffect(() => {
        saveHandlerRef.current =
            saveProject;
    }, [
        saveProject
    ]);

    useEffect(() => {
        const handleBeforeUnload = (
            event:
                BeforeUnloadEvent
        ) => {
            if (
                saveStateRef.current !==
                'dirty' &&
                saveStateRef.current !==
                'saving' &&
                !imageCropEditingRef
                    .current
            ) {
                return;
            }

            event.preventDefault();
            event.returnValue =
                '';
        };

        const handleVisibilityChange =
            () => {
                if (
                    document
                        .visibilityState ===
                    'hidden' &&
                    saveStateRef.current ===
                    'dirty' &&
                    !imageCropEditingRef
                        .current
                ) {
                    void saveHandlerRef
                        .current(
                            true
                        );
                }
            };

        window.addEventListener(
            'beforeunload',
            handleBeforeUnload
        );

        document.addEventListener(
            'visibilitychange',
            handleVisibilityChange
        );

        return () => {
            window.removeEventListener(
                'beforeunload',
                handleBeforeUnload
            );

            document.removeEventListener(
                'visibilitychange',
                handleVisibilityChange
            );
        };
    }, []);

    useEffect(() => {
        const element =
            canvasElementRef.current;

        if (!element) {
            return;
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
            );

        canvasRef.current =
            canvas;

        configureMAQuadroBrush(
            canvas,
            brushColorRef.current,
            brushWidthRef.current
        );

        const selectionChanged =
            () => {
                const session =
                    cropSessionRef.current;

                if (
                    imageCropEditingRef
                        .current &&
                    session
                ) {
                    const cropImage =
                        canvas
                            .getObjects()
                            .find(
                                (object) =>
                                    (
                                        object as
                                            MAQuadroFabricObject
                                    ).maId ===
                                    session
                                        .objectId
                            );

                    if (
                        cropImage &&
                        canvas
                            .getActiveObject() !==
                        cropImage
                    ) {
                        canvas
                            .setActiveObject(
                                cropImage
                            );

                        canvas
                            .requestRenderAll();
                    }
                }

                syncSelection();
            };

        const objectChanged =
            () => {
                if (
                    isLoadingRef.current ||
                    isApplyingHistoryRef
                        .current ||
                    imageCropEditingRef
                        .current
                ) {
                    return;
                }

                commitChange(
                    'Alterações por guardar.'
                );
            };

        const objectAdded = (
            event: {
                target?: unknown;
            }
        ) => {
            const target =
                event.target as
                    | MAQuadroFabricObject
                    | undefined;

            if (
                canvas.isDrawingMode &&
                target
            ) {
                drawingPathRef.current =
                    target;

                return;
            }

            objectChanged();
        };

        canvas.on(
            'selection:created',
            selectionChanged
        );

        canvas.on(
            'selection:updated',
            selectionChanged
        );

        canvas.on(
            'selection:cleared',
            selectionChanged
        );

        canvas.on(
            'object:added',
            objectAdded
        );

        canvas.on(
            'object:removed',
            objectChanged
        );

        canvas.on(
            'object:modified',
            objectChanged
        );

        canvas.on(
            'text:changed',
            objectChanged
        );

        canvas.on(
            'path:created',
            (event) => {
                const path =
                    (
                        event as
                            unknown as {
                                path?:
                                    MAQuadroFabricObject;
                            }
                    ).path ||
                    drawingPathRef.current;

                drawingPathRef.current =
                    null;

                if (path) {
                    prepareMAQuadroObject(
                        path,
                        'drawing',
                        'Desenho livre'
                    );

                    objectChanged();
                }
            }
        );

        canvas.on(
            'object:moving',
            (event) => {
                const target =
                    event.target as
                        | MAQuadroFabricObject
                        | undefined;

                if (
                    !target ||
                    target.maLocked
                ) {
                    return;
                }

                const cropSession =
                    cropSessionRef
                        .current;

                if (
                    imageCropEditingRef
                        .current &&
                    cropSession &&
                    target instanceof
                    FabricImage &&
                    (target as FabricImage & MAQuadroFabricObject).maId ===
                    cropSession.objectId
                ) {
                    const worldX =
                        Number(
                            target.left ||
                            0
                        ) -
                        cropSession.left;

                    const worldY =
                        Number(
                            target.top ||
                            0
                        ) -
                        cropSession.top;

                    const radians =
                        cropSession.angle *
                        Math.PI /
                        180;

                    const localX =
                        Math.cos(
                            radians
                        ) *
                        worldX +
                        Math.sin(
                            radians
                        ) *
                        worldY;

                    const localY =
                        -Math.sin(
                            radians
                        ) *
                        worldX +
                        Math.cos(
                            radians
                        ) *
                        worldY;

                    const scaleX =
                        Math.max(
                            0.0001,
                            Math.abs(
                                Number(
                                    target
                                        .scaleX ||
                                    1
                                )
                            )
                        );

                    const scaleY =
                        Math.max(
                            0.0001,
                            Math.abs(
                                Number(
                                    target
                                        .scaleY ||
                                    1
                                )
                            )
                        );

                   const sourceHeight =
    Math.max(
        1,
        Number(
            (
                target as
                    FabricImage &
                    MAQuadroFabricObject
            ).maOriginalHeight ||
            target.height ||
            1
        )
    );

                    const sourceHeight =
                        Math.max(
                            1,
                            Number(
                               (target as FabricImage & MAQuadroFabricObject).maOriginalHeight ||
                                target.height ||
                                1
                            )
                        );

                    const maximumX =
                        Math.max(
                            0,
                            sourceWidth -
                            Number(
                                target.width ||
                                1
                            )
                        );

                    const maximumY =
                        Math.max(
                            0,
                            sourceHeight -
                            Number(
                                target.height ||
                                1
                            )
                        );

                    const directionX =
                        target.flipX
                            ? -1
                            : 1;

                    const directionY =
                        target.flipY
                            ? -1
                            : 1;

                    target.set({
                        cropX:
                            clamp(
                                cropSession
                                    .startCropX -
                                localX *
                                directionX /
                                scaleX,
                                0,
                                maximumX
                            ),

                        cropY:
                            clamp(
                                cropSession
                                    .startCropY -
                                localY *
                                directionY /
                                scaleY,
                                0,
                                maximumY
                            ),

                        left:
                            cropSession.left,

                        top:
                            cropSession.top
                    });

                    target.setCoords();

                    canvas
                        .requestRenderAll();

                    setGuides(
                        emptyMAQuadroGuides()
                    );

                    return;
                }

                if (
                    imageCropEditingRef
                        .current
                ) {
                    return;
                }

                const threshold =
                    Math.max(
                        4,
                        12 /
                        Math.max(
                            zoomRef.current /
                            100,
                            0.05
                        )
                    );

                setGuides(
                    snapMAQuadroObject(
                        canvas,
                        target,
                        threshold
                    )
                );
            }
        );

        canvas.on(
            'mouse:up',
            () => {
                setGuides(
                    emptyMAQuadroGuides()
                );

                const session =
                    cropSessionRef.current;

                if (
                    imageCropEditingRef
                        .current &&
                    session
                ) {
                    const active =
                        canvas
                            .getActiveObject();

                    if (
                        active instanceof
                        FabricImage &&
                        (
                            active as
                                FabricImage &
                                MAQuadroFabricObject
                        ).maId ===
                        session.objectId
                    ) {
                        session.startCropX =
                            Number(
                                active.cropX ||
                                0
                            );

                        session.startCropY =
                            Number(
                                active.cropY ||
                                0
                            );

                        active.set({
                            left:
                                session.left,
                            top:
                                session.top
                        });

                        active.setCoords();

                        canvas
                            .requestRenderAll();

                        syncSelection();
                    }
                }
            }
        );

        setCanvasReady(
            true
        );

        return () => {
            if (
                autosaveTimerRef
                    .current !==
                null
            ) {
                window.clearTimeout(
                    autosaveTimerRef
                        .current
                );
            }

            uploadLockRef.current =
                false;

            structuralLockRef.current =
                false;

            imageCropEditingRef
                .current =
                false;

            cropSessionRef.current =
                null;

            setCanvasReady(
                false
            );

            canvasRef.current =
                null;

            void canvas.dispose();
        };
    }, [
        commitChange,
        syncSelection
    ]);

    useEffect(() => {
        if (
            !canvasReady ||
            initializedRef.current
        ) {
            return;
        }

        initializedRef.current =
            true;

        async function initialize() {
            setBusy(
                true
            );

            try {
                try {
                    const response =
                        await fetch(
                            '/ma-quadro/brand.json',
                            {
                                cache:
                                    'no-store'
                            }
                        );

                    if (
                        response.ok
                    ) {
                        setBrand(
                            (
                                await response
                                    .json()
                            ) as
                                MAQuadroBrand
                        );
                    }
                } catch (error) {
                    console.error(
                        error
                    );
                }

                await seedMAQuadroTemplates();

                const fonts =
                    await listMAQuadroFonts();

                for (
                    const font
                    of fonts
                ) {
                    try {
                        await registerLocalFont(
                            font
                        );
                    } catch (error) {
                        console.error(
                            error
                        );
                    }
                }

                setLocalFonts(
                    fonts
                );

                let storedProjects =
                    await listMAQuadroProjects();

                let initialProject =
                    storedProjects.find(
                        (record) =>
                            !record.isTemplate
                    );

                if (!initialProject) {
                    initialProject =
                        createBlankProject(
                            1080,
                            1080,
                            'O meu primeiro design',
                            'social'
                        );

                    await saveMAQuadroProject(
                        initialProject
                    );

                    storedProjects =
                        await listMAQuadroProjects();
                }

                setProjects(
                    storedProjects
                );

                await loadPage(
                    initialProject,
                    initialProject
                        .activePageId,
                    true
                );

                saveStateRef.current =
                    'saved';

                setStatusMessage(
                    'Projeto aberto. A gravação automática está ativa.'
                );

                setSaveState(
                    'saved'
                );
            } catch (error) {
                console.error(
                    error
                );

                const fallback =
                    createBlankProject(
                        1080,
                        1080,
                        'Design sem título',
                        'social'
                    );

                try {
                    await loadPage(
                        fallback,
                        fallback
                            .activePageId,
                        true
                    );
                } catch (
                    fallbackError
                ) {
                    console.error(
                        fallbackError
                    );

                    projectRef.current =
                        fallback;

                    setProject(
                        fallback
                    );

                    setActivePageState(
                        fallback.pages[0]
                    );
                }

                saveStateRef.current =
                    'error';

                setSaveState(
                    'error'
                );

                setStatusMessage(
                    'O armazenamento local está indisponível. Pode editar e exportar, mas o browser poderá não guardar o trabalho.'
                );
            } finally {
                setReady(
                    true
                );

                setBusy(
                    false
                );
            }
        }

        void initialize();
    }, [
        canvasReady,
        loadPage,
        setBusy
    ]);

    useEffect(() => {
        const handleResize =
            () =>
                fitCanvas();

        window.addEventListener(
            'resize',
            handleResize
        );

        return () => {
            window.removeEventListener(
                'resize',
                handleResize
            );
        };
    }, [
        fitCanvas
    ]);

    const setProjectName =
        useCallback(
            (
                name: string
            ) => {
                const current =
                    projectRef.current;

                const nextName =
                    name.trim();

                if (
                    !current ||
                    !nextName ||
                    current.name ===
                    nextName ||
                    imageCropEditingRef
                        .current
                ) {
                    return;
                }

                const next = {
                    ...current,
                    name:
                        nextName
                };

                projectRef.current =
                    next;

                setProject(
                    next
                );

                markDirty(
                    'Nome do projeto atualizado.'
                );
            },
            [
                markDirty
            ]
        );

    const openProject =
        useCallback(
            async (
                projectId: string
            ) => {
                await runStructuralOperation(
                    async () => {
                        const target =
                            projects.find(
                                (item) =>
                                    item.id ===
                                    projectId
                            );

                        if (!target) {
                            return;
                        }

                        if (
                            projectRef.current &&
                            !projectRef.current
                                .isTemplate
                        ) {
                            const saved =
                                await saveProject(
                                    true
                                );

                            if (!saved) {
                                return;
                            }
                        }

                        const projectToOpen =
                            target.isTemplate
                                ? duplicateProject(
                                    target,
                                    `${target.name} — cópia`
                                )
                                : target;

                        if (
                            target.isTemplate
                        ) {
                            await saveMAQuadroProject(
                                projectToOpen
                            );

                            await refreshProjectLibrary();
                        }

                        await loadPage(
                            projectToOpen,
                            projectToOpen
                                .activePageId,
                            true
                        );

                        setActivePanel(
                            'elements'
                        );

                        saveStateRef.current =
                            'saved';

                        setSaveState(
                            'saved'
                        );

                        setStatusMessage(
                            target.isTemplate
                                ? `Cópia criada a partir de “${target.name}”. O modelo original foi preservado.`
                                : `“${target.name}” aberto.`
                        );
                    }
                );
            },
            [
                loadPage,
                projects,
                refreshProjectLibrary,
                runStructuralOperation,
                saveProject
            ]
        );

    const duplicateProjectAction =
        useCallback(
            async (
                projectId: string
            ) => {
                await runStructuralOperation(
                    async () => {
                        const source =
                            projects.find(
                                (item) =>
                                    item.id ===
                                    projectId
                            );

                        if (!source) {
                            return;
                        }

                        setBusy(
                            true
                        );

                        try {
                            const copy =
                                duplicateProject(
                                    source
                                );

                            await saveMAQuadroProject(
                                copy
                            );

                            await refreshProjectLibrary();

                            await loadPage(
                                copy,
                                copy.activePageId,
                                true
                            );

                            setActivePanel(
                                'elements'
                            );

                            saveStateRef.current =
                                'saved';

                            setSaveState(
                                'saved'
                            );

                            setStatusMessage(
                                'Cópia criada. O projeto original foi preservado.'
                            );
                        } catch (error) {
                            console.error(
                                error
                            );

                            setStatusMessage(
                                'Não foi possível duplicar o projeto.'
                            );
                        } finally {
                            setBusy(
                                false
                            );
                        }
                    }
                );
            },
            [
                loadPage,
                projects,
                refreshProjectLibrary,
                runStructuralOperation,
                setBusy
            ]
        );

    const deleteProjectAction =
        useCallback(
            async (
                projectId: string
            ) => {
                await runStructuralOperation(
                    async () => {
                        const source =
                            projects.find(
                                (item) =>
                                    item.id ===
                                    projectId
                            );

                        if (!source) {
                            return;
                        }

                        if (
                            source.isTemplate &&
                            source.id
                                .startsWith(
                                    'template-'
                                )
                        ) {
                            setStatusMessage(
                                'Os modelos de origem permanecem sempre disponíveis.'
                            );

                            return;
                        }

                        if (
                            !window.confirm(
                                source.isTemplate
                                    ? `Eliminar o modelo pessoal “${source.name}” deste dispositivo?`
                                    : `Eliminar “${source.name}” deste dispositivo?`
                            )
                        ) {
                            return;
                        }

                        setBusy(
                            true
                        );

                        try {
                            await deleteMAQuadroProject(
                                projectId
                            );

                            let remaining =
                                await listMAQuadroProjects();

                            if (
                                projectRef.current
                                    ?.id ===
                                projectId
                            ) {
                                let next =
                                    remaining.find(
                                        (item) =>
                                            !item.isTemplate
                                    );

                                if (!next) {
                                    next =
                                        createBlankProject(
                                            1080,
                                            1080,
                                            'Novo design',
                                            'social'
                                        );

                                    await saveMAQuadroProject(
                                        next
                                    );

                                    remaining =
                                        await listMAQuadroProjects();
                                }

                                await loadPage(
                                    next,
                                    next.activePageId,
                                    true
                                );
                            }

                            setProjects(
                                remaining
                            );

                            setStatusMessage(
                                source.isTemplate
                                    ? 'Modelo pessoal eliminado deste dispositivo.'
                                    : 'Projeto eliminado deste dispositivo.'
                            );
                        } catch (error) {
                            console.error(
                                error
                            );

                            setStatusMessage(
                                source.isTemplate
                                    ? 'Não foi possível eliminar o modelo pessoal.'
                                    : 'Não foi possível eliminar o projeto.'
                            );
                        } finally {
                            setBusy(
                                false
                            );
                        }
                    }
                );
            },
            [
                loadPage,
                projects,
                runStructuralOperation,
                setBusy
            ]
        );

    const saveProjectAsTemplate =
        useCallback(
            async () => {
                await runStructuralOperation(
                    async () => {
                        const current =
                            captureCurrentPage();

                        if (!current) {
                            return;
                        }

                        setBusy(
                            true
                        );

                        try {
                            const template =
                                duplicateProject(
                                    current,
                                    `${current.name} — modelo`
                                );

                            template.isTemplate =
                                true;

                            await saveMAQuadroProject(
                                template
                            );

                            await refreshProjectLibrary();

                            setStatusMessage(
                                'Modelo pessoal guardado. Pode duplicá-lo sempre que precisar.'
                            );
                        } catch (error) {
                            console.error(
                                error
                            );

                            setStatusMessage(
                                'Não foi possível guardar o modelo.'
                            );
                        } finally {
                            setBusy(
                                false
                            );
                        }
                    }
                );
            },
            [
                captureCurrentPage,
                refreshProjectLibrary,
                runStructuralOperation,
                setBusy
            ]
        );

    const createFromPreset =
        useCallback(
            async (
                preset:
                    MAQuadroCanvasPreset
            ) => {
                await runStructuralOperation(
                    async () => {
                        if (
                            projectRef.current &&
                            !projectRef.current
                                .isTemplate
                        ) {
                            const saved =
                                await saveProject(
                                    true
                                );

                            if (!saved) {
                                return;
                            }
                        }

                        const created =
                            createBlankProject(
                                preset.width,
                                preset.height,
                                preset.name,
                                preset.category
                            );

                        await saveMAQuadroProject(
                            created
                        );

                        await refreshProjectLibrary();

                        await loadPage(
                            created,
                            created.activePageId,
                            true
                        );

                        setActivePanel(
                            'elements'
                        );

                        saveStateRef.current =
                            'saved';

                        setSaveState(
                            'saved'
                        );

                        setStatusMessage(
                            'Novo design criado.'
                        );
                    }
                );
            },
            [
                loadPage,
                refreshProjectLibrary,
                runStructuralOperation,
                saveProject
            ]
        );

    const createCustomDesign =
        useCallback(
            async (
                values:
                    MAQuadroNewDesignValues
            ) => {
                const width =
                    Math.round(
                        values.width
                    );

                const height =
                    Math.round(
                        values.height
                    );

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
                    );

                    return;
                }

                await runStructuralOperation(
                    async () => {
                        if (
                            projectRef.current &&
                            !projectRef.current
                                .isTemplate
                        ) {
                            const saved =
                                await saveProject(
                                    true
                                );

                            if (!saved) {
                                return;
                            }
                        }

                        const created =
                            createBlankProject(
                                width,
                                height,

                                values.name
                                    .trim() ||
                                `Design ${width} × ${height}`,

                                values.category
                            );

                        await saveMAQuadroProject(
                            created
                        );

                        await refreshProjectLibrary();

                        await loadPage(
                            created,
                            created.activePageId,
                            true
                        );

                        setNewDesignOpen(
                            false
                        );

                        setActivePanel(
                            'elements'
                        );

                        saveStateRef.current =
                            'saved';

                        setSaveState(
                            'saved'
                        );

                        setStatusMessage(
                            'Design personalizado criado.'
                        );
                    }
                );
            },
            [
                loadPage,
                refreshProjectLibrary,
                runStructuralOperation,
                saveProject
            ]
        );

    const importProject =
        useCallback(
            async (
                event:
                    ChangeEvent<HTMLInputElement>
            ) => {
                const file =
                    event.target
                        .files?.[0];

                event.target.value =
                    '';

                if (!file) {
                    return;
                }

                if (
                    file.size >
                    100_000_000
                ) {
                    setStatusMessage(
                        'O ficheiro é demasiado grande para ser importado com segurança.'
                    );

                    return;
                }

                await runStructuralOperation(
                    async () => {
                        setBusy(
                            true
                        );

                        try {
                            const parsed =
                                JSON.parse(
                                    await file.text()
                                ) as
                                    unknown;

                            const normalized =
                                normalizeImportedMAQuadroProject(
                                    parsed
                                );

                            if (!normalized) {
                                throw new Error(
                                    'Projeto inválido.'
                                );
                            }

                            if (
                                projectRef.current &&
                                !projectRef.current
                                    .isTemplate
                            ) {
                                const saved =
                                    await saveProject(
                                        true
                                    );

                                if (!saved) {
                                    return;
                                }
                            }

                            const imported = {
                                ...duplicateProject(
                                    normalized,
                                    normalized.name
                                ),
                                isTemplate:
                                    false
                            };

                            await saveMAQuadroProject(
                                imported
                            );

                            await refreshProjectLibrary();

                            await loadPage(
                                imported,
                                imported.activePageId,
                                true
                            );

                            setActivePanel(
                                'elements'
                            );

                            saveStateRef.current =
                                'saved';

                            setSaveState(
                                'saved'
                            );

                            setStatusMessage(
                                `“${imported.name}” importado e guardado neste dispositivo.`
                            );
                        } catch (error) {
                            console.error(
                                error
                            );

                            setStatusMessage(
                                'Este ficheiro não é um projeto MA-Quadro válido ou excede os limites de segurança.'
                            );
                        } finally {
                            setBusy(
                                false
                            );
                        }
                    }
                );
            },
            [
                loadPage,
                refreshProjectLibrary,
                runStructuralOperation,
                saveProject,
                setBusy
            ]
        );

    const ensureEditableProject =
        useCallback(
            (
                source:
                    MAQuadroProject
            ) => {
                if (!source.isTemplate) {
                    return source;
                }

                return duplicateProject(
                    source,
                    `${source.name} — cópia`
                );
            },
            []
        );

    const setActivePage =
        useCallback(
            async (
                pageId: string
            ) => {
                await runStructuralOperation(
                    async () => {
                        const captured =
                            captureCurrentPage();

                        if (
                            !captured ||
                            captured.activePageId ===
                            pageId
                        ) {
                            return;
                        }

                        let editable =
                            ensureEditableProject(
                                captured
                            );

                        let targetPageId =
                            pageId;

                        if (
                            captured.isTemplate
                        ) {
                            const pageIndex =
                                captured.pages
                                    .findIndex(
                                        (page) =>
                                            page.id ===
                                            pageId
                                    );

                            targetPageId =
                                editable.pages[
                                    Math.max(
                                        0,
                                        pageIndex
                                    )
                                ]?.id ||
                                editable.activePageId;
                        }

                        editable = {
                            ...editable,

                            activePageId:
                                targetPageId,

                            updatedAt:
                                new Date()
                                    .toISOString()
                        };

                        await saveMAQuadroProject(
                            editable
                        );

                        await refreshProjectLibrary();

                        await loadPage(
                            editable,
                            targetPageId
                        );

                        saveStateRef.current =
                            'saved';

                        setSaveState(
                            'saved'
                        );
                    }
                );
            },
            [
                captureCurrentPage,
                ensureEditableProject,
                loadPage,
                refreshProjectLibrary,
                runStructuralOperation
            ]
        );

    const addPage =
        useCallback(
            async () => {
                await runStructuralOperation(
                    async () => {
                        const captured =
                            captureCurrentPage();

                        if (!captured) {
                            return;
                        }

                        const editable =
                            ensureEditableProject(
                                captured
                            );

                        const sourcePage =
                            getActiveProjectPage(
                                editable
                            );

                        const nextPage =
                            createBlankPage(
                                sourcePage.width,
                                sourcePage.height,

                                `Página ${editable.pages.length + 1}`,

                                sourcePage.background
                            );

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
                        };

                        await saveMAQuadroProject(
                            next
                        );

                        await refreshProjectLibrary();

                        await loadPage(
                            next,
                            nextPage.id,
                            true
                        );

                        saveStateRef.current =
                            'saved';

                        setSaveState(
                            'saved'
                        );

                        setStatusMessage(
                            'Nova página adicionada.'
                        );
                    }
                );
            },
            [
                captureCurrentPage,
                ensureEditableProject,
                loadPage,
                refreshProjectLibrary,
                runStructuralOperation
            ]
        );

    const duplicateActivePage =
        useCallback(
            async () => {
                await runStructuralOperation(
                    async () => {
                        const captured =
                            captureCurrentPage();

                        if (!captured) {
                            return;
                        }

                        const editable =
                            ensureEditableProject(
                                captured
                            );

                        const currentPage =
                            getActiveProjectPage(
                                editable
                            );

                        const copy =
                            duplicatePage(
                                currentPage
                            );

                        const index =
                            editable.pages
                                .findIndex(
                                    (page) =>
                                        page.id ===
                                        currentPage.id
                                );

                        const pages =
                            [
                                ...editable.pages
                            ];

                        pages.splice(
                            index + 1,
                            0,
                            copy
                        );

                        const next = {
                            ...editable,
                            pages,

                            activePageId:
                                copy.id,

                            updatedAt:
                                new Date()
                                    .toISOString()
                        };

                        await saveMAQuadroProject(
                            next
                        );

                        await refreshProjectLibrary();

                        await loadPage(
                            next,
                            copy.id,
                            true
                        );

                        saveStateRef.current =
                            'saved';

                        setSaveState(
                            'saved'
                        );

                        setStatusMessage(
                            'Página duplicada.'
                        );
                    }
                );
            },
            [
                captureCurrentPage,
                ensureEditableProject,
                loadPage,
                refreshProjectLibrary,
                runStructuralOperation
            ]
        );

    const deleteActivePage =
        useCallback(
            async () => {
                if (
                    !window.confirm(
                        'Eliminar a página atual?'
                    )
                ) {
                    return;
                }

                await runStructuralOperation(
                    async () => {
                        const captured =
                            captureCurrentPage();

                        if (!captured) {
                            return;
                        }

                        if (
                            captured.pages
                                .length ===
                            1
                        ) {
                            setStatusMessage(
                                'O projeto precisa de ter pelo menos uma página.'
                            );

                            return;
                        }

                        const editable =
                            ensureEditableProject(
                                captured
                            );

                        const index =
                            editable.pages
                                .findIndex(
                                    (page) =>
                                        page.id ===
                                        editable.activePageId
                                );

                        const pages =
                            editable.pages
                                .filter(
                                    (page) =>
                                        page.id !==
                                        editable.activePageId
                                );

                        const nextPage =
                            pages[
                                Math.min(
                                    index,
                                    pages.length -
                                    1
                                )
                            ];

                        const deletedPageId =
                            editable
                                .activePageId;

                        const next = {
                            ...editable,
                            pages,

                            activePageId:
                                nextPage.id,

                            updatedAt:
                                new Date()
                                    .toISOString()
                        };

                        await saveMAQuadroProject(
                            next
                        );

                        historiesRef.current
                            .delete(
                                deletedPageId
                            );

                        await refreshProjectLibrary();

                        await loadPage(
                            next,
                            nextPage.id
                        );

                        saveStateRef.current =
                            'saved';

                        setSaveState(
                            'saved'
                        );

                        setStatusMessage(
                            'Página eliminada.'
                        );
                    }
                );
            },
            [
                captureCurrentPage,
                ensureEditableProject,
                loadPage,
                refreshProjectLibrary,
                runStructuralOperation
            ]
        );

    const renamePage =
        useCallback(
            async (
                pageId: string,
                name: string
            ) => {
                const trimmed =
                    name.trim();

                if (!trimmed) {
                    return;
                }

                await runStructuralOperation(
                    async () => {
                        const current =
                            captureCurrentPage();

                        if (!current) {
                            return;
                        }

                        const originalPage =
                            current.pages.find(
                                (page) =>
                                    page.id ===
                                    pageId
                            );

                        if (
                            !originalPage ||
                            originalPage.name ===
                            trimmed
                        ) {
                            return;
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
                                                name:
                                                    trimmed
                                            }
                                            : page
                                ),

                            updatedAt:
                                new Date()
                                    .toISOString()
                        };

                        await saveMAQuadroProject(
                            next
                        );

                        projectRef.current =
                            next;

                        setProject(
                            next
                        );

                        setActivePageState(
                            getActiveProjectPage(
                                next
                            )
                        );

                        await refreshProjectLibrary();

                        saveStateRef.current =
                            'saved';

                        setSaveState(
                            'saved'
                        );

                        setStatusMessage(
                            'Nome da página atualizado.'
                        );
                    }
                );
            },
            [
                captureCurrentPage,
                refreshProjectLibrary,
                runStructuralOperation
            ]
        );

    const movePage =
        useCallback(
            async (
                pageId: string,
                direction:
                    | 'left'
                    | 'right'
            ) => {
                await runStructuralOperation(
                    async () => {
                        const current =
                            captureCurrentPage();

                        if (!current) {
                            return;
                        }

                        const index =
                            current.pages
                                .findIndex(
                                    (page) =>
                                        page.id ===
                                        pageId
                                );

                        const target =
                            direction ===
                            'left'
                                ? index - 1
                                : index + 1;

                        if (
                            index < 0 ||
                            target < 0 ||
                            target >=
                            current.pages
                                .length
                        ) {
                            return;
                        }

                        const pages =
                            [
                                ...current.pages
                            ];

                        const [
                            moved
                        ] = pages.splice(
                            index,
                            1
                        );

                        pages.splice(
                            target,
                            0,
                            moved
                        );

                        const next = {
                            ...current,
                            pages,

                            updatedAt:
                                new Date()
                                    .toISOString()
                        };

                        await saveMAQuadroProject(
                            next
                        );

                        projectRef.current =
                            next;

                        setProject(
                            next
                        );

                        await refreshProjectLibrary();

                        saveStateRef.current =
                            'saved';

                        setSaveState(
                            'saved'
                        );

                        setStatusMessage(
                            'Ordem das páginas atualizada.'
                        );
                    }
                );
            },
            [
                captureCurrentPage,
                refreshProjectLibrary,
                runStructuralOperation
            ]
        );

    const resizeAllPages =
        useCallback(
            async (
                width: number,
                height: number,

                strategy:
                    MAQuadroResizeStrategy =
                    'scale'
            ) => {
                const safeWidth =
                    Math.round(
                        width
                    );

                const safeHeight =
                    Math.round(
                        height
                    );

                if (
                    safeWidth < 100 ||
                    safeHeight < 100 ||
                    safeWidth > 8000 ||
                    safeHeight > 8000
                ) {
                    setStatusMessage(
                        'Use medidas entre 100 e 8000 píxeis.'
                    );

                    return;
                }

                await runStructuralOperation(
                    async () => {
                        const captured =
                            captureCurrentPage();

                        if (!captured) {
                            return;
                        }

                        const editable =
                            ensureEditableProject(
                                captured
                            );

                        const pages =
                            await Promise.all(
                                editable.pages
                                    .map(
                                        async (
                                            page
                                        ) => ({
                                            ...page,

                                            width:
                                                safeWidth,

                                            height:
                                                safeHeight,

                                            canvasJson:
                                                await resizeMAQuadroCanvasJson(
                                                    page.canvasJson,
                                                    page.width,
                                                    page.height,
                                                    safeWidth,
                                                    safeHeight,
                                                    strategy
                                                ),

                                            thumbnail:
                                                undefined
                                        })
                                    )
                            );

                        const next = {
                            ...editable,
                            pages,

                            updatedAt:
                                new Date()
                                    .toISOString()
                        };

                        await saveMAQuadroProject(
                            next
                        );

                        await refreshProjectLibrary();

                        await loadPage(
                            next,
                            next.activePageId,
                            true
                        );

                        saveStateRef.current =
                            'saved';

                        setSaveState(
                            'saved'
                        );

                        setStatusMessage(
                            strategy ===
                            'scale'
                                ? 'Todas as páginas foram redimensionadas e os elementos foram ajustados proporcionalmente.'
                                : strategy ===
                                    'center'
                                    ? 'Todas as páginas foram redimensionadas e os elementos foram recentrados.'
                                    : 'Todas as páginas foram redimensionadas sem alterar o tamanho dos elementos.'
                        );
                    }
                );
            },
            [
                captureCurrentPage,
                ensureEditableProject,
                loadPage,
                refreshProjectLibrary,
                runStructuralOperation
            ]
        );

    const addText =
        useCallback(
            (
                preset:
                    MAQuadroTextPreset
            ) => {
                const canvas =
                    canvasRef.current;

                if (
                    !canvas ||
                    interactionLocked()
                ) {
                    return;
                }

                const object =
                    createMAQuadroText(
                        canvas,
                        preset,

                        availableFonts[0]
                            ?.family ||
                        'Arial'
                    );

                canvas.add(
                    object
                );

                canvas.setActiveObject(
                    object
                );

                canvas.requestRenderAll();

                setActivePanel(
                    'text'
                );
            },
            [
                availableFonts,
                interactionLocked
            ]
        );

    const addShape =
        useCallback(
            (
                kind:
                    MAQuadroShapeKind
            ) => {
                const canvas =
                    canvasRef.current;

                if (
                    !canvas ||
                    interactionLocked()
                ) {
                    return;
                }

                const object =
                    createMAQuadroShape(
                        canvas,
                        kind,

                        brand.colors[0]
                            ?.value ||
                        '#22D3EE'
                    );

                canvas.add(
                    object
                );

                canvas.setActiveObject(
                    object
                );

                canvas.requestRenderAll();

                setActivePanel(
                    'elements'
                );
            },
            [
                brand.colors,
                interactionLocked
            ]
        );

    const addFilesToCanvas =
        useCallback(
            async (
                files:
                    | FileList
                    | File[]
            ) => {
                const imageFiles =
                    Array.from(
                        files
                    ).filter(
                        (file) =>
                            file.type
                                .startsWith(
                                    'image/'
                                )
                    );

                const canvas =
                    canvasRef.current;

                if (
                    !canvas ||
                    imageFiles.length ===
                    0
                ) {
                    if (
                        imageFiles.length ===
                        0 &&
                        files.length > 0
                    ) {
                        setStatusMessage(
                            'Selecione ficheiros de imagem compatíveis.'
                        );
                    }

                    return;
                }

                if (
                    uploadLockRef.current ||
                    structuralLockRef.current ||
                    imageCropEditingRef
                        .current ||
                    busyCountRef.current >
                    0
                ) {
                    setStatusMessage(
                        'Aguarde pela conclusão da operação atual antes de carregar novas imagens.'
                    );

                    return;
                }

                uploadLockRef.current =
                    true;

                setBusy(
                    true
                );

                const added:
                    MAQuadroFabricObject[] =
                    [];

                let failed =
                    0;

                try {
                    isLoadingRef.current =
                        true;

                    try {
                        for (
                            let index = 0;
                            index <
                            imageFiles.length;
                            index += 1
                        ) {
                            try {
                                const object =
                                    await createMAQuadroImage(
                                        canvas,
                                        imageFiles[
                                            index
                                        ]
                                    );

                                object.set({
                                    left:
                                        Number(
                                            object.left ||
                                            0
                                        ) +
                                        added.length *
                                        32,

                                    top:
                                        Number(
                                            object.top ||
                                            0
                                        ) +
                                        added.length *
                                        32
                                });

                                object.setCoords();

                                canvas.add(
                                    object
                                );

                                added.push(
                                    object
                                );
                            } catch (error) {
                                failed +=
                                    1;

                                console.error(
                                    `Não foi possível adicionar “${imageFiles[index].name}”.`,
                                    error
                                );
                            }
                        }

                        if (
                            added.length ===
                            1
                        ) {
                            canvas.setActiveObject(
                                added[0]
                            );
                        } else if (
                            added.length >
                            1
                        ) {
                            canvas.setActiveObject(
                                new ActiveSelection(
                                    added,
                                    {
                                        canvas
                                    }
                                )
                            );
                        }

                        canvas.requestRenderAll();
                    } finally {
                        isLoadingRef.current =
                            false;
                    }

                    if (
                        added.length ===
                        0
                    ) {
                        setStatusMessage(
                            'Não foi possível adicionar as imagens selecionadas.'
                        );

                        return;
                    }

                    const message =
                        failed > 0
                            ? `${added.length} imagem${
                                added.length ===
                                1
                                    ? ''
                                    : 'ns'
                            } adicionada${
                                added.length ===
                                1
                                    ? ''
                                    : 's'
                            }; ${failed} não foi${
                                failed === 1
                                    ? ''
                                    : 'ram'
                            } carregada${
                                failed === 1
                                    ? ''
                                    : 's'
                            }.`
                            : added.length ===
                                1
                                ? 'Imagem adicionada.'
                                : `${added.length} imagens adicionadas.`;

                    commitChange(
                        message
                    );
                } finally {
                    uploadLockRef.current =
                        false;

                    isLoadingRef.current =
                        false;

                    setBusy(
                        false
                    );
                }
            },
            [
                commitChange,
                setBusy
            ]
        );

    const addImages =
        useCallback(
            async (
                event:
                    ChangeEvent<HTMLInputElement>
            ) => {
                const files =
                    Array.from(
                        event
                            .currentTarget
                            .files ||
                        []
                    );

                event.currentTarget.value =
                    '';

                if (
                    files.length ===
                    0
                ) {
                    return;
                }

                await addFilesToCanvas(
                    files
                );
            },
            [
                addFilesToCanvas
            ]
        );

    const handleDroppedFiles =
        useCallback(
            async (
                files:
                    | FileList
                    | File[]
            ) => {
                const stableFiles =
                    Array.from(
                        files
                    );

                if (
                    stableFiles.length ===
                    0
                ) {
                    return;
                }

                await addFilesToCanvas(
                    stableFiles
                );
            },
            [
                addFilesToCanvas
            ]
        );

    const setDrawingMode =
        useCallback(
            (
                enabled: boolean
            ) => {
                const canvas =
                    canvasRef.current;

                if (
                    !canvas ||
                    interactionLocked()
                ) {
                    return;
                }

                canvas.discardActiveObject();

                canvas.isDrawingMode =
                    enabled;

                setDrawingModeState(
                    enabled
                );

                setActivePanel(
                    'elements'
                );

                syncSelection();

                setStatusMessage(
                    enabled
                        ? 'Desenho livre ativo. Arraste no quadro para desenhar.'
                        : 'Desenho livre desativado.'
                );
            },
            [
                interactionLocked,
                syncSelection
            ]
        );

    const setBrushColor =
        useCallback(
            (
                color: string
            ) => {
                const canvas =
                    canvasRef.current;

                brushColorRef.current =
                    color;

                setBrushColorState(
                    color
                );

                if (canvas) {
                    configureMAQuadroBrush(
                        canvas,
                        color,
                        brushWidthRef.current
                    );
                }
            },
            []
        );

    const setBrushWidth =
        useCallback(
            (
                width: number
            ) => {
                const canvas =
                    canvasRef.current;

                const safe =
                    Math.min(
                        120,
                        Math.max(
                            1,
                            width
                        )
                    );

                brushWidthRef.current =
                    safe;

                setBrushWidthState(
                    safe
                );

                if (canvas) {
                    configureMAQuadroBrush(
                        canvas,
                        brushColorRef.current,
                        safe
                    );
                }
            },
            []
        );

    const deleteSelection =
        useCallback(() => {
            const canvas =
                canvasRef.current;

            const objects =
                canvas
                    ?.getActiveObjects() ||
                [];

            if (
                !canvas ||
                objects.length ===
                0 ||
                interactionLocked()
            ) {
                return;
            }

            isLoadingRef.current =
                true;

            try {
                canvas.discardActiveObject();

                canvas.remove(
                    ...objects
                );

                canvas.requestRenderAll();
            } finally {
                isLoadingRef.current =
                    false;
            }

            commitChange(
                objects.length ===
                1
                    ? 'Elemento eliminado.'
                    : 'Elementos eliminados.'
            );
        }, [
            commitChange,
            interactionLocked
        ]);

    const copySelection =
        useCallback(
            async () => {
                const canvas =
                    canvasRef.current;

                const active =
                    canvas
                        ?.getActiveObject() as
                        | MAQuadroFabricObject
                        | undefined;

                if (
                    !active ||
                    interactionLocked()
                ) {
                    return;
                }

                clipboardRef.current =
                    await active.clone(
                        MA_QUADRO_SERIALIZED_PROPERTIES
                    ) as
                        MAQuadroFabricObject;

                clipboardPasteCountRef.current =
                    0;

                setStatusMessage(
                    'Seleção copiada.'
                );
            },
            [
                interactionLocked
            ]
        );

    const pasteSelection =
        useCallback(
            async () => {
                const canvas =
                    canvasRef.current;

                const source =
                    clipboardRef.current;

                if (
                    !canvas ||
                    !source ||
                    interactionLocked()
                ) {
                    return;
                }

                const clone =
                    await source.clone(
                        MA_QUADRO_SERIALIZED_PROPERTIES
                    ) as
                        MAQuadroFabricObject;

                const offset =
                    28 *
                    (
                        clipboardPasteCountRef
                            .current +
                        1
                    );

                isLoadingRef.current =
                    true;

                try {
                    canvas.discardActiveObject();

                    if (
                        clone instanceof
                        ActiveSelection
                    ) {
                        const objects =
                            clone.removeAll() as
                                MAQuadroFabricObject[];

                        for (
                            const object
                            of objects
                        ) {
                            object.set({
                                left:
                                    Number(
                                        object.left ||
                                        0
                                    ) +
                                    offset,

                                top:
                                    Number(
                                        object.top ||
                                        0
                                    ) +
                                    offset,

                                evented: true,
                                selectable: true
                            });

                            renewObjectTreeIdentifiers(
                                object
                            );

                            object.maName =
                                `${getMAQuadroObjectLabel(object)} — cópia`;

                            prepareMAQuadroObject(
                                object,
                                getMAQuadroObjectRole(
                                    object
                                ),
                                object.maName
                            );

                            object.setCoords();

                            canvas.add(
                                object
                            );
                        }

                        if (
                            objects.length >
                            0
                        ) {
                            canvas.setActiveObject(
                                new ActiveSelection(
                                    objects,
                                    {
                                        canvas
                                    }
                                )
                            );
                        }
                    } else {
                        clone.set({
                            left:
                                Number(
                                    source.left ||
                                    0
                                ) +
                                offset,

                            top:
                                Number(
                                    source.top ||
                                    0
                                ) +
                                offset,

                            evented: true,
                            selectable: true
                        });

                        renewObjectTreeIdentifiers(
                            clone
                        );

                        clone.maName =
                            `${getMAQuadroObjectLabel(source)} — cópia`;

                        prepareMAQuadroObject(
                            clone,
                            getMAQuadroObjectRole(
                                clone
                            ),
                            clone.maName
                        );

                        clone.setCoords();

                        canvas.add(
                            clone
                        );

                        canvas.setActiveObject(
                            clone
                        );
                    }

                    canvas.requestRenderAll();
                } finally {
                    isLoadingRef.current =
                        false;
                }

                clipboardPasteCountRef
                    .current +=
                    1;

                commitChange(
                    'Seleção colada.'
                );
            },
            [
                commitChange,
                interactionLocked
            ]
        );

    const duplicateSelection =
        useCallback(
            async () => {
                if (
                    interactionLocked()
                ) {
                    return;
                }

                await copySelection();
                await pasteSelection();
            },
            [
                copySelection,
                interactionLocked,
                pasteSelection
            ]
        );

    const selectAll =
        useCallback(() => {
            const canvas =
                canvasRef.current;

            if (
                !canvas ||
                interactionLocked()
            ) {
                return;
            }

            selectAllMAQuadroObjects(
                canvas
            );

            syncSelection();
        }, [
            interactionLocked,
            syncSelection
        ]);

    const groupSelection =
        useCallback(() => {
            const canvas =
                canvasRef.current;

            if (
                !canvas ||
                canvas
                    .getActiveObjects()
                    .length <
                2 ||
                interactionLocked()
            ) {
                return;
            }

            isLoadingRef.current =
                true;

            try {
                groupMAQuadroSelection(
                    canvas
                );
            } finally {
                isLoadingRef.current =
                    false;
            }

            commitChange(
                'Elementos agrupados.'
            );
        }, [
            commitChange,
            interactionLocked
        ]);

    const ungroupSelection =
        useCallback(() => {
            const canvas =
                canvasRef.current;

            const active =
                canvas
                    ?.getActiveObject();

            if (
                !canvas ||
                !(
                    active instanceof
                    Group
                ) ||
                active instanceof
                ActiveSelection ||
                interactionLocked()
            ) {
                return;
            }

            isLoadingRef.current =
                true;

            try {
                ungroupMAQuadroSelection(
                    canvas
                );
            } finally {
                isLoadingRef.current =
                    false;
            }

            commitChange(
                'Grupo desagrupado.'
            );
        }, [
            commitChange,
            interactionLocked
        ]);

    const alignSelection =
        useCallback(
            (
                alignment:
                    MAQuadroAlignAction
            ) => {
                const canvas =
                    canvasRef.current;

                const active =
                    canvas
                        ?.getActiveObject() as
                        | MAQuadroFabricObject
                        | undefined;

                if (
                    !canvas ||
                    !active ||
                    interactionLocked()
                ) {
                    return;
                }

                const changed =
                    alignMAQuadroSelection(
                        canvas,
                        active,
                        alignment
                    );

                if (!changed) {
                    setStatusMessage(
                        'A seleção já está alinhada ou todos os elementos aplicáveis estão bloqueados.'
                    );

                    return;
                }

                commitChange(
                    canvas
                        .getActiveObjects()
                        .length >
                    1
                        ? 'Elementos alinhados entre si.'
                        : 'Elemento alinhado à página.'
                );
            },
            [
                commitChange,
                interactionLocked
            ]
        );

    const distributeSelection =
        useCallback(
            (
                direction:
                    | 'horizontal'
                    | 'vertical'
            ) => {
                const canvas =
                    canvasRef.current;

                if (
                    !canvas ||
                    interactionLocked()
                ) {
                    return;
                }

                if (
                    !distributeMAQuadroSelection(
                        canvas,
                        direction
                    )
                ) {
                    setStatusMessage(
                        'Selecione pelo menos três elementos desbloqueados para distribuir.'
                    );

                    return;
                }

                commitChange(
                    'Espaçamento distribuído uniformemente.'
                );
            },
            [
                commitChange,
                interactionLocked
            ]
        );

    const arrangeSelection =
        useCallback(
            (
                action:
                    MAQuadroArrangeAction
            ) => {
                const canvas =
                    canvasRef.current;

                const selected =
                    canvas
                        ?.getActiveObjects() as
                        | MAQuadroFabricObject[]
                        | undefined;

                if (
                    !canvas ||
                    !selected ||
                    selected.length ===
                    0 ||
                    interactionLocked()
                ) {
                    return;
                }

                const editable =
                    selected.filter(
                        (object) =>
                            !object.maLocked
                    );

                if (
                    editable.length ===
                    0
                ) {
                    setStatusMessage(
                        'Os elementos selecionados estão bloqueados.'
                    );

                    return;
                }

                const orderBefore =
                    [
                        ...canvas.getObjects()
                    ];

                const ordered =
                    [
                        ...editable
                    ].sort(
                        (
                            first,
                            second
                        ) =>
                            orderBefore.indexOf(
                                first
                            ) -
                            orderBefore.indexOf(
                                second
                            )
                    );

                const iteration =
                    action ===
                    'forward' ||
                    action ===
                    'front'
                        ? [
                            ...ordered
                        ].reverse()
                        : ordered;

                let changed =
                    false;

                isLoadingRef.current =
                    true;

                try {
                    canvas.discardActiveObject();

                    for (
                        const object
                        of iteration
                    ) {
                        changed =
                            arrangeMAQuadroObject(
                                canvas,
                                object,
                                action
                            ) ||
                            changed;
                    }

                    if (
                        selected.length ===
                        1
                    ) {
                        canvas.setActiveObject(
                            selected[0]
                        );
                    } else {
                        canvas.setActiveObject(
                            new ActiveSelection(
                                selected,
                                {
                                    canvas
                                }
                            )
                        );
                    }

                    canvas.requestRenderAll();
                } finally {
                    isLoadingRef.current =
                        false;
                }

                if (!changed) {
                    setStatusMessage(
                        'A seleção já está nessa posição.'
                    );

                    return;
                }

                commitChange(
                    selected.length ===
                    1
                        ? 'Ordem do elemento atualizada.'
                        : 'Ordem dos elementos atualizada.'
                );
            },
            [
                commitChange,
                interactionLocked
            ]
        );

    const moveSelection =
        useCallback(
            (
                x: number,
                y: number
            ) => {
                const canvas =
                    canvasRef.current;

                const active =
                    canvas
                        ?.getActiveObject() as
                        | MAQuadroFabricObject
                        | undefined;

                if (
                    !canvas ||
                    !active ||
                    active.maLocked ||
                    interactionLocked()
                ) {
                    return;
                }

                active.set({
                    left:
                        Number(
                            active.left ||
                            0
                        ) +
                        x,

                    top:
                        Number(
                            active.top ||
                            0
                        ) +
                        y
                });

                active.setCoords();

                canvas.requestRenderAll();

                commitChange(
                    'Posição atualizada.'
                );
            },
            [
                commitChange,
                interactionLocked
            ]
        );

    const applyHistory =
        useCallback(
            async (
                serialized: string
            ): Promise<boolean> => {
                const canvas =
                    canvasRef.current;

                const current =
                    projectRef.current;

                if (
                    !canvas ||
                    !current ||
                    uploadLockRef.current ||
                    structuralLockRef.current ||
                    imageCropEditingRef
                        .current
                ) {
                    return false;
                }

                const previousCanvasJson =
                    serializeMAQuadroCanvas(
                        canvas
                    );

                const previousPage =
                    getActiveProjectPage(
                        current
                    );

                let snapshot: {
                    pageId: string;

                    background:
                        MAQuadroBackground;

                    canvasJson:
                        Record<
                            string,
                            unknown
                        >;
                };

                try {
                    snapshot =
                        JSON.parse(
                            serialized
                        ) as
                            typeof snapshot;
                } catch (error) {
                    console.error(
                        error
                    );

                    setStatusMessage(
                        'Este ponto do histórico está danificado e não foi aplicado.'
                    );

                    return false;
                }

                const page =
                    current.pages.find(
                        (item) =>
                            item.id ===
                            snapshot.pageId
                    );

                if (!page) {
                    return false;
                }

                isApplyingHistoryRef
                    .current =
                    true;

                isLoadingRef.current =
                    true;

                try {
                    canvas.discardActiveObject();

                    canvas.clear();

                    await loadMAQuadroCanvasJson(
                        canvas,
                        snapshot.canvasJson
                    );

                    const updatedPage = {
                        ...page,

                        background:
                            snapshot.background,

                        canvasJson:
                            snapshot.canvasJson
                    };

                    const next =
                        replaceProjectPage(
                            current,
                            updatedPage
                        );

                    applyMAQuadroPageBackground(
                        canvas,
                        updatedPage
                    );

                    projectRef.current =
                        next;

                    setProject(
                        next
                    );

                    setActivePageState(
                        updatedPage
                    );

                    canvas.requestRenderAll();

                    syncLayers();
                    syncSelection();

                    isLoadingRef.current =
                        false;

                    isApplyingHistoryRef
                        .current =
                        false;

                    markDirty(
                        'Histórico aplicado.'
                    );

                    return true;
                } catch (error) {
                    console.error(
                        error
                    );

                    try {
                        canvas.clear();

                        await loadMAQuadroCanvasJson(
                            canvas,
                            previousCanvasJson
                        );

                        applyMAQuadroPageBackground(
                            canvas,
                            previousPage
                        );

                        projectRef.current =
                            current;

                        setProject(
                            current
                        );

                        setActivePageState(
                            previousPage
                        );

                        syncLayers();
                        syncSelection();

                        canvas.requestRenderAll();
                    } catch (
                        rollbackError
                    ) {
                        console.error(
                            'Não foi possível repor o estado anterior do quadro.',
                            rollbackError
                        );
                    }

                    setStatusMessage(
                        'Não foi possível aplicar este ponto do histórico. O estado anterior foi preservado.'
                    );

                    return false;
                } finally {
                    isLoadingRef.current =
                        false;

                    isApplyingHistoryRef
                        .current =
                        false;
                }
            },
            [
                markDirty,
                syncLayers,
                syncSelection
            ]
        );

    const undo =
        useCallback(
            async () => {
                if (
                    interactionLocked()
                ) {
                    return;
                }

                const pageId =
                    projectRef.current
                        ?.activePageId;

                const history =
                    pageId
                        ? historiesRef
                            .current
                            .get(
                                pageId
                            )
                        : undefined;

                if (
                    !history ||
                    history.index <=
                    0
                ) {
                    return;
                }

                const targetIndex =
                    history.index -
                    1;

                const applied =
                    await applyHistory(
                        history.entries[
                            targetIndex
                        ]
                    );

                if (applied) {
                    history.index =
                        targetIndex;
                }

                updateHistoryButtons();
            },
            [
                applyHistory,
                interactionLocked,
                updateHistoryButtons
            ]
        );

    const redo =
        useCallback(
            async () => {
                if (
                    interactionLocked()
                ) {
                    return;
                }

                const pageId =
                    projectRef.current
                        ?.activePageId;

                const history =
                    pageId
                        ? historiesRef
                            .current
                            .get(
                                pageId
                            )
                        : undefined;

                if (
                    !history ||
                    history.index >=
                    history.entries
                        .length -
                    1
                ) {
                    return;
                }

                const targetIndex =
                    history.index +
                    1;

                const applied =
                    await applyHistory(
                        history.entries[
                            targetIndex
                        ]
                    );

                if (applied) {
                    history.index =
                        targetIndex;
                }

                updateHistoryButtons();
            },
            [
                applyHistory,
                interactionLocked,
                updateHistoryButtons
            ]
        );

    const selectLayer =
        useCallback(
            (
                layerId: string
            ) => {
                const canvas =
                    canvasRef.current;

                const object =
                    findCanvasObject(
                        layerId
                    );

                if (
                    !canvas ||
                    !object ||
                    object.maLocked ||
                    object.visible ===
                    false ||
                    interactionLocked()
                ) {
                    return;
                }

                canvas.setActiveObject(
                    object
                );

                canvas.requestRenderAll();

                syncSelection();
            },
            [
                findCanvasObject,
                interactionLocked,
                syncSelection
            ]
        );

    const toggleLayerVisibility =
        useCallback(
            (
                layerId: string
            ) => {
                const canvas =
                    canvasRef.current;

                const object =
                    findCanvasObject(
                        layerId
                    );

                if (
                    !canvas ||
                    !object ||
                    interactionLocked()
                ) {
                    return;
                }

                object.set({
                    visible:
                        object.visible ===
                        false
                });

                canvas.discardActiveObject();

                canvas.requestRenderAll();

                commitChange(
                    'Visibilidade da camada atualizada.'
                );
            },
            [
                commitChange,
                findCanvasObject,
                interactionLocked
            ]
        );

    const toggleLayerLock =
        useCallback(
            (
                layerId: string
            ) => {
                const canvas =
                    canvasRef.current;

                const object =
                    findCanvasObject(
                        layerId
                    );

                if (
                    !canvas ||
                    !object ||
                    interactionLocked()
                ) {
                    return;
                }

                applyMAQuadroLock(
                    object,
                    !object.maLocked
                );

                canvas.discardActiveObject();

                canvas.requestRenderAll();

                commitChange(
                    object.maLocked
                        ? 'Camada bloqueada.'
                        : 'Camada desbloqueada.'
                );
            },
            [
                commitChange,
                findCanvasObject,
                interactionLocked
            ]
        );

    const moveLayer =
        useCallback(
            (
                layerId: string,
                direction:
                    | 'up'
                    | 'down'
            ) => {
                const canvas =
                    canvasRef.current;

                const object =
                    findCanvasObject(
                        layerId
                    );

                if (
                    !canvas ||
                    !object ||
                    interactionLocked()
                ) {
                    return;
                }

                if (
                    !arrangeMAQuadroObject(
                        canvas,
                        object,

                        direction ===
                        'up'
                            ? 'forward'
                            : 'backward'
                    )
                ) {
                    return;
                }

                commitChange(
                    'Ordem da camada atualizada.'
                );
            },
            [
                commitChange,
                findCanvasObject,
                interactionLocked
            ]
        );

    const applyToSelectedObjects =
        useCallback(
            (
                operation:
                    (
                        object:
                            MAQuadroFabricObject
                    ) =>
                        | boolean
                        | void,

                message: string,

                noChangeMessage =
                    'Esta alteração não se aplica à seleção atual.'
            ) => {
                const canvas =
                    canvasRef.current;

                const objects =
                    canvas
                        ?.getActiveObjects() as
                        | MAQuadroFabricObject[]
                        | undefined;

                if (
                    !canvas ||
                    !objects ||
                    objects.length ===
                    0 ||
                    interactionLocked()
                ) {
                    return false;
                }

                let changed =
                    false;

                for (
                    const object
                    of objects
                ) {
                    if (
                        object.maLocked
                    ) {
                        continue;
                    }

                    const result =
                        operation(
                            object
                        );

                    if (
                        result !==
                        false
                    ) {
                        changed =
                            true;

                        object.setCoords();
                    }
                }

                if (!changed) {
                    setStatusMessage(
                        noChangeMessage
                    );

                    return false;
                }

                canvas.requestRenderAll();

                syncSelection();

                commitChange(
                    message
                );

                return true;
            },
            [
                commitChange,
                interactionLocked,
                syncSelection
            ]
        );

    const setSelectionName =
        useCallback(
            (
                name: string
            ) => {
                const active =
                    canvasRef.current
                        ?.getActiveObject() as
                        | MAQuadroFabricObject
                        | undefined;

                const nextName =
                    name.trim();

                if (
                    !active ||
                    !nextName ||
                    active.maName ===
                    nextName ||
                    interactionLocked()
                ) {
                    return;
                }

                active.maName =
                    nextName;

                syncSelection();

                commitChange(
                    'Nome da camada atualizado.'
                );
            },
            [
                commitChange,
                interactionLocked,
                syncSelection
            ]
        );

    const setSelectionFill =
        useCallback(
            (
                color: string
            ) => {
                applyToSelectedObjects(
                    (object) =>
                        setMAQuadroObjectFill(
                            object,
                            color
                        ),

                    'Cor atualizada.',

                    'A cor de preenchimento não se aplica às imagens selecionadas ou os elementos estão bloqueados.'
                );
            },
            [
                applyToSelectedObjects
            ]
        );

    const setSelectionStroke =
        useCallback(
            (
                color: string
            ) => {
                applyToSelectedObjects(
                    (object) =>
                        setMAQuadroObjectStroke(
                            object,
                            color
                        ),

                    'Contorno atualizado.'
                );
            },
            [
                applyToSelectedObjects
            ]
        );

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
                    );

                applyToSelectedObjects(
                    (object) =>
                        setMAQuadroObjectStrokeWidth(
                            object,
                            safe
                        ),

                    'Espessura do contorno atualizada.'
                );
            },
            [
                applyToSelectedObjects
            ]
        );

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
                    );

                applyToSelectedObjects(
                    (object) => {
                        object.set({
                            opacity:
                                safe /
                                100
                        });

                        return true;
                    },

                    'Opacidade atualizada.'
                );
            },
            [
                applyToSelectedObjects
            ]
        );

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
                    canvasRef.current;

                const active =
                    canvas
                        ?.getActiveObject() as
                        | MAQuadroFabricObject
                        | undefined;

                if (
                    !canvas ||
                    !active ||
                    !Number.isFinite(
                        value
                    ) ||
                    interactionLocked()
                ) {
                    return;
                }

                setMAQuadroObjectGeometry(
                    active,
                    {
                        [field]:
                            value
                    }
                );

                canvas.requestRenderAll();

                syncSelection();

                commitChange(
                    'Geometria atualizada.'
                );
            },
            [
                commitChange,
                interactionLocked,
                syncSelection
            ]
        );

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
                            axis ===
                            'x'
                                ? {
                                    flipX:
                                        !object.flipX
                                }
                                : {
                                    flipY:
                                        !object.flipY
                                }
                        );

                        return true;
                    },

                    axis ===
                    'x'
                        ? 'Elemento virado horizontalmente.'
                        : 'Elemento virado verticalmente.'
                );
            },
            [
                applyToSelectedObjects
            ]
        );

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
                            !(
                                object instanceof
                                Textbox
                            )
                        ) {
                            return false;
                        }

                        object.set({
                            [property]:
                                value
                        });

                        return true;
                    },

                    'Texto atualizado.',

                    'Esta alteração só se aplica a texto desbloqueado.'
                );
            },
            [
                applyToSelectedObjects
            ]
        );

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
                            return false;
                        }

                        const value =
                            object.text ||
                            '';

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
                        });

                        return true;
                    },

                    'Capitalização do texto atualizada.',

                    'Esta alteração só se aplica a texto desbloqueado.'
                );
            },
            [
                applyToSelectedObjects
            ]
        );

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
                    );

                applyToSelectedObjects(
                    (object) => {
                        if (
                            getMAQuadroShapeKind(
                                object
                            ) !==
                            'rectangle'
                        ) {
                            return false;
                        }

                        object.set({
                            rx:
                                safe,
                            ry:
                                safe
                        });

                        return true;
                    },

                    'Cantos arredondados atualizados.',

                    'Os cantos arredondados só se aplicam a retângulos desbloqueados.'
                );
            },
            [
                applyToSelectedObjects
            ]
        );

    const setShadow =
        useCallback(
            (
                values:
                    Partial<{
                        enabled: boolean;
                        color: string;
                        blur: number;
                        offsetX: number;
                        offsetY: number;
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
                };

                applyToSelectedObjects(
                    (object) =>
                        setMAQuadroObjectShadow(
                            object,
                            next.enabled,
                            next.color,
                            next.blur,
                            next.offsetX,
                            next.offsetY
                        ),

                    'Sombra atualizada.'
                );
            },
            [
                applyToSelectedObjects,
                selection
            ]
        );

    const setGradient =
        useCallback(
            (
                values:
                    Partial<{
                        enabled: boolean;
                        from: string;
                        to: string;
                        angle: number;
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
                };

                applyToSelectedObjects(
                    (object) => {
                        const role =
                            getMAQuadroObjectRole(
                                object
                            );

                        if (
                            role ===
                            'image' ||
                            role ===
                            'line'
                        ) {
                            return false;
                        }

                        return next.enabled
                            ? setMAQuadroObjectGradient(
                                object,
                                next.from,
                                next.to,
                                next.angle
                            )
                            : setMAQuadroObjectFill(
                                object,
                                next.from
                            );
                    },

                    'Gradiente atualizado.',

                    'O gradiente não se aplica às imagens ou linhas selecionadas.'
                );
            },
            [
                applyToSelectedObjects,
                selection
            ]
        );

    const getSelectedImage =
        useCallback(() => {
            const canvas =
                canvasRef.current;

            const activeObjects =
                canvas
                    ?.getActiveObjects() ||
                [];

            if (
                activeObjects.length !==
                1 ||
                !(
                    activeObjects[0]
                    instanceof
                    FabricImage
                )
            ) {
                return null;
            }

            return activeObjects[0] as
                FabricImage &
                MAQuadroFabricObject;
        }, []);

    const beginImageCrop =
        useCallback(() => {
            const canvas =
                canvasRef.current;

            const image =
                getSelectedImage();

            if (
                !canvas ||
                !image ||
                image.maLocked ||
                interactionLocked()
            ) {
                return;
            }

            image.maId ||=
                createMAQuadroId(
                    'object'
                );

            cropSessionRef.current =
                cropSessionForImage(
                    image
                );

            imageCropEditingRef.current =
                true;

            setImageCropEditing(
                true
            );

            setGuides(
                emptyMAQuadroGuides()
            );

            image.set({
                lockScalingX:
                    true,
                lockScalingY:
                    true,
                lockRotation:
                    true,
                hasControls:
                    false
            });

            image.setCoords();

            canvas.setActiveObject(
                image
            );

            canvas.requestRenderAll();

            syncSelection();

            setStatusMessage(
                'Modo de recorte ativo. Arraste a imagem para a reposicionar dentro da moldura, ajuste o zoom e conclua quando estiver satisfeito.'
            );
        }, [
            getSelectedImage,
            interactionLocked,
            syncSelection
        ]);

    const finishImageCrop =
        useCallback(() => {
            const canvas =
                canvasRef.current;

            const session =
                cropSessionRef.current;

            const image =
                getSelectedImage();

            if (
                !canvas ||
                !session ||
                !image ||
                image.maId !==
                session.objectId
            ) {
                imageCropEditingRef
                    .current =
                    false;

                cropSessionRef.current =
                    null;

                setImageCropEditing(
                    false
                );

                setGuides(
                    emptyMAQuadroGuides()
                );

                return;
            }

            image.set({
                left:
                    session.left,

                top:
                    session.top,

                lockScalingX:
                    session.lockScalingX,

                lockScalingY:
                    session.lockScalingY,

                lockRotation:
                    session.lockRotation,

                hasControls:
                    session.hasControls
            });

            image.setCoords();

            imageCropEditingRef
                .current =
                false;

            cropSessionRef.current =
                null;

            setImageCropEditing(
                false
            );

            setGuides(
                emptyMAQuadroGuides()
            );

            canvas.requestRenderAll();

            syncSelection();

            const changed =
                commitChange(
                    'Recorte da imagem atualizado.'
                );

            if (!changed) {
                setStatusMessage(
                    'Recorte concluído sem alterações.'
                );
            }
        }, [
            commitChange,
            getSelectedImage,
            syncSelection
        ]);

    const cancelImageCrop =
        useCallback(() => {
            const canvas =
                canvasRef.current;

            const session =
                cropSessionRef.current;

            const image =
                getSelectedImage();

            if (
                image &&
                session &&
                image.maId ===
                session.objectId
            ) {
                const frameKind =
                    getMAQuadroImageFrameKind(
                        image
                    );

                image.set({
                    left:
                        session.left,
                    top:
                        session.top,
                    width:
                        session.width,
                    height:
                        session.height,
                    cropX:
                        session.cropX,
                    cropY:
                        session.cropY,
                    scaleX:
                        session.scaleX,
                    scaleY:
                        session.scaleY,

                    lockScalingX:
                        session.lockScalingX,

                    lockScalingY:
                        session.lockScalingY,

                    lockRotation:
                        session.lockRotation,

                    hasControls:
                        session.hasControls
                });

                if (
                    frameKind !==
                    'none'
                ) {
                    applyMAQuadroImageFrame(
                        image,
                        frameKind
                    );
                }

                image.setCoords();
            }

            imageCropEditingRef.current =
                false;

            cropSessionRef.current =
                null;

            setImageCropEditing(
                false
            );

            setGuides(
                emptyMAQuadroGuides()
            );

            canvas
                ?.requestRenderAll();

            syncSelection();

            setStatusMessage(
                'Alterações de recorte canceladas.'
            );
        }, [
            getSelectedImage,
            syncSelection
        ]);

    const refreshCropDragAnchor =
        useCallback(
            (
                image:
                    FabricImage &
                    MAQuadroFabricObject
            ) => {
                const session =
                    cropSessionRef.current;

                if (
                    !session ||
                    image.maId !==
                    session.objectId
                ) {
                    return;
                }

                session.startCropX =
                    Number(
                        image.cropX ||
                        0
                    );

                session.startCropY =
                    Number(
                        image.cropY ||
                        0
                    );

                image.set({
                    left:
                        session.left,
                    top:
                        session.top
                });

                image.setCoords();
            },
            []
        );

    const setImageCropZoom =
        useCallback(
            (
                zoomValue: number
            ) => {
                const canvas =
                    canvasRef.current;

                const image =
                    getSelectedImage();

                if (
                    !canvas ||
                    !image ||
                    !imageCropEditingRef
                        .current ||
                    !cropSessionRef
                        .current
                ) {
                    return;
                }

                setMAQuadroCropViewport(
                    image,
                    {
                        zoom:
                            clamp(
                                zoomValue,
                                100,
                                400
                            )
                    }
                );

                refreshCropDragAnchor(
                    image
                );

                canvas.requestRenderAll();

                syncSelection();
            },
            [
                getSelectedImage,
                refreshCropDragAnchor,
                syncSelection
            ]
        );

    const setImageCropPosition =
        useCallback(
            (
                positionX: number,
                positionY: number
            ) => {
                const canvas =
                    canvasRef.current;

                const image =
                    getSelectedImage();

                if (
                    !canvas ||
                    !image ||
                    !imageCropEditingRef
                        .current ||
                    !cropSessionRef
                        .current
                ) {
                    return;
                }

                setMAQuadroCropViewport(
                    image,
                    {
                        positionX:
                            clamp(
                                positionX,
                                0,
                                100
                            ),

                        positionY:
                            clamp(
                                positionY,
                                0,
                                100
                            )
                    }
                );

                refreshCropDragAnchor(
                    image
                );

                canvas.requestRenderAll();

                syncSelection();
            },
            [
                getSelectedImage,
                refreshCropDragAnchor,
                syncSelection
            ]
        );

    const setImageFrame =
        useCallback(
            (
                kind:
                    MAQuadroImageFrameKind
            ) => {
                const canvas =
                    canvasRef.current;

                const image =
                    getSelectedImage();

                if (
                    !canvas ||
                    !image ||
                    image.maLocked ||
                    interactionLocked()
                ) {
                    return;
                }

                const current =
                    getMAQuadroImageFrameKind(
                        image
                    );

                if (
                    current ===
                    kind
                ) {
                    return;
                }

                applyMAQuadroImageFrame(
                    image,
                    kind
                );

                canvas.requestRenderAll();

                syncSelection();

                commitChange(
                    kind ===
                    'none'
                        ? 'Moldura da imagem removida.'
                        : 'Moldura da imagem aplicada.'
                );
            },
            [
                commitChange,
                getSelectedImage,
                interactionLocked,
                syncSelection
            ]
        );

    const setImageFilters =
        useCallback(
            (
                values:
                    Partial<
                        MAQuadroImageFilterState
                    >
            ) => {
                const image =
                    getSelectedImage();

                const canvas =
                    canvasRef.current;

                if (
                    !image ||
                    !canvas ||
                    interactionLocked()
                ) {
                    return;
                }

                applyMAQuadroImageFilters(
                    image,
                    {
                        ...getMAQuadroImageFilters(
                            image
                        ),
                        ...values
                    }
                );

                canvas.requestRenderAll();

                syncSelection();

                commitChange(
                    'Ajustes da imagem atualizados.'
                );
            },
            [
                commitChange,
                getSelectedImage,
                interactionLocked,
                syncSelection
            ]
        );

    const resetImageFilters =
        useCallback(() => {
            const image =
                getSelectedImage();

            const canvas =
                canvasRef.current;

            if (
                !image ||
                !canvas ||
                interactionLocked()
            ) {
                return;
            }

            resetMAQuadroImageFilters(
                image
            );

            canvas.requestRenderAll();

            syncSelection();

            commitChange(
                'Filtros da imagem repostos.'
            );
        }, [
            commitChange,
            getSelectedImage,
            interactionLocked,
            syncSelection
        ]);

    const setImageCrop =
        useCallback(
            (
                horizontal: number,
                vertical: number
            ) => {
                const image =
                    getSelectedImage();

                const canvas =
                    canvasRef.current;

                if (
                    !image ||
                    !canvas ||
                    (
                        !imageCropEditingRef
                            .current &&
                        interactionLocked()
                    )
                ) {
                    return;
                }

                const frameKind =
                    getMAQuadroImageFrameKind(
                        image
                    );

                cropMAQuadroImageSymmetrically(
                    image,
                    horizontal,
                    vertical
                );

                if (
                    frameKind !==
                    'none'
                ) {
                    applyMAQuadroImageFrame(
                        image,
                        frameKind
                    );
                }

                canvas.requestRenderAll();

                syncSelection();

                if (
                    imageCropEditingRef
                        .current
                ) {
                    refreshCropDragAnchor(
                        image
                    );

                    return;
                }

                commitChange(
                    'Recorte da imagem atualizado.'
                );
            },
            [
                commitChange,
                getSelectedImage,
                interactionLocked,
                refreshCropDragAnchor,
                syncSelection
            ]
        );

    const resetImageCrop =
        useCallback(() => {
            const image =
                getSelectedImage();

            const canvas =
                canvasRef.current;

            if (
                !image ||
                !canvas ||
                (
                    !imageCropEditingRef
                        .current &&
                    interactionLocked()
                )
            ) {
                return;
            }

            const frameKind =
                getMAQuadroImageFrameKind(
                    image
                );

            resetMAQuadroImageCrop(
                image
            );

            if (
                frameKind !==
                'none'
            ) {
                applyMAQuadroImageFrame(
                    image,
                    frameKind
                );
            }

            canvas.requestRenderAll();

            syncSelection();

            if (
                imageCropEditingRef
                    .current
            ) {
                refreshCropDragAnchor(
                    image
                );

                return;
            }

            commitChange(
                'Recorte da imagem reposto.'
            );
        }, [
            commitChange,
            getSelectedImage,
            interactionLocked,
            refreshCropDragAnchor,
            syncSelection
        ]);

    const removeImageBackground =
        useCallback(
            async () => {
                const image =
                    getSelectedImage();

                const canvas =
                    canvasRef.current;

                if (
                    !image ||
                    !canvas ||
                    interactionLocked()
                ) {
                    return;
                }

                const sourceDataUrl =
                    getMAQuadroImageSourceDataUrl(
                        image
                    );

                if (!sourceDataUrl) {
                    setStatusMessage(
                        'A remoção local de fundo só está disponível para imagens incorporadas neste projeto.'
                    );

                    return;
                }

                const filtersBefore =
                    getMAQuadroImageFilters(
                        image
                    );

                const cropBefore =
                    getMAQuadroImageCropPercentages(
                        image
                    );

                const viewportBefore =
                    getMAQuadroCropViewportState(
                        image
                    );

                const frameBefore =
                    getMAQuadroImageFrameKind(
                        image
                    );

                const oldSourceWidth =
                    Math.max(
                        1,
                        image.maOriginalWidth ||
                        image.width ||
                        1
                    );

                const oldSourceHeight =
                    Math.max(
                        1,
                        image.maOriginalHeight ||
                        image.height ||
                        1
                    );

                setBusy(
                    true
                );

                setStatusMessage(
                    'A remover o fundo localmente…'
                );

                try {
                    const transparentDataUrl =
                        await removeSimpleImageBackground(
                            sourceDataUrl
                        );

                    const replacement =
                        await FabricImage
                            .fromURL(
                                transparentDataUrl
                            ) as
                                FabricImage &
                                MAQuadroFabricObject;

                    const newSourceWidth =
                        Math.max(
                            1,
                            replacement.width ||
                            1
                        );

                    const newSourceHeight =
                        Math.max(
                            1,
                            replacement.height ||
                            1
                        );

                    const index =
                        canvas
                            .getObjects()
                            .indexOf(
                                image
                            );

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

                        scaleX:
                            Number(
                                image.scaleX ||
                                1
                            ) *
                            oldSourceWidth /
                            newSourceWidth,

                        scaleY:
                            Number(
                                image.scaleY ||
                                1
                            ) *
                            oldSourceHeight /
                            newSourceHeight,

                        cropX: 0,
                        cropY: 0,

                        width:
                            newSourceWidth,

                        height:
                            newSourceHeight
                    });

                    replacement.maId =
                        image.maId;

                    replacement.maName =
                        image.maName;

                    replacement.maRole =
                        'image';

                    replacement.maSourceDataUrl =
                        transparentDataUrl;

                    replacement.maOriginalWidth =
                        newSourceWidth;

                    replacement.maOriginalHeight =
                        newSourceHeight;

                    prepareMAQuadroObject(
                        replacement,
                        'image',

                        image.maName ||
                        'Imagem sem fundo'
                    );

                    if (
                        viewportBefore.zoom >
                        100 ||
                        Math.abs(
                            viewportBefore
                                .positionX -
                            50
                        ) >
                        1 ||
                        Math.abs(
                            viewportBefore
                                .positionY -
                            50
                        ) >
                        1
                    ) {
                        setMAQuadroCropViewport(
                            replacement,
                            viewportBefore
                        );
                    } else if (
                        cropBefore.horizontal >
                        0 ||
                        cropBefore.vertical >
                        0
                    ) {
                        cropMAQuadroImageSymmetrically(
                            replacement,
                            cropBefore.horizontal,
                            cropBefore.vertical
                        );
                    }

                    applyMAQuadroImageFilters(
                        replacement,
                        filtersBefore
                    );

                    if (
                        frameBefore !==
                        'none'
                    ) {
                        applyMAQuadroImageFrame(
                            replacement,
                            frameBefore
                        );
                    }

                    isLoadingRef.current =
                        true;

                    try {
                        canvas.discardActiveObject();

                        canvas.remove(
                            image
                        );

                        canvas.add(
                            replacement
                        );

                        canvas.moveObjectTo(
                            replacement,
                            Math.max(
                                0,
                                index
                            )
                        );

                        canvas.setActiveObject(
                            replacement
                        );

                        canvas.requestRenderAll();
                    } finally {
                        isLoadingRef.current =
                            false;
                    }

                    syncSelection();

                    commitChange(
                        'Fundo removido localmente. O recorte, a moldura e os ajustes foram preservados.'
                    );
                } catch (error) {
                    console.error(
                        error
                    );

                    setStatusMessage(
                        'Não foi possível remover este fundo automaticamente. Esta ferramenta funciona melhor com fundos lisos e uniformes.'
                    );
                } finally {
                    setBusy(
                        false
                    );
                }
            },
            [
                commitChange,
                getSelectedImage,
                interactionLocked,
                setBusy,
                syncSelection
            ]
        );

    const setBackground =
        useCallback(
            (
                background:
                    Partial<
                        MAQuadroBackground
                    >
            ) => {
                const canvas =
                    canvasRef.current;

                const current =
                    projectRef.current;

                if (
                    !canvas ||
                    !current ||
                    interactionLocked()
                ) {
                    return;
                }

                const page =
                    getActiveProjectPage(
                        current
                    );

                const updatedPage = {
                    ...page,

                    background: {
                        ...page.background,
                        ...background
                    }
                };

                const next =
                    replaceProjectPage(
                        current,
                        updatedPage
                    );

                projectRef.current =
                    next;

                setProject(
                    next
                );

                setActivePageState(
                    updatedPage
                );

                applyMAQuadroPageBackground(
                    canvas,
                    updatedPage
                );

                pushHistory();

                markDirty(
                    'Fundo da página atualizado.'
                );
            },
            [
                interactionLocked,
                markDirty,
                pushHistory
            ]
        );

    const applyBrandColor =
        useCallback(
            (
                color: string
            ) => {
                const canvas =
                    canvasRef.current;

                if (
                    interactionLocked()
                ) {
                    return;
                }

                const selected =
                    canvas
                        ?.getActiveObjects() as
                        | MAQuadroFabricObject[]
                        | undefined;

                if (
                    selected &&
                    selected.length >
                    0
                ) {
                    const applicable =
                        selected.some(
                            (object) =>
                                !object.maLocked &&
                                getMAQuadroObjectRole(
                                    object
                                ) !==
                                'image'
                        );

                    if (!applicable) {
                        setStatusMessage(
                            'A cor da marca não altera imagens nem elementos bloqueados.'
                        );

                        return;
                    }

                    setSelectionFill(
                        color
                    );
                } else {
                    setBackground({
                        type: 'solid',
                        color
                    });
                }
            },
            [
                interactionLocked,
                setBackground,
                setSelectionFill
            ]
        );

    const uploadFont =
        useCallback(
            async (
                event:
                    ChangeEvent<HTMLInputElement>
            ) => {
                const file =
                    event.target
                        .files?.[0];

                event.target.value =
                    '';

                if (
                    !file ||
                    interactionLocked()
                ) {
                    return;
                }

                if (
                    file.size >
                    12 *
                    1024 *
                    1024
                ) {
                    setStatusMessage(
                        'A fonte ultrapassa o limite de 12 MB.'
                    );

                    return;
                }

                setBusy(
                    true
                );

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
                        'Fonte local';

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
                        );

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
                        };

                    await registerLocalFont(
                        record
                    );

                    await saveMAQuadroFont(
                        record
                    );

                    setLocalFonts(
                        await listMAQuadroFonts()
                    );

                    setStatusMessage(
                        `Fonte “${record.family}” adicionada localmente.`
                    );
                } catch (error) {
                    console.error(
                        error
                    );

                    setStatusMessage(
                        'Não foi possível carregar esta fonte.'
                    );
                } finally {
                    setBusy(
                        false
                    );
                }
            },
            [
                interactionLocked,
                localFonts,
                setBusy
            ]
        );

    const deleteFont =
        useCallback(
            async (
                fontId: string
            ) => {
                if (
                    interactionLocked()
                ) {
                    return;
                }

                try {
                    await deleteMAQuadroFont(
                        fontId
                    );

                    setLocalFonts(
                        await listMAQuadroFonts()
                    );

                    setStatusMessage(
                        'Fonte eliminada do armazenamento local. Deixará de estar ativa depois de recarregar a página.'
                    );
                } catch (error) {
                    console.error(
                        error
                    );

                    setStatusMessage(
                        'Não foi possível eliminar a fonte.'
                    );
                }
            },
            [
                interactionLocked
            ]
        );

    const toggleGrid =
        useCallback(() => {
            setShowGrid(
                (current) =>
                    !current
            );
        }, []);

    const toggleSafeArea =
        useCallback(() => {
            setShowSafeArea(
                (current) =>
                    !current
            );
        }, []);

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
                    return;
                }

                event.preventDefault();

                const direction =
                    event.deltaY >
                    0
                        ? -5
                        : 5;

                setZoom(
                    zoomRef.current +
                    direction
                );
            },
            [
                setZoom
            ]
        );

    const onWorkspacePointerDown =
        useCallback(
            (
                event:
                    ReactPointerEvent<HTMLDivElement>
            ) => {
                const workspace =
                    workspaceRef.current;

                const shouldPan =
                    !imageCropEditingRef
                        .current &&
                    (
                        spacePressedRef.current ||
                        event.button ===
                        1
                    );

                if (
                    !workspace ||
                    !shouldPan
                ) {
                    return;
                }

                event.preventDefault();

                panStateRef.current = {
                    active: true,
                    startX:
                        event.clientX,
                    startY:
                        event.clientY,
                    scrollLeft:
                        workspace.scrollLeft,
                    scrollTop:
                        workspace.scrollTop
                };

                const move = (
                    moveEvent:
                        PointerEvent
                ) => {
                    const pan =
                        panStateRef.current;

                    if (!pan.active) {
                        return;
                    }

                    workspace.scrollLeft =
                        pan.scrollLeft -
                        (
                            moveEvent.clientX -
                            pan.startX
                        );

                    workspace.scrollTop =
                        pan.scrollTop -
                        (
                            moveEvent.clientY -
                            pan.startY
                        );
                };

                const finish =
                    () => {
                        panStateRef.current
                            .active =
                            false;

                        window.removeEventListener(
                            'pointermove',
                            move
                        );

                        window.removeEventListener(
                            'pointerup',
                            finish
                        );
                    };

                window.addEventListener(
                    'pointermove',
                    move
                );

                window.addEventListener(
                    'pointerup',
                    finish
                );
            },
            []
        );

    const setExportOptions =
        useCallback(
            (
                values:
                    Partial<
                        MAQuadroExportOptions
                    >
            ) => {
                setExportOptionsState(
                    (current) => ({
                        ...current,
                        ...values
                    })
                );
            },
            []
        );

    const runExport =
        useCallback(
            async () => {
                if (
                    interactionLocked()
                ) {
                    setStatusMessage(
                        'Aguarde pela conclusão da operação atual antes de exportar.'
                    );

                    return;
                }

                const captured =
                    captureCurrentPage();

                if (!captured) {
                    return;
                }

                const page =
                    getActiveProjectPage(
                        captured
                    );

                setBusy(
                    true
                );

                setStatusMessage(
                    'A preparar a exportação…'
                );

                try {
                    if (
                        exportOptions.format ===
                        'project'
                    ) {
                        exportMAQuadroProjectFile(
                            captured
                        );
                    } else if (
                        exportOptions.format ===
                        'pdf'
                    ) {
                        await exportMAQuadroPdf(
                            captured,

                            exportOptions.scope ===
                            'current'
                                ? [
                                    page.id
                                ]
                                : undefined
                        );
                    } else if (
                        exportOptions.format ===
                        'zip'
                    ) {
                        await exportMAQuadroPagesZip(
                            captured,
                            'png',
                            exportOptions.scale,

                            exportOptions.quality /
                            100
                        );
                    } else if (
                        exportOptions.format ===
                        'svg'
                    ) {
                        await exportMAQuadroPageSvg(
                            captured,
                            page
                        );
                    } else {
                        await exportMAQuadroPageImage(
                            captured,
                            page,
                            exportOptions.format,
                            exportOptions.scale,

                            exportOptions.quality /
                            100
                        );
                    }

                    setExportOpen(
                        false
                    );

                    setStatusMessage(
                        'Exportação concluída.'
                    );
                } catch (error) {
                    console.error(
                        error
                    );

                    setStatusMessage(
                        'Não foi possível concluir a exportação.'
                    );
                } finally {
                    setBusy(
                        false
                    );
                }
            },
            [
                captureCurrentPage,
                exportOptions,
                interactionLocked,
                setBusy
            ]
        );

    useEffect(() => {
        const handleKeyDown = (
            event:
                KeyboardEvent
        ) => {
            const canvas =
                canvasRef.current;

            const active =
                canvas
                    ?.getActiveObject() as
                    | MAQuadroFabricObject
                    | undefined;

            const modifier =
                event.ctrlKey ||
                event.metaKey;

            if (
                imageCropEditingRef
                    .current
            ) {
                if (
                    event.key ===
                    'Enter'
                ) {
                    event.preventDefault();

                    finishImageCrop();
                } else if (
                    event.key ===
                    'Escape'
                ) {
                    event.preventDefault();

                    cancelImageCrop();
                } else if (
                    modifier ||
                    event.key ===
                    'Delete' ||
                    event.key ===
                    'Backspace'
                ) {
                    event.preventDefault();
                }

                return;
            }

            if (
                event.code ===
                'Space' &&
                !targetIsFormControl(
                    event.target
                )
            ) {
                event.preventDefault();

                spacePressedRef.current =
                    true;

                setIsSpacePressed(
                    true
                );
            }

            if (
                targetIsFormControl(
                    event.target
                ) ||
                active?.isEditing
            ) {
                return;
            }

            const operationLocked =
                uploadLockRef.current ||
                structuralLockRef.current ||
                isLoadingRef.current ||
                isApplyingHistoryRef
                    .current ||
                busyCountRef.current >
                0;

            if (
                operationLocked
            ) {
                if (
                    modifier ||
                    event.key ===
                    'Delete' ||
                    event.key ===
                    'Backspace' ||
                    event.key.startsWith(
                        'Arrow'
                    )
                ) {
                    event.preventDefault();
                }

                return;
            }

            const key =
                event.key
                    .toLocaleLowerCase(
                        'pt-PT'
                    );

            if (
                modifier &&
                key ===
                'z'
            ) {
                event.preventDefault();

                void (
                    event.shiftKey
                        ? redo()
                        : undo()
                );
            } else if (
                modifier &&
                key ===
                'y'
            ) {
                event.preventDefault();

                void redo();
            } else if (
                modifier &&
                key ===
                'c'
            ) {
                event.preventDefault();

                void copySelection();
            } else if (
                modifier &&
                key ===
                'v'
            ) {
                event.preventDefault();

                void pasteSelection();
            } else if (
                modifier &&
                key ===
                'd'
            ) {
                event.preventDefault();

                void duplicateSelection();
            } else if (
                modifier &&
                key ===
                'a'
            ) {
                event.preventDefault();

                selectAll();
            } else if (
                modifier &&
                key ===
                's'
            ) {
                event.preventDefault();

                void saveProject(
                    false
                );
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
                    event.preventDefault();

                    deleteSelection();
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
                    );
                } else {
                    canvas
                        ?.discardActiveObject();

                    canvas
                        ?.requestRenderAll();

                    syncSelection();
                }
            } else if (
                event.key ===
                'ArrowLeft'
            ) {
                event.preventDefault();

                moveSelection(
                    event.shiftKey
                        ? -10
                        : -1,
                    0
                );
            } else if (
                event.key ===
                'ArrowRight'
            ) {
                event.preventDefault();

                moveSelection(
                    event.shiftKey
                        ? 10
                        : 1,
                    0
                );
            } else if (
                event.key ===
                'ArrowUp'
            ) {
                event.preventDefault();

                moveSelection(
                    0,

                    event.shiftKey
                        ? -10
                        : -1
                );
            } else if (
                event.key ===
                'ArrowDown'
            ) {
                event.preventDefault();

                moveSelection(
                    0,

                    event.shiftKey
                        ? 10
                        : 1
                );
            }
        };

        const handleKeyUp = (
            event:
                KeyboardEvent
        ) => {
            if (
                event.code ===
                'Space'
            ) {
                spacePressedRef.current =
                    false;

                setIsSpacePressed(
                    false
                );
            }
        };

        const handleBlur =
            () => {
                spacePressedRef.current =
                    false;

                setIsSpacePressed(
                    false
                );
            };

        window.addEventListener(
            'keydown',
            handleKeyDown
        );

        window.addEventListener(
            'keyup',
            handleKeyUp
        );

        window.addEventListener(
            'blur',
            handleBlur
        );

        return () => {
            window.removeEventListener(
                'keydown',
                handleKeyDown
            );

            window.removeEventListener(
                'keyup',
                handleKeyUp
            );

            window.removeEventListener(
                'blur',
                handleBlur
            );
        };
    }, [
        cancelImageCrop,
        copySelection,
        deleteSelection,
        duplicateSelection,
        finishImageCrop,
        moveSelection,
        pasteSelection,
        redo,
        saveProject,
        selectAll,
        setDrawingMode,
        syncSelection,
        undo
    ]);

    return {
        canvasElementRef,
        workspaceRef,
        imageInputRef,
        fontInputRef,
        projectInputRef,

        ready,
        busy,
        structureBusy,
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

        imageCropEditing,

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

        beginImageCrop,
        finishImageCrop,
        cancelImageCrop,

        setImageCropZoom,
        setImageCropPosition,
        setImageFrame,

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
    };
}
