export type MAQuadroCanvasJson = Record<string, unknown>;

export type MAQuadroBrandColor = {
    name: string;
    value: string;
};

export type MAQuadroBrandFont = {
    name: string;
    family: string;
    fallback?: string;
};

export type MAQuadroBrand = {
    name: string;
    colors: MAQuadroBrandColor[];
    fonts: MAQuadroBrandFont[];
};

export type MAQuadroStoredBrandKit = {
    id: string;
    name: string;
    colors: MAQuadroBrandColor[];
    fonts: MAQuadroBrandFont[];
    createdAt: string;
    updatedAt: string;
};

export type MAQuadroCanvasPreset = {
    id: string;
    name: string;
    description: string;
    width: number;
    height: number;
    category: MAQuadroProjectCategory;
};

export type MAQuadroBackgroundType =
    | 'solid'
    | 'transparent'
    | 'gradient';

export type MAQuadroBackground = {
    type: MAQuadroBackgroundType;
    color: string;
    gradientFrom: string;
    gradientTo: string;
    gradientAngle: number;
};

export type MAQuadroPage = {
    id: string;
    name: string;
    width: number;
    height: number;
    background: MAQuadroBackground;
    canvasJson: MAQuadroCanvasJson;
    thumbnail?: string;
};

export type MAQuadroProjectCategory =
    | 'social'
    | 'story'
    | 'presentation'
    | 'print'
    | 'invitation'
    | 'custom';

export type MAQuadroProject = {
    schemaVersion: 2;
    id: string;
    name: string;
    pages: MAQuadroPage[];
    activePageId: string;
    category: MAQuadroProjectCategory;
    isTemplate: boolean;
    createdAt: string;
    updatedAt: string;
};

export type MAQuadroStoredFont = {
    id: string;
    family: string;
    fileName: string;
    mimeType: string;
    data: ArrayBuffer;
    createdAt: string;
};

export type MAQuadroStoredLogo = {
    id: string;
    name: string;
    fileName: string;
    mimeType: string;
    data: ArrayBuffer;
    size: number;
    brandKitId?: string;
    createdAt: string;
};

export type MAQuadroStoredImage = {
    id: string;
    name: string;
    fileName: string;
    mimeType: string;
    data: ArrayBuffer;
    size: number;
    collectionId?: string;
    createdAt: string;
};

export type MAQuadroStoredVideo = {
    id: string;
    name: string;
    fileName: string;
    mimeType: string;
    data: ArrayBuffer;
    size: number;
    durationMs: number;
    width: number;
    height: number;
    posterDataUrl: string;
    trimStartMs?: number;
    trimEndMs?: number;
    createdAt: string;
};

export type MAQuadroHistorySnapshot = {
    pageId: string;
    background: MAQuadroBackground;
    canvasJson: MAQuadroCanvasJson;
};

export type MAQuadroExportScale =
    | 1
    | 2
    | 3;

export type MAQuadroExportFormat =
    | 'png'
    | 'jpg'
    | 'svg'
    | 'pdf'
    | 'zip'
    | 'project';

export type MAQuadroImageFilterState = {
    brightness: number;
    contrast: number;
    saturation: number;
    blur: number;
    grayscale: boolean;

    temperature: number;
    hue: number;
    fade: number;

    shadows: number;
    highlights: number;
    vignette: number;
    duotoneEnabled: boolean;
    duotoneShadows: string;
    duotoneHighlights: string;
};

export type MAQuadroObjectRole =
    | 'text'
    | 'shape'
    | 'image'
    | 'line'
    | 'arrow'
    | 'drawing'
    | 'group';

export type MAQuadroTextPreset =
    | 'heading'
    | 'subheading'
    | 'body'
    | 'caption';

export type MAQuadroShapeKind =
    | 'rectangle'
    | 'circle'
    | 'ellipse'
    | 'triangle'
    | 'star'
    | 'line'
    | 'arrow';

export type MAQuadroResizeStrategy =
    | 'scale'
    | 'keep'
    | 'center';

export type MAQuadroPanelId =
    | 'templates'
    | 'elements'
    | 'uploads'
    | 'text'
    | 'brand'
    | 'projects';

export type MAQuadroSaveState =
    | 'ready'
    | 'dirty'
    | 'saving'
    | 'saved'
    | 'error';
