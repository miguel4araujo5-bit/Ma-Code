import {
    ActiveSelection,
    Canvas,
    Circle,
    Ellipse,
    FabricImage,
    FabricObject,
    Gradient,
    config,
    Group,
    Line,
    PencilBrush,
    Point,
    Polygon,
    Rect,
    Shadow,
    StaticCanvas,
    Textbox,
    Triangle,
    util
} from 'fabric';

import type {
    MAQuadroBackground,
    MAQuadroCanvasJson,
    MAQuadroObjectRole,
    MAQuadroPage,
    MAQuadroResizeStrategy,
    MAQuadroShapeKind,
    MAQuadroTextPreset
} from '../../types/maQuadro';

import {
    createMAQuadroId,
    normalizeCanvasJson
} from './project';

export type MAQuadroFabricObject =
    FabricObject & {
        maId?: string;
        maName?: string;
        maRole?: MAQuadroObjectRole;
        maLocked?: boolean;
        maShapeKind?: MAQuadroShapeKind;
        maGradientAngle?: number;
        maSourceDataUrl?: string;
        maOriginalWidth?: number;
        maOriginalHeight?: number;
        maFilterBrightness?: number;
        maFilterContrast?: number;
        maFilterSaturation?: number;
        maFilterBlur?: number;
        maFilterGrayscale?: boolean;
        isEditing?: boolean;
        text?: string;
        fontFamily?: string;
        fontSize?: number;
        fontWeight?: string | number;
        fontStyle?: string;
        textAlign?: string;
        lineHeight?: number;
        charSpacing?: number;
        underline?: boolean;
        linethrough?: boolean;
        rx?: number;
        ry?: number;
        cropX?: number;
        cropY?: number;
    };

const customProperties = [
    'maId',
    'maName',
    'maRole',
    'maLocked',
    'maShapeKind',
    'maGradientAngle',
    'maOriginalWidth',
    'maOriginalHeight',
    'maFilterBrightness',
    'maFilterContrast',
    'maFilterSaturation',
    'maFilterBlur',
    'maFilterGrayscale'
];

const fabricObjectClass =
    FabricObject as unknown as {
        customProperties: string[];
    };

fabricObjectClass.customProperties =
    Array.from(
        new Set([
            ...(
                fabricObjectClass
                    .customProperties ||
                []
            ),
            ...customProperties
        ])
    );

config.NUM_FRACTION_DIGITS = 6;

export const
    MA_QUADRO_SERIALIZED_PROPERTIES =
        customProperties;

export type MAQuadroArrangeAction =
    | 'front'
    | 'forward'
    | 'backward'
    | 'back';

export type MAQuadroAlignAction =
    | 'left'
    | 'center-x'
    | 'right'
    | 'top'
    | 'center-y'
    | 'bottom';

export function objectOrigin() {
    return {
        originX: 'left' as const,
        originY: 'top' as const
    };
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
            Number.isFinite(value)
                ? value
                : minimum
        )
    );
}

function forEachObjectTree(
    object: MAQuadroFabricObject,
    operation: (
        item: MAQuadroFabricObject
    ) => void
) {
    operation(object);

    if (object instanceof Group) {
        for (
            const child
            of object.getObjects()
        ) {
            forEachObjectTree(
                child as
                    MAQuadroFabricObject,
                operation
            );
        }
    }
}

function inferShapeKind(
    object: MAQuadroFabricObject
): MAQuadroShapeKind | undefined {
    if (object.maShapeKind) {
        return object.maShapeKind;
    }

    if (
        object.maRole ===
        'arrow'
    ) {
        return 'arrow';
    }

    if (
        object.maRole ===
        'line' ||
        object instanceof Line
    ) {
        return 'line';
    }

    if (object instanceof Rect) {
        return 'rectangle';
    }

    if (object instanceof Circle) {
        return 'circle';
    }

    if (object instanceof Ellipse) {
        return 'ellipse';
    }

    if (object instanceof Triangle) {
        return 'triangle';
    }

    if (object instanceof Polygon) {
        return 'star';
    }

    return undefined;
}

export function getMAQuadroShapeKind(
    object: MAQuadroFabricObject
) {
    return inferShapeKind(object) || null;
}

export function prepareMAQuadroObject(
    object: MAQuadroFabricObject,
    role: MAQuadroObjectRole,
    name: string
) {
    object.maId ||=
        createMAQuadroId(
            'object'
        );

    object.maRole = role;

    object.maName ||=
        name;

    object.maShapeKind ||=
        inferShapeKind(object);

    object.set({
        transparentCorners: false,
        cornerColor: '#22D3EE',
        cornerStrokeColor: '#082F49',
        borderColor: '#22D3EE',
        cornerStyle: 'circle',
        cornerSize: 12,
        padding: 4,
        strokeUniform: true,
        snapAngle: 15,
        snapThreshold: 4
    });

    applyMAQuadroLock(
        object,
        Boolean(
            object.maLocked
        )
    );

    return object;
}

