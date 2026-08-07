import type {
    ChangeEvent,
    MutableRefObject,
    PointerEvent as ReactPointerEvent,
    WheelEvent as ReactWheelEvent
} from 'react';

import type {
    MAQuadroAlignAction,
    MAQuadroArrangeAction
} from '../../lib/maQuadro/canvasObjects';

import type {
    MAQuadroGuideState,
    MAQuadroImageFrameKind
} from '../../lib/maQuadro/editorEnhancements';

import type {
    MAQuadroBackground,
    MAQuadroBrand,
    MAQuadroCanvasPreset,
    MAQuadroExportFormat,
    MAQuadroExportScale,
    MAQuadroImageFilterState,
    MAQuadroObjectRole,
    MAQuadroPage,
    MAQuadroPanelId,
    MAQuadroProject,
    MAQuadroProjectCategory,
    MAQuadroResizeStrategy,
    MAQuadroSaveState,
    MAQuadroShapeKind,
    MAQuadroStoredFont,
    MAQuadroTextPreset
} from '../../types/maQuadro';

export type MAQuadroLayerItem = {
    id: string;
    name: string;
    type: string;
    visible: boolean;
    locked: boolean;
    active: boolean;
};

export type MAQuadroSelectionState = {
    count: number;

    role:
        | MAQuadroObjectRole
        | null;

    shapeKind:
        | MAQuadroShapeKind
        | null;

    name: string;
    fill: string;
    stroke: string;
    strokeWidth: number;
    opacity: number;

    x: number;
    y: number;
    width: number;
    height: number;
    angle: number;

    flipX: boolean;
    flipY: boolean;

    fontFamily: string;
    fontSize: number;
    fontWeight: string;
    fontStyle: string;
    textAlign: string;
    lineHeight: number;
    charSpacing: number;
    underline: boolean;
    linethrough: boolean;

    cornerRadius: number;

    shadowEnabled: boolean;
    shadowColor: string;
    shadowBlur: number;
    shadowOffsetX: number;
    shadowOffsetY: number;

    gradientEnabled: boolean;
    gradientFrom: string;
    gradientTo: string;
    gradientAngle: number;

    imageFilters:
        MAQuadroImageFilterState;

    cropHorizontal: number;
    cropVertical: number;

    cropZoom: number;
    cropPositionX: number;
    cropPositionY: number;

    imageFrame:
        MAQuadroImageFrameKind;
};

export type MAQuadroExportOptions = {
    format:
        MAQuadroExportFormat;

    scale:
        MAQuadroExportScale;

    quality: number;

    scope:
        | 'current'
        | 'all';
};

export type MAQuadroNewDesignValues = {
    width: number;
    height: number;
    name: string;

    category:
        MAQuadroProjectCategory;
};