export function applyMAQuadroLock(
    object: MAQuadroFabricObject,
    locked: boolean
) {
    object.maLocked = locked;

    object.set({
        selectable: !locked,
        evented: !locked,
        lockMovementX: locked,
        lockMovementY: locked,
        lockRotation: locked,
        lockScalingX: locked,
        lockScalingY: locked,
        lockSkewingX: locked,
        lockSkewingY: locked
    });

    object.setCoords();
}

export function getMAQuadroObjectLabel(
    object: MAQuadroFabricObject,
    index = 0
) {
    if (object.maName) {
        return object.maName;
    }

    if (object instanceof Textbox) {
        const value =
            object.text?.trim() ||
            '';

        if (value) {
            return value.length > 28
                ? `${value.slice(0, 28)}…`
                : value;
        }
    }

    const names:
        Record<string, string> = {
            Textbox: 'Texto',
            IText: 'Texto',
            Text: 'Texto',
            FabricImage: 'Imagem',
            Image: 'Imagem',
            Rect: 'Retângulo',
            Circle: 'Círculo',
            Ellipse: 'Elipse',
            Triangle: 'Triângulo',
            Polygon: 'Polígono',
            Line: 'Linha',
            Group: 'Grupo',
            Path: 'Desenho'
        };

    return `${
        names[object.type] ||
        'Elemento'
    } ${index + 1}`;
}

export function getMAQuadroObjectRole(
    object: MAQuadroFabricObject
): MAQuadroObjectRole {
    if (object.maRole) {
        return object.maRole;
    }

    if (object instanceof Textbox) {
        return 'text';
    }

    if (object instanceof FabricImage) {
        return 'image';
    }

    if (object instanceof Group) {
        return 'group';
    }

    if (object instanceof Line) {
        return 'line';
    }

    if (
        object.type ===
        'Path'
    ) {
        return 'drawing';
    }

    return 'shape';
}

function normalizeLoadedObjectTree(
    object: MAQuadroFabricObject,
    index = 0
) {
    const role =
        getMAQuadroObjectRole(
            object
        );

    prepareMAQuadroObject(
        object,
        role,
        getMAQuadroObjectLabel(
            object,
            index
        )
    );

    if (object instanceof FabricImage) {
        object.maOriginalWidth ||=
            object.width ||
            1;

        object.maOriginalHeight ||=
            object.height ||
            1;

        object.maFilterBrightness ||=
            0;

        object.maFilterContrast ||=
            0;

        object.maFilterSaturation ||=
            0;

        object.maFilterBlur ||=
            0;

        object.maFilterGrayscale =
            Boolean(
                object.maFilterGrayscale
            );
    }

    if (object instanceof Group) {
        object
            .getObjects()
            .forEach(
                (
                    child,
                    childIndex
                ) => {
                    normalizeLoadedObjectTree(
                        child as
                            MAQuadroFabricObject,
                        childIndex
                    );
                }
            );
    }
}

export function serializeMAQuadroCanvas(
    canvas:
        | Canvas
        | StaticCanvas
): MAQuadroCanvasJson {
    return canvas.toJSON(
        MA_QUADRO_SERIALIZED_PROPERTIES
    ) as MAQuadroCanvasJson;
}

export async function
loadMAQuadroCanvasJson(
    canvas:
        | Canvas
        | StaticCanvas,
    canvasJson:
        MAQuadroCanvasJson
) {
    await canvas.loadFromJSON(
        normalizeCanvasJson(
            canvasJson
        )
    );

    canvas
        .getObjects()
        .forEach(
            (
                object,
                index
            ) => {
                normalizeLoadedObjectTree(
                    object as
                        MAQuadroFabricObject,
                    index
                );
            }
        );

    canvas.requestRenderAll();
}

export function
createMAQuadroBackgroundFill(
    background:
        MAQuadroBackground,
    width: number,
    height: number
) {
    if (
        background.type ===
        'transparent'
    ) {
        return '';
    }

    if (
        background.type ===
        'solid'
    ) {
        return background.color;
    }

    const angle =
        background.gradientAngle *
        Math.PI /
        180;

    const centerX =
        width / 2;

    const centerY =
        height / 2;

    const distance =
        Math.abs(
            width *
            Math.cos(angle)
        ) +
        Math.abs(
            height *
            Math.sin(angle)
        );

    const offsetX =
        Math.cos(angle) *
        distance /
        2;

    const offsetY =
        Math.sin(angle) *
        distance /
        2;

    return new Gradient({
        type: 'linear',
        gradientUnits: 'pixels',

        coords: {
            x1:
                centerX -
                offsetX,

            y1:
                centerY -
                offsetY,

            x2:
                centerX +
                offsetX,

            y2:
                centerY +
                offsetY
        },

        colorStops: [
            {
                offset: 0,
                color:
                    background
                        .gradientFrom
            },
            {
                offset: 1,
                color:
                    background
                        .gradientTo
            }
        ]
    });
}

export function
applyMAQuadroPageBackground(
    canvas:
        | Canvas
        | StaticCanvas,

    page:
        Pick<
            MAQuadroPage,
            | 'width'
            | 'height'
            | 'background'
        >
) {
    canvas.backgroundColor =
        createMAQuadroBackgroundFill(
            page.background,
            page.width,
            page.height
        );

    canvas.requestRenderAll();
}

const textConfigurations:
    Record<
        MAQuadroTextPreset,
        {
            name: string;
            text: string;
            fontSizeRatio: number;
            widthRatio: number;
            fontWeight: string;
            lineHeight: number;
            textAlign: string;
        }
    > = {
        heading: {
            name: 'Título',
            text: 'Escreva um título',
            fontSizeRatio: 0.09,
            widthRatio: 0.78,
            fontWeight: '700',
            lineHeight: 1.02,
            textAlign: 'center'
        },

        subheading: {
            name: 'Subtítulo',
            text: 'Escreva um subtítulo',
            fontSizeRatio: 0.052,
            widthRatio: 0.72,
            fontWeight: '600',
            lineHeight: 1.08,
            textAlign: 'center'
        },

        body: {
            name: 'Texto',
            text:
                'Adicione o seu texto aqui.',
            fontSizeRatio: 0.032,
            widthRatio: 0.66,
            fontWeight: '400',
            lineHeight: 1.28,
            textAlign: 'left'
        },

        caption: {
            name: 'Legenda',
            text:
                'Adicione uma legenda',
            fontSizeRatio: 0.022,
            widthRatio: 0.58,
            fontWeight: '400',
            lineHeight: 1.18,
            textAlign: 'center'
        }
    };

export function createMAQuadroText(
    canvas: Canvas,
    preset: MAQuadroTextPreset,
    fontFamily = 'Arial'
) {
    const configuration =
        textConfigurations[preset];

    const shortest =
        Math.min(
            canvas.getWidth(),
            canvas.getHeight()
        );

    const width =
        canvas.getWidth() *
        configuration.widthRatio;

    const object =
        new Textbox(
            configuration.text,
            {
                ...objectOrigin(),

                left:
                    (
                        canvas.getWidth() -
                        width
                    ) /
                    2,

                top:
                    canvas.getHeight() *
                    0.42,

                width,
                fill: '#0F172A',
                fontFamily,

                fontSize:
                    Math.max(
                        18,
                        shortest *
                        configuration
                            .fontSizeRatio
                    ),

                fontWeight:
                    configuration
                        .fontWeight,

                lineHeight:
                    configuration
                        .lineHeight,

                textAlign:
                    configuration
                        .textAlign,

                editable: true
            }
        ) as MAQuadroFabricObject;

    return prepareMAQuadroObject(
        object,
        'text',
        configuration.name
    );
}

function starPoints(
    outerRadius: number,
    innerRadius: number,
    points = 5
) {
    const result:
        Point[] = [];

    for (
        let index = 0;
        index < points * 2;
        index += 1
    ) {
        const radius =
            index % 2 === 0
                ? outerRadius
                : innerRadius;

        const angle =
            -Math.PI / 2 +
            index *
            Math.PI /
            points;

        result.push(
            new Point(
                Math.cos(angle) *
                radius,

                Math.sin(angle) *
                radius
            )
        );
    }

    return result;
}

function centerShape(
    canvas: Canvas,
    object:
        MAQuadroFabricObject
) {
    const bounds =
        object.getBoundingRect();

    object.set({
        left:
            (
                canvas.getWidth() -
                bounds.width
            ) /
            2,

        top:
            (
                canvas.getHeight() -
                bounds.height
            ) /
            2
    });

    object.setCoords();

    return object;
}