export type MAQuadroEditor = {
    canvasElementRef:
        MutableRefObject<
            HTMLCanvasElement | null
        >;

    workspaceRef:
        MutableRefObject<
            HTMLDivElement | null
        >;

    imageInputRef:
        MutableRefObject<
            HTMLInputElement | null
        >;

    fontInputRef:
        MutableRefObject<
            HTMLInputElement | null
        >;

    projectInputRef:
        MutableRefObject<
            HTMLInputElement | null
        >;

    ready: boolean;
    busy: boolean;
    structureBusy: boolean;

    statusMessage: string;

    saveState:
        MAQuadroSaveState;

    project:
        MAQuadroProject | null;

    projects:
        MAQuadroProject[];

    activePage:
        MAQuadroPage | null;

    brand:
        MAQuadroBrand;

    localFonts:
        MAQuadroStoredFont[];

    availableFonts:
        Array<{
            name: string;
            family: string;
            fallback?: string;
        }>;

    layers:
        MAQuadroLayerItem[];

    selection:
        MAQuadroSelectionState;

    activePanel:
        MAQuadroPanelId;

    zoom: number;

    canUndo: boolean;
    canRedo: boolean;

    drawingMode: boolean;

    brushColor: string;
    brushWidth: number;

    showGrid: boolean;
    showSafeArea: boolean;

    guides:
        MAQuadroGuideState;

    isSpacePressed: boolean;

    exportOpen: boolean;
    newDesignOpen: boolean;

    imageCropEditing: boolean;

    exportOptions:
        MAQuadroExportOptions;

    presets:
        MAQuadroCanvasPreset[];

    setActivePanel: (
        panel:
            MAQuadroPanelId
    ) => void;

    setProjectName: (
        name: string
    ) => void;

    saveProject: (
        quiet?: boolean
    ) => Promise<boolean>;

    openProject: (
        projectId: string
    ) => Promise<void>;

    duplicateProject: (
        projectId: string
    ) => Promise<void>;

    deleteProject: (
        projectId: string
    ) => Promise<void>;

    saveProjectAsTemplate:
        () => Promise<void>;

    createFromPreset: (
        preset:
            MAQuadroCanvasPreset
    ) => Promise<void>;

    createCustomDesign: (
        values:
            MAQuadroNewDesignValues
    ) => Promise<void>;

    importProject: (
        event:
            ChangeEvent<HTMLInputElement>
    ) => Promise<void>;

    setActivePage: (
        pageId: string
    ) => Promise<void>;

    addPage:
        () => Promise<void>;

    duplicateActivePage:
        () => Promise<void>;

    deleteActivePage:
        () => Promise<void>;

    renamePage: (
        pageId: string,
        name: string
    ) => Promise<void>;

    movePage: (
        pageId: string,
        direction:
            | 'left'
            | 'right'
    ) => Promise<void>;

    resizeAllPages: (
        width: number,
        height: number,
        strategy?:
            MAQuadroResizeStrategy
    ) => Promise<void>;

    addText: (
        preset:
            MAQuadroTextPreset
    ) => void;

    addShape: (
        kind:
            MAQuadroShapeKind
    ) => void;

    addImages: (
        event:
            ChangeEvent<HTMLInputElement>
    ) => Promise<void>;

    handleDroppedFiles: (
        files:
            | FileList
            | File[]
    ) => Promise<void>;

    setDrawingMode: (
        enabled: boolean
    ) => void;

    setBrushColor: (
        color: string
    ) => void;

    setBrushWidth: (
        width: number
    ) => void;

    deleteSelection:
        () => void;

    duplicateSelection:
        () => Promise<void>;

    copySelection:
        () => Promise<void>;

    pasteSelection:
        () => Promise<void>;

    selectAll:
        () => void;

    groupSelection:
        () => void;

    ungroupSelection:
        () => void;

    alignSelection: (
        alignment:
            MAQuadroAlignAction
    ) => void;

    distributeSelection: (
        direction:
            | 'horizontal'
            | 'vertical'
    ) => void;

    arrangeSelection: (
        action:
            MAQuadroArrangeAction
    ) => void;

    moveSelection: (
        x: number,
        y: number
    ) => void;

    undo:
        () => Promise<void>;

    redo:
        () => Promise<void>;

    selectLayer: (
        layerId: string
    ) => void;

    toggleLayerVisibility: (
        layerId: string
    ) => void;

    toggleLayerLock: (
        layerId: string
    ) => void;

    moveLayer: (
        layerId: string,
        direction:
            | 'up'
            | 'down'
    ) => void;

    setSelectionName: (
        name: string
    ) => void;

    setSelectionFill: (
        color: string
    ) => void;

    setSelectionStroke: (
        color: string
    ) => void;

    setSelectionStrokeWidth: (
        width: number
    ) => void;

    setSelectionOpacity: (
        opacity: number
    ) => void;

    setSelectionGeometry: (
        field:
            | 'x'
            | 'y'
            | 'width'
            | 'height'
            | 'angle',
        value: number
    ) => void;

    setSelectionFlip: (
        axis:
            | 'x'
            | 'y'
    ) => void;

    setTextProperty: (
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
    ) => void;

    transformTextCase: (
        mode:
            | 'upper'
            | 'lower'
            | 'title'
    ) => void;

    setCornerRadius: (
        value: number
    ) => void;

    setShadow: (
        values:
            Partial<{
                enabled: boolean;
                color: string;
                blur: number;
                offsetX: number;
                offsetY: number;
            }>
    ) => void;

    setGradient: (
        values:
            Partial<{
                enabled: boolean;
                from: string;
                to: string;
                angle: number;
            }>
    ) => void;

    setImageFilters: (
        values:
            Partial<
                MAQuadroImageFilterState
            >
    ) => void;

    resetImageFilters:
        () => void;

    setImageCrop: (
        horizontal: number,
        vertical: number
    ) => void;

    resetImageCrop:
        () => void;

    beginImageCrop:
        () => void;

    finishImageCrop:
        () => void;

    cancelImageCrop:
        () => void;

    setImageCropZoom: (
        zoom: number
    ) => void;

    setImageCropPosition: (
        positionX: number,
        positionY: number
    ) => void;

    setImageFrame: (
        kind:
            MAQuadroImageFrameKind
    ) => void;

    removeImageBackground:
        () => Promise<void>;

    setBackground: (
        background:
            Partial<
                MAQuadroBackground
            >
    ) => void;

    applyBrandColor: (
        color: string
    ) => void;

    uploadFont: (
        event:
            ChangeEvent<HTMLInputElement>
    ) => Promise<void>;

    deleteFont: (
        fontId: string
    ) => Promise<void>;

    setZoom: (
        zoom: number
    ) => void;

    fitCanvas:
        () => void;

    toggleGrid:
        () => void;

    toggleSafeArea:
        () => void;

    onWorkspaceWheel: (
        event:
            ReactWheelEvent<HTMLDivElement>
    ) => void;

    onWorkspacePointerDown: (
        event:
            ReactPointerEvent<HTMLDivElement>
    ) => void;

    setExportOpen: (
        open: boolean
    ) => void;

    setNewDesignOpen: (
        open: boolean
    ) => void;

    setExportOptions: (
        values:
            Partial<
                MAQuadroExportOptions
            >
    ) => void;

    runExport:
        () => Promise<void>;
};