export function createMAQuadroShape(
    canvas: Canvas,
    kind: MAQuadroShapeKind,
    fill = '#22D3EE'
): MAQuadroFabricObject {
    const shortest =
        Math.min(
            canvas.getWidth(),
            canvas.getHeight()
        );

    const width =
        shortest * 0.34;

    const height =
        shortest * 0.24;

    let object:
        MAQuadroFabricObject;

    if (kind === 'rectangle') {
        object =
            new Rect({
                ...objectOrigin(),
                width,
                height,
                fill,
                strokeWidth: 0,

                rx:
                    shortest *
                    0.025,

                ry:
                    shortest *
                    0.025
            }) as MAQuadroFabricObject;

        prepareMAQuadroObject(
            object,
            'shape',
            'Retângulo'
        );
    } else if (
        kind === 'circle'
    ) {
        object =
            new Circle({
                ...objectOrigin(),

                radius:
                    shortest *
                    0.16,

                fill,
                strokeWidth: 0
            }) as MAQuadroFabricObject;

        prepareMAQuadroObject(
            object,
            'shape',
            'Círculo'
        );
    } else if (
        kind === 'ellipse'
    ) {
        object =
            new Ellipse({
                ...objectOrigin(),

                rx:
                    shortest *
                    0.2,

                ry:
                    shortest *
                    0.12,

                fill,
                strokeWidth: 0
            }) as MAQuadroFabricObject;

        prepareMAQuadroObject(
            object,
            'shape',
            'Elipse'
        );
    } else if (
        kind === 'triangle'
    ) {
        object =
            new Triangle({
                ...objectOrigin(),

                width:
                    shortest *
                    0.36,

                height:
                    shortest *
                    0.32,

                fill,
                strokeWidth: 0
            }) as MAQuadroFabricObject;

        prepareMAQuadroObject(
            object,
            'shape',
            'Triângulo'
        );
    } else if (
        kind === 'star'
    ) {
        object =
            new Polygon(
                starPoints(
                    shortest * 0.19,
                    shortest * 0.085
                ),
                {
                    ...objectOrigin(),
                    fill,
                    strokeWidth: 0
                }
            ) as MAQuadroFabricObject;

        prepareMAQuadroObject(
            object,
            'shape',
            'Estrela'
        );
    } else if (
        kind === 'line'
    ) {
        object =
            new Line(
                [
                    0,
                    0,

                    shortest *
                    0.48,

                    0
                ],
                {
                    ...objectOrigin(),
                    stroke: fill,

                    strokeWidth:
                        Math.max(
                            4,
                            shortest *
                            0.008
                        ),

                    fill
                }
            ) as MAQuadroFabricObject;

        prepareMAQuadroObject(
            object,
            'line',
            'Linha'
        );
    } else {
        const length =
            shortest * 0.5;

        const thickness =
            Math.max(
                6,
                shortest *
                0.012
            );

        const shaft =
            new Line(
                [
                    0,

                    thickness *
                    2.5,

                    length -
                    thickness *
                    3,

                    thickness *
                    2.5
                ],
                {
                    ...objectOrigin(),
                    stroke: fill,
                    strokeWidth:
                        thickness
                }
            ) as MAQuadroFabricObject;

        const head =
            new Triangle({
                ...objectOrigin(),

                left:
                    length -
                    thickness *
                    4,

                top: 0,

                width:
                    thickness *
                    5,

                height:
                    thickness *
                    5,

                angle: 90,
                fill,
                stroke: fill,
                strokeWidth: 0
            }) as MAQuadroFabricObject;

        prepareMAQuadroObject(
            shaft,
            'line',
            'Haste da seta'
        );

        prepareMAQuadroObject(
            head,
            'shape',
            'Ponta da seta'
        );

        object =
            new Group(
                [
                    shaft,
                    head
                ],
                {
                    ...objectOrigin()
                }
            ) as MAQuadroFabricObject;

        prepareMAQuadroObject(
            object,
            'arrow',
            'Seta'
        );
    }

    object.maShapeKind = kind;

    return centerShape(
        canvas,
        object
    );
}

function readFileAsDataUrl(
    file: File
) {
    return new Promise<string>(
        (
            resolve,
            reject
        ) => {
            const reader =
                new FileReader();

            reader.onload = () => {
                if (
                    typeof reader.result ===
                    'string'
                ) {
                    resolve(
                        reader.result
                    );

                    return;
                }

                reject(
                    new Error(
                        'Não foi possível ler a imagem.'
                    )
                );
            };

            reader.onerror = () =>
                reject(
                    reader.error ||
                    new Error(
                        'Não foi possível ler a imagem.'
                    )
                );

            reader.readAsDataURL(
                file
            );
        }
    );
}

export async function
createMAQuadroImage(
    canvas: Canvas,
    file: File
) {
    if (
        !file.type.startsWith(
            'image/'
        )
    ) {
        throw new Error(
            'O ficheiro selecionado não é uma imagem.'
        );
    }

    if (
        file.size >
        25 * 1024 * 1024
    ) {
        throw new Error(
            'A imagem ultrapassa o limite de 25 MB.'
        );
    }

    const dataUrl =
        await readFileAsDataUrl(
            file
        );

    const image =
        await FabricImage.fromURL(
            dataUrl
        ) as
            FabricImage &
            MAQuadroFabricObject;

    const originalWidth =
        Math.max(
            1,
            image.width ||
            1
        );

    const originalHeight =
        Math.max(
            1,
            image.height ||
            1
        );

    if (
        originalWidth *
        originalHeight >
        50_000_000
    ) {
        throw new Error(
            'A imagem tem demasiados píxeis para ser usada com segurança.'
        );
    }

    const scale =
        Math.min(
            canvas.getWidth() *
            0.72 /
            originalWidth,

            canvas.getHeight() *
            0.72 /
            originalHeight,

            1
        );

    image.set({
        ...objectOrigin(),

        left:
            (
                canvas.getWidth() -
                originalWidth *
                scale
            ) /
            2,

        top:
            (
                canvas.getHeight() -
                originalHeight *
                scale
            ) /
            2,

        scaleX: scale,
        scaleY: scale
    });

    image.maSourceDataUrl =
        dataUrl;

    image.maOriginalWidth =
        originalWidth;

    image.maOriginalHeight =
        originalHeight;

    image.maFilterBrightness = 0;
    image.maFilterContrast = 0;
    image.maFilterSaturation = 0;
    image.maFilterBlur = 0;

    image.maFilterGrayscale =
        false;

    return prepareMAQuadroObject(
        image,
        'image',
        file.name
    );
}

export function
setMAQuadroObjectShadow(
    object:
        MAQuadroFabricObject,

    enabled: boolean,

    color =
        'rgba(15, 23, 42, 0.32)',

    blur = 24,
    offsetX = 0,
    offsetY = 12
) {
    object.set({
        shadow:
            enabled
                ? new Shadow({
                    color,

                    blur:
                        Math.max(
                            0,
                            blur
                        ),

                    offsetX,
                    offsetY
                })
                : undefined
    });

    object.setCoords();

    return true;
}

function gradientAngleFromFill(
    fill: Gradient,
    fallback = 45
) {
    const coords =
        fill.coords as unknown as {
            x1?: number;
            y1?: number;
            x2?: number;
            y2?: number;
        };

    const x1 =
        Number(coords.x1);

    const y1 =
        Number(coords.y1);

    const x2 =
        Number(coords.x2);

    const y2 =
        Number(coords.y2);

    if (
        ![
            x1,
            y1,
            x2,
            y2
        ].every(
            Number.isFinite
        )
    ) {
        return fallback;
    }

    return (
        Math.atan2(
            y2 - y1,
            x2 - x1
        ) *
        180 /
        Math.PI +
        360
    ) % 360;
}

export function
getMAQuadroObjectGradient(
    object:
        MAQuadroFabricObject
): {
    from: string;
    to: string;
    angle: number;
} | null {
    if (
        object.fill instanceof
        Gradient
    ) {
        const stops =
            object.fill.colorStops ||
            [];

        return {
            from:
                stops[0]?.color ||
                '#22D3EE',

            to:
                stops[
                    stops.length - 1
                ]?.color ||
                '#8B5CF6',

            angle:
                object.maGradientAngle ??
                gradientAngleFromFill(
                    object.fill
                )
        };
    }

    if (object instanceof Group) {
        for (
            const child
            of object.getObjects()
        ) {
            const gradient =
                getMAQuadroObjectGradient(
                    child as
                        MAQuadroFabricObject
                );

            if (gradient) {
                return gradient;
            }
        }
    }

    return null;
}

export function
setMAQuadroObjectGradient(
    object:
        MAQuadroFabricObject,

    from: string,
    to: string,
    angle = 45
): boolean {
    if (
        object instanceof
        FabricImage ||
        getMAQuadroObjectRole(
            object
        ) === 'line' ||
        getMAQuadroObjectRole(
            object
        ) === 'arrow'
    ) {
        return false;
    }

    if (object instanceof Group) {
        let changed = false;

        for (
            const child
            of object.getObjects()
        ) {
            changed =
                setMAQuadroObjectGradient(
                    child as
                        MAQuadroFabricObject,
                    from,
                    to,
                    angle
                ) ||
                changed;
        }

        object.setCoords();

        return changed;
    }

    const width =
        Math.max(
            1,
            object.width ||
            object.getScaledWidth() ||
            1
        );

    const height =
        Math.max(
            1,
            object.height ||
            object.getScaledHeight() ||
            1
        );

    const radians =
        angle *
        Math.PI /
        180;

    const centerX =
        width / 2;

    const centerY =
        height / 2;

    const distance =
        Math.abs(
            width *
            Math.cos(radians)
        ) +
        Math.abs(
            height *
            Math.sin(radians)
        );

    const offsetX =
        Math.cos(radians) *
        distance /
        2;

    const offsetY =
        Math.sin(radians) *
        distance /
        2;

    object.maGradientAngle =
        (
            (
                angle % 360
            ) +
            360
        ) %
        360;

    object.set({
        fill:
            new Gradient({
                type: 'linear',
                gradientUnits:
                    'pixels',

                coords: {
                    x1:
                        centerX -
                        offsetX,

                    y1:
                        centerY -
                        offsetY,

                    x2:
                        centerX +
                        offsetX,

                    y2:
                        centerY +
                        offsetY
                },

                colorStops: [
                    {
                        offset: 0,
                        color: from
                    },
                    {
                        offset: 1,
                        color: to
                    }
                ]
            })
    });

    object.setCoords();

    return true;
}

export function
setMAQuadroObjectFill(
    object:
        MAQuadroFabricObject,

    color: string
): boolean {
    const role =
        getMAQuadroObjectRole(
            object
        );

    if (role === 'image') {
        return false;
    }

    if (object instanceof Group) {
        let changed = false;

        for (
            const child
            of object.getObjects()
        ) {
            changed =
                setMAQuadroObjectFill(
                    child as
                        MAQuadroFabricObject,
                    color
                ) ||
                changed;
        }

        object.setCoords();

        return changed;
    }

    object.maGradientAngle =
        undefined;

    if (role === 'line') {
        object.set({
            stroke: color,
            fill: color
        });
    } else {
        object.set({
            fill: color
        });
    }

    object.setCoords();

    return true;
}

export function
setMAQuadroObjectStroke(
    object:
        MAQuadroFabricObject,

    color: string
): boolean {
    if (
        getMAQuadroObjectRole(
            object
        ) === 'image'
    ) {
        return false;
    }

    if (object instanceof Group) {
        let changed = false;

        for (
            const child
            of object.getObjects()
        ) {
            changed =
                setMAQuadroObjectStroke(
                    child as
                        MAQuadroFabricObject,
                    color
                ) ||
                changed;
        }

        object.setCoords();

        return changed;
    }

    object.set({
        stroke: color
    });

    object.setCoords();

    return true;
}

export function
setMAQuadroObjectStrokeWidth(
    object:
        MAQuadroFabricObject,

    width: number
): boolean {
    if (
        getMAQuadroObjectRole(
            object
        ) === 'image'
    ) {
        return false;
    }

    if (object instanceof Group) {
        let changed = false;

        for (
            const child
            of object.getObjects()
        ) {
            changed =
                setMAQuadroObjectStrokeWidth(
                    child as
                        MAQuadroFabricObject,
                    width
                ) ||
                changed;
        }

        object.setCoords();

        return changed;
    }

    object.set({
        strokeWidth:
            Math.max(
                0,
                width
            )
    });

    object.setCoords();

    return true;
}

export function
configureMAQuadroBrush(
    canvas: Canvas,
    color: string,
    width: number
) {
    const brush =
        new PencilBrush(
            canvas
        );

    brush.color = color;
    brush.width = width;
    brush.decimate = 2;

    canvas.freeDrawingBrush =
        brush;
}

export function
groupMAQuadroSelection(
    canvas: Canvas
) {
    const active =
        canvas.getActiveObject();

    if (
        !(
            active instanceof
            ActiveSelection
        )
    ) {
        return null;
    }

    const objects =
        active.removeAll() as
            MAQuadroFabricObject[];

    canvas.discardActiveObject();

    canvas.remove(
        ...objects
    );

    const group =
        new Group(
            objects,
            {
                ...objectOrigin()
            }
        ) as MAQuadroFabricObject;

    prepareMAQuadroObject(
        group,
        'group',
        'Grupo'
    );

    canvas.add(group);

    canvas.setActiveObject(
        group
    );

    canvas.requestRenderAll();

    return group;
}

export function
ungroupMAQuadroSelection(
    canvas: Canvas
) {
    const active =
        canvas.getActiveObject();

    if (
        !(
            active instanceof
            Group
        ) ||
        active instanceof
        ActiveSelection
    ) {
        return null;
    }

    const group =
        active as
            MAQuadroFabricObject;

    const groupMatrix =
        active.calcTransformMatrix();

    const objects =
        active.removeAll() as
            MAQuadroFabricObject[];

    canvas.discardActiveObject();

    canvas.remove(group);

    for (
        const object
        of objects
    ) {
        util.sendObjectToPlane(
            object,
            groupMatrix
        );

        prepareMAQuadroObject(
            object,
            getMAQuadroObjectRole(
                object
            ),
            getMAQuadroObjectLabel(
                object
            )
        );

        object.setCoords();
    }

    canvas.add(
        ...objects
    );

    const selection =
        new ActiveSelection(
            objects,
            {
                canvas
            }
        );

    canvas.setActiveObject(
        selection
    );

    canvas.requestRenderAll();

    return selection;
}

export function
selectAllMAQuadroObjects(
    canvas: Canvas
) {
    const objects =
        canvas
            .getObjects()
            .filter(
                (object) =>
                    object.visible !==
                    false
            )
            .filter(
                (object) =>
                    !(
                        object as
                            MAQuadroFabricObject
                    ).maLocked
            );

    if (objects.length === 0) {
        return false;
    }

    canvas.setActiveObject(
        new ActiveSelection(
            objects,
            {
                canvas
            }
        )
    );

    canvas.requestRenderAll();

    return true;
}

export function
arrangeMAQuadroObject(
    canvas: Canvas,
    object:
        MAQuadroFabricObject,
    action:
        MAQuadroArrangeAction
) {
    const objects =
        canvas.getObjects();

    const index =
        objects.indexOf(
            object
        );

    if (index < 0) {
        return false;
    }

    let target = index;

    if (action === 'front') {
        target =
            objects.length - 1;
    } else if (
        action === 'forward'
    ) {
        target =
            Math.min(
                objects.length - 1,
                index + 1
            );
    } else if (
        action === 'backward'
    ) {
        target =
            Math.max(
                0,
                index - 1
            );
    } else {
        target = 0;
    }

    if (target === index) {
        return false;
    }

    canvas.moveObjectTo(
        object,
        target
    );

    canvas.requestRenderAll();

    return true;
}

function selectionBounds(
    objects:
        MAQuadroFabricObject[]
) {
    const bounds =
        objects.map(
            (object) =>
                object.getBoundingRect()
        );

    const left =
        Math.min(
            ...bounds.map(
                (item) =>
                    item.left
            )
        );

    const top =
        Math.min(
            ...bounds.map(
                (item) =>
                    item.top
            )
        );

    const right =
        Math.max(
            ...bounds.map(
                (item) =>
                    item.left +
                    item.width
            )
        );

    const bottom =
        Math.max(
            ...bounds.map(
                (item) =>
                    item.top +
                    item.height
            )
        );

    return {
        left,
        top,
        width:
            right - left,
        height:
            bottom - top
    };
}

export function
alignMAQuadroSelection(
    canvas: Canvas,
    object:
        MAQuadroFabricObject,
    alignment:
        MAQuadroAlignAction
) {
    const selected =
        canvas.getActiveObjects() as
            MAQuadroFabricObject[];

    if (selected.length > 1) {
        const reference =
            selectionBounds(
                selected
            );

        let changed = false;

        for (
            const item
            of selected
        ) {
            if (item.maLocked) {
                continue;
            }

            const bounds =
                item.getBoundingRect();

            let deltaX = 0;
            let deltaY = 0;

            if (
                alignment ===
                'left'
            ) {
                deltaX =
                    reference.left -
                    bounds.left;
            } else if (
                alignment ===
                'center-x'
            ) {
                deltaX =
                    reference.left +
                    reference.width /
                    2 -
                    (
                        bounds.left +
                        bounds.width /
                        2
                    );
            } else if (
                alignment ===
                'right'
            ) {
                deltaX =
                    reference.left +
                    reference.width -
                    (
                        bounds.left +
                        bounds.width
                    );
            } else if (
                alignment ===
                'top'
            ) {
                deltaY =
                    reference.top -
                    bounds.top;
            } else if (
                alignment ===
                'center-y'
            ) {
                deltaY =
                    reference.top +
                    reference.height /
                    2 -
                    (
                        bounds.top +
                        bounds.height /
                        2
                    );
            } else {
                deltaY =
                    reference.top +
                    reference.height -
                    (
                        bounds.top +
                        bounds.height
                    );
            }

            if (
                Math.abs(deltaX) >
                0.001 ||
                Math.abs(deltaY) >
                0.001
            ) {
                item.set({
                    left:
                        (
                            item.left ||
                            0
                        ) +
                        deltaX,

                    top:
                        (
                            item.top ||
                            0
                        ) +
                        deltaY
                });

                item.setCoords();

                changed = true;
            }
        }

        if (changed) {
            canvas.requestRenderAll();
        }

        return changed;
    }

    const bounds =
        object.getBoundingRect();

    let deltaX = 0;
    let deltaY = 0;

    if (alignment === 'left') {
        deltaX =
            -bounds.left;
    } else if (
        alignment ===
        'center-x'
    ) {
        deltaX =
            canvas.getWidth() /
            2 -
            (
                bounds.left +
                bounds.width /
                2
            );
    } else if (
        alignment ===
        'right'
    ) {
        deltaX =
            canvas.getWidth() -
            (
                bounds.left +
                bounds.width
            );
    } else if (
        alignment ===
        'top'
    ) {
        deltaY =
            -bounds.top;
    } else if (
        alignment ===
        'center-y'
    ) {
        deltaY =
            canvas.getHeight() /
            2 -
            (
                bounds.top +
                bounds.height /
                2
            );
    } else {
        deltaY =
            canvas.getHeight() -
            (
                bounds.top +
                bounds.height
            );
    }

    if (
        Math.abs(deltaX) <=
        0.001 &&
        Math.abs(deltaY) <=
        0.001
    ) {
        return false;
    }

    object.set({
        left:
            (
                object.left ||
                0
            ) +
            deltaX,

        top:
            (
                object.top ||
                0
            ) +
            deltaY
    });

    object.setCoords();

    canvas.requestRenderAll();

    return true;
}

export function
distributeMAQuadroSelection(
    canvas: Canvas,
    direction:
        | 'horizontal'
        | 'vertical'
) {
    const objects =
        canvas.getActiveObjects() as
            MAQuadroFabricObject[];

    if (objects.length < 3) {
        return false;
    }

    const sorted =
        [...objects].sort(
            (
                first,
                second
            ) => {
                const firstBounds =
                    first
                        .getBoundingRect();

                const secondBounds =
                    second
                        .getBoundingRect();

                return direction ===
                    'horizontal'
                    ? firstBounds.left -
                        secondBounds.left
                    : firstBounds.top -
                        secondBounds.top;
            }
        );

    const firstBounds =
        sorted[0]
            .getBoundingRect();

    const lastBounds =
        sorted[
            sorted.length - 1
        ].getBoundingRect();

    const totalObjectSize =
        sorted.reduce(
            (
                total,
                item
            ) => {
                const bounds =
                    item.getBoundingRect();

                return total +
                    (
                        direction ===
                        'horizontal'
                            ? bounds.width
                            : bounds.height
                    );
            },
            0
        );

    const available =
        direction ===
        'horizontal'
            ? (
                lastBounds.left +
                lastBounds.width -
                firstBounds.left
            )
            : (
                lastBounds.top +
                lastBounds.height -
                firstBounds.top
            );

    const gap =
        (
            available -
            totalObjectSize
        ) /
        (
            sorted.length - 1
        );

    let cursor =
        direction ===
        'horizontal'
            ? (
                firstBounds.left +
                firstBounds.width +
                gap
            )
            : (
                firstBounds.top +
                firstBounds.height +
                gap
            );

    let changed = false;

    for (
        let index = 1;
        index <
        sorted.length - 1;
        index += 1
    ) {
        const item =
            sorted[index];

        if (item.maLocked) {
            continue;
        }

        const bounds =
            item.getBoundingRect();

        if (
            direction ===
            'horizontal'
        ) {
            const delta =
                cursor -
                bounds.left;

            item.left += delta;

            cursor +=
                bounds.width +
                gap;

            changed =
                changed ||
                Math.abs(delta) >
                0.001;
        } else {
            const delta =
                cursor -
                bounds.top;

            item.top += delta;

            cursor +=
                bounds.height +
                gap;

            changed =
                changed ||
                Math.abs(delta) >
                0.001;
        }

        item.setCoords();
    }

    if (changed) {
        canvas.requestRenderAll();
    }

    return changed;
}

export function
getMAQuadroObjectGeometry(
    object:
        MAQuadroFabricObject
) {
    const bounds =
        object.getBoundingRect();

    return {
        x:
            Math.round(
                bounds.left
            ),

        y:
            Math.round(
                bounds.top
            ),

        width:
            Math.round(
                bounds.width
            ),

        height:
            Math.round(
                bounds.height
            ),

        angle:
            Math.round(
                object.angle ||
                0
            )
    };
}

export function
setMAQuadroObjectGeometry(
    object:
        MAQuadroFabricObject,

    values:
        Partial<{
            x: number;
            y: number;
            width: number;
            height: number;
            angle: number;
        }>
) {
    const bounds =
        object.getBoundingRect();

    if (
        typeof values.x ===
        'number' &&
        Number.isFinite(
            values.x
        )
    ) {
        object.left +=
            values.x -
            bounds.left;
    }

    if (
        typeof values.y ===
        'number' &&
        Number.isFinite(
            values.y
        )
    ) {
        object.top +=
            values.y -
            bounds.top;
    }

    if (
        typeof values.width ===
        'number' &&
        Number.isFinite(
            values.width
        ) &&
        values.width > 0
    ) {
        if (
            object instanceof
            Textbox
        ) {
            object.set({
                width:
                    values.width /
                    Math.max(
                        0.0001,
                        Math.abs(
                            object.scaleX ||
                            1
                        )
                    )
            });
        } else {
            object.scaleX *=
                values.width /
                Math.max(
                    0.0001,
                    bounds.width
                );
        }
    }

    if (
        typeof values.height ===
        'number' &&
        Number.isFinite(
            values.height
        ) &&
        values.height > 0 &&
        !(
            object instanceof
            Textbox
        )
    ) {
        object.scaleY *=
            values.height /
            Math.max(
                0.0001,
                bounds.height
            );
    }

    if (
        typeof values.angle ===
        'number' &&
        Number.isFinite(
            values.angle
        )
    ) {
        object.set({
            angle:
                values.angle
        });
    }

    object.setCoords();
}

export async function
resizeMAQuadroCanvasJson(
    canvasJson:
        MAQuadroCanvasJson,

    oldWidth: number,
    oldHeight: number,
    newWidth: number,
    newHeight: number,

    strategy:
        MAQuadroResizeStrategy =
        'scale'
) {
    const element =
        document.createElement(
            'canvas'
        );

    const canvas =
        new StaticCanvas(
            element,
            {
                width:
                    Math.max(
                        1,
                        oldWidth
                    ),

                height:
                    Math.max(
                        1,
                        oldHeight
                    ),

                renderOnAddRemove:
                    false
            }
        );

    try {
        await loadMAQuadroCanvasJson(
            canvas,
            canvasJson
        );

        const scaleX =
            newWidth /
            Math.max(
                1,
                oldWidth
            );

        const scaleY =
            newHeight /
            Math.max(
                1,
                oldHeight
            );

        const uniformScale =
            Math.min(
                scaleX,
                scaleY
            );

        const offsetX =
            (
                newWidth -
                oldWidth *
                uniformScale
            ) /
            2;

        const offsetY =
            (
                newHeight -
                oldHeight *
                uniformScale
            ) /
            2;

        const centerOffsetX =
            (
                newWidth -
                oldWidth
            ) /
            2;

        const centerOffsetY =
            (
                newHeight -
                oldHeight
            ) /
            2;

        for (
            const object
            of canvas.getObjects()
        ) {
            const item =
                object as
                    MAQuadroFabricObject;

            if (
                strategy ===
                'scale'
            ) {
                item.set({
                    left:
                        (
                            item.left ||
                            0
                        ) *
                        uniformScale +
                        offsetX,

                    top:
                        (
                            item.top ||
                            0
                        ) *
                        uniformScale +
                        offsetY,

                    scaleX:
                        (
                            item.scaleX ||
                            1
                        ) *
                        uniformScale,

                    scaleY:
                        (
                            item.scaleY ||
                            1
                        ) *
                        uniformScale
                });
            } else if (
                strategy ===
                'center'
            ) {
                item.set({
                    left:
                        (
                            item.left ||
                            0
                        ) +
                        centerOffsetX,

                    top:
                        (
                            item.top ||
                            0
                        ) +
                        centerOffsetY
                });
            }

            item.setCoords();
        }

        canvas.setDimensions({
            width:
                newWidth,

            height:
                newHeight
        });

        return serializeMAQuadroCanvas(
            canvas
        );
    } finally {
        await canvas.dispose();
    }
}
