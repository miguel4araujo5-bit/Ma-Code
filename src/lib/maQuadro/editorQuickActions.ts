import {
    FabricImage,
    FabricObject,
    Group,
    Line,
    Shadow,
    Textbox,
    Triangle,
    type Canvas
} from 'fabric';

import {
    applyMAQuadroLock,
    createMAQuadroImage,
    getMAQuadroObjectGradient,
    getMAQuadroObjectRole,
    getMAQuadroShapeKind,
    MA_QUADRO_SERIALIZED_PROPERTIES,
    setMAQuadroObjectFill,
    setMAQuadroObjectGradient,
    setMAQuadroObjectShadow,
    setMAQuadroObjectStroke,
    setMAQuadroObjectStrokeWidth,
    type MAQuadroFabricObject
} from './canvasObjects';

import {
    applyMAQuadroImageFrame,
    getMAQuadroCropViewportState,
    getMAQuadroImageFrameKind,
    setMAQuadroCropViewport
} from './editorEnhancements';

import {
    applyMAQuadroImageFilters,
    getMAQuadroImageFilters,
    resetMAQuadroImageCrop
} from './imageFilters';

export type MAQuadroStrokeStyle =
    | 'solid'
    | 'dashed'
    | 'dotted';

export type MAQuadroCopiedStyle = {
    opacity: number;
    fill: string | null;
    gradient: {
        from: string;
        to: string;
        angle: number;
    } | null;
    stroke: string | null;
    strokeWidth: number;
    strokeStyle:
        MAQuadroStrokeStyle;
    shadow: {
        color: string;
        blur: number;
        offsetX: number;
        offsetY: number;
    } | null;
    cornerRadius: number;
    text: {
        fontFamily: string;
        fontSize: number;
        fontWeight:
            | string
            | number;
        fontStyle: string;
        textAlign: string;
        lineHeight: number;
        charSpacing: number;
        underline: boolean;
        linethrough: boolean;
    } | null;
    image: {
        filters: ReturnType<
            typeof getMAQuadroImageFilters
        >;
        frame: ReturnType<
            typeof getMAQuadroImageFrameKind
        >;
    } | null;
    arrowHeadEnabled:
        boolean | null;
};

type MAQuadroQuickObject =
    MAQuadroFabricObject & {
        maAspectLocked?: boolean;
    };

const QUICK_ACTION_CUSTOM_PROPERTIES = [
    'maAspectLocked'
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
            ...QUICK_ACTION_CUSTOM_PROPERTIES
        ])
    );

for (
    const property
    of QUICK_ACTION_CUSTOM_PROPERTIES
) {
    if (
        !MA_QUADRO_SERIALIZED_PROPERTIES
            .includes(property)
    ) {
        MA_QUADRO_SERIALIZED_PROPERTIES
            .push(property);
    }
}

function colorToString(
    value: unknown
) {
    return typeof value ===
        'string'
        ? value
        : null;
}

function firstStyledObject(
    object:
        MAQuadroFabricObject
): MAQuadroFabricObject {
    if (
        object instanceof
        Group
    ) {
        const children =
            object.getObjects() as
                MAQuadroFabricObject[];

        const line =
            children.find(
                (child) =>
                    child instanceof
                    Line
            );

        return line ||
            children[0] ||
            object;
    }

    return object;
}

function shadowSnapshot(
    object:
        MAQuadroFabricObject
) {
    if (
        !(object.shadow instanceof
            Shadow)
    ) {
        return null;
    }

    return {
        color:
            object.shadow.color,
        blur:
            Number(
                object.shadow.blur ||
                0
            ),
        offsetX:
            Number(
                object.shadow.offsetX ||
                0
            ),
        offsetY:
            Number(
                object.shadow.offsetY ||
                0
            )
    };
}

function dashArrayForStyle(
    style:
        MAQuadroStrokeStyle,
    strokeWidth: number
) {
    const width =
        Math.max(
            1,
            Number.isFinite(
                strokeWidth
            )
                ? strokeWidth
                : 1
        );

    if (
        style ===
        'dashed'
    ) {
        return [
            width * 4,
            width * 2.4
        ];
    }

    if (
        style ===
        'dotted'
    ) {
        return [
            width,
            width * 1.8
        ];
    }

    return null;
}

function applyStrokeStyleToTree(
    object: MAQuadroFabricObject,
    style: MAQuadroStrokeStyle
): boolean {
    if (
        object instanceof
        Group
    ) {
        let changed = false;

        for (
            const child
            of object.getObjects()
        ) {
            const editorChild =
                child as
                    MAQuadroFabricObject;

          if (
    (object as Group & MAQuadroFabricObject).maShapeKind ===
    'arrow' &&
    !(editorChild instanceof Line)
) {
                continue;
            }

            changed =
                applyStrokeStyleToTree(
                    editorChild,
                    style
                ) ||
                changed;
        }

        object.setCoords();
        object.dirty = true;

        return changed;
    }

    const nextDash =
        dashArrayForStyle(
            style,
            Number(
                object.strokeWidth ||
                1
            )
        );

    const currentDash =
        object.strokeDashArray;

    const unchanged =
        nextDash === null
            ? !currentDash ||
                currentDash.length === 0
            : Boolean(
                currentDash &&
                currentDash.length ===
                nextDash.length &&
                currentDash.every(
                    (
                        value,
                        index
                    ) =>
                        Math.abs(
                            Number(value) -
                            nextDash[index]
                        ) < 0.001
                )
            );

    if (unchanged) {
        return false;
    }

    object.set({
        strokeDashArray:
            nextDash
    });

    object.setCoords();
    object.dirty = true;

    return true;
}

export function
getMAQuadroStrokeStyle(
    object:
        MAQuadroFabricObject
): MAQuadroStrokeStyle {
    const styled =
        firstStyledObject(
            object
        );

    const dash =
        styled.strokeDashArray;

    if (
        !dash ||
        dash.length === 0
    ) {
        return 'solid';
    }

    const first =
        Number(
            dash[0] ||
            0
        );

    const width =
        Math.max(
            1,
            Number(
                styled.strokeWidth ||
                1
            )
        );

    return first <=
        width * 1.5
        ? 'dotted'
        : 'dashed';
}

export function
setMAQuadroStrokeStyle(
    object:
        MAQuadroFabricObject,
    style:
        MAQuadroStrokeStyle
) {
    return applyStrokeStyleToTree(
        object,
        style
    );
}

export function
getMAQuadroArrowHeadEnabled(
    object:
        MAQuadroFabricObject
) {
    if (
        getMAQuadroShapeKind(
            object
        ) !== 'arrow' ||
        !(object instanceof Group)
    ) {
        return true;
    }

    const head =
        object
            .getObjects()
            .find(
                (child) =>
                    child instanceof
                    Triangle
            );

    return head
        ? head.visible !== false
        : false;
}

export function
setMAQuadroArrowHeadEnabled(
    object:
        MAQuadroFabricObject,
    enabled: boolean
) {
    if (
        getMAQuadroShapeKind(
            object
        ) !== 'arrow' ||
        !(object instanceof Group)
    ) {
        return false;
    }

    const heads =
        object
            .getObjects()
            .filter(
                (child) =>
                    child instanceof
                    Triangle
            );

    if (
        heads.length === 0
    ) {
        return false;
    }

    let changed = false;

    for (
        const head
        of heads
    ) {
        if (
            head.visible !==
            enabled
        ) {
            head.set({
                visible: enabled
            });

            changed = true;
        }
    }

    if (changed) {
        object.dirty = true;
        object.setCoords();
    }

    return changed;
}

export function
getMAQuadroAspectLocked(
    object:
        MAQuadroFabricObject
) {
    const editorObject =
        object as
            MAQuadroQuickObject;

    const locked =
        Boolean(
            editorObject
                .maAspectLocked
        );

    object.setControlsVisibility({
        ml: !locked,
        mr: !locked,
        mt: !locked,
        mb: !locked
    });

    return locked;
}

export function
setMAQuadroAspectLocked(
    object:
        MAQuadroFabricObject,
    locked: boolean
) {
    const editorObject =
        object as
            MAQuadroQuickObject;

    if (
        Boolean(
            editorObject
                .maAspectLocked
        ) === locked
    ) {
        getMAQuadroAspectLocked(
            object
        );

        return false;
    }

    editorObject.maAspectLocked =
        locked;

    object.setControlsVisibility({
        ml: !locked,
        mr: !locked,
        mt: !locked,
        mb: !locked
    });

    object.setCoords();

    return true;
}

export function
captureMAQuadroStyle(
    object:
        MAQuadroFabricObject
): MAQuadroCopiedStyle {
    const styled =
        firstStyledObject(
            object
        );

    const gradient =
        getMAQuadroObjectGradient(
            object
        );

    const text =
        object instanceof
        Textbox
            ? {
                fontFamily:
                    object.fontFamily ||
                    'Arial',
                fontSize:
                    Number(
                        object.fontSize ||
                        64
                    ),
                fontWeight:
                    object.fontWeight ||
                    '400',
                fontStyle:
                    object.fontStyle ||
                    'normal',
                textAlign:
                    object.textAlign ||
                    'left',
                lineHeight:
                    Number(
                        object.lineHeight ||
                        1.16
                    ),
                charSpacing:
                    Number(
                        object.charSpacing ||
                        0
                    ),
                underline:
                    Boolean(
                        object.underline
                    ),
                linethrough:
                    Boolean(
                        object.linethrough
                    )
            }
            : null;

    const image =
        object instanceof
        FabricImage
            ? {
                filters:
                    getMAQuadroImageFilters(
                        object as
                            FabricImage &
                            MAQuadroFabricObject
                    ),
                frame:
                    getMAQuadroImageFrameKind(
                        object as
                            FabricImage &
                            MAQuadroFabricObject
                    )
            }
            : null;

    return {
        opacity:
            Number(
                object.opacity ??
                1
            ),
        fill:
            colorToString(
                styled.fill
            ),
        gradient,
        stroke:
            colorToString(
                styled.stroke
            ),
        strokeWidth:
            Number(
                styled.strokeWidth ||
                0
            ),
        strokeStyle:
            getMAQuadroStrokeStyle(
                object
            ),
        shadow:
            shadowSnapshot(
                object
            ),
        cornerRadius:
            getMAQuadroShapeKind(
                object
            ) ===
            'rectangle'
                ? Number(
                    object.rx ||
                    0
                )
                : 0,
        text,
        image,
        arrowHeadEnabled:
            getMAQuadroShapeKind(
                object
            ) ===
            'arrow'
                ? getMAQuadroArrowHeadEnabled(
                    object
                )
                : null
    };
}

export function
applyMAQuadroCopiedStyle(
    object:
        MAQuadroFabricObject,
    style:
        MAQuadroCopiedStyle
) {
    const role =
        getMAQuadroObjectRole(
            object
        );

    object.set({
        opacity:
            Math.min(
                1,
                Math.max(
                    0,
                    style.opacity
                )
            )
    });

    if (style.shadow) {
        setMAQuadroObjectShadow(
            object,
            true,
            style.shadow.color,
            style.shadow.blur,
            style.shadow.offsetX,
            style.shadow.offsetY
        );
    } else {
        setMAQuadroObjectShadow(
            object,
            false,
            'rgba(15, 23, 42, 0.32)',
            0,
            0,
            0
        );
    }

    if (
        role !== 'image'
    ) {
        if (
            style.gradient &&
            role !== 'line' &&
            role !== 'arrow'
        ) {
            setMAQuadroObjectGradient(
                object,
                style.gradient.from,
                style.gradient.to,
                style.gradient.angle
            );
        } else if (
            style.fill !== null
        ) {
            setMAQuadroObjectFill(
                object,
                style.fill
            );
        }
    }

    if (
        style.stroke !== null
    ) {
        setMAQuadroObjectStroke(
            object,
            style.stroke
        );
    }

    setMAQuadroObjectStrokeWidth(
        object,
        style.strokeWidth
    );

    setMAQuadroStrokeStyle(
        object,
        style.strokeStyle
    );

    if (
        object instanceof
        Textbox &&
        style.text
    ) {
        object.set({
            fontFamily:
                style.text
                    .fontFamily,
            fontSize:
                style.text
                    .fontSize,
            fontWeight:
                style.text
                    .fontWeight,
            fontStyle:
                style.text
                    .fontStyle,
            textAlign:
                style.text
                    .textAlign,
            lineHeight:
                style.text
                    .lineHeight,
            charSpacing:
                style.text
                    .charSpacing,
            underline:
                style.text
                    .underline,
            linethrough:
                style.text
                    .linethrough
        });
    }

    if (
        getMAQuadroShapeKind(
            object
        ) ===
        'rectangle' &&
        style.cornerRadius >= 0
    ) {
        object.set({
            rx:
                style.cornerRadius,
            ry:
                style.cornerRadius
        });
    }

    if (
        object instanceof
        FabricImage &&
        style.image
    ) {
        const image =
            object as
                FabricImage &
                MAQuadroFabricObject;

        applyMAQuadroImageFilters(
            image,
            style.image.filters
        );

        applyMAQuadroImageFrame(
            image,
            style.image.frame
        );
    }

    if (
        style.arrowHeadEnabled !==
        null
    ) {
        setMAQuadroArrowHeadEnabled(
            object,
            style.arrowHeadEnabled
        );
    }

    object.dirty = true;
    object.setCoords();

    return true;
}

function cloneShadow(
    shadow: unknown
) {
    if (
        !(shadow instanceof
            Shadow)
    ) {
        return undefined;
    }

    return new Shadow({
        color:
            shadow.color,
        blur:
            shadow.blur,
        offsetX:
            shadow.offsetX,
        offsetY:
            shadow.offsetY
    });
}

export function
setMAQuadroImageAsBackground(
    canvas: Canvas,
    image:
        FabricImage &
        MAQuadroFabricObject
) {
    const sourceWidth =
        Math.max(
            1,
            Number(
                image.maOriginalWidth ||
                image.width ||
                1
            )
        );

    const sourceHeight =
        Math.max(
            1,
            Number(
                image.maOriginalHeight ||
                image.height ||
                1
            )
        );

    const scale =
        Math.max(
            canvas.getWidth() /
            sourceWidth,
            canvas.getHeight() /
            sourceHeight
        );

    resetMAQuadroImageCrop(
        image
    );

    image.set({
        clipPath: undefined,
        left:
            (
                canvas.getWidth() -
                sourceWidth * scale
            ) /
            2,
        top:
            (
                canvas.getHeight() -
                sourceHeight * scale
            ) /
            2,
        width:
            sourceWidth,
        height:
            sourceHeight,
        cropX: 0,
        cropY: 0,
        scaleX:
            scale,
        scaleY:
            scale,
        angle: 0,
        flipX: false,
        flipY: false
    });

    image.maName =
        image.maName?.includes(
            'fundo'
        )
            ? image.maName
            : `${image.maName || 'Imagem'} — fundo`;

    canvas.moveObjectTo(
        image,
        0
    );

    applyMAQuadroLock(
        image,
        true
    );

    canvas.discardActiveObject();
    canvas.requestRenderAll();

    return true;
}

export async function
replaceMAQuadroImage(
    canvas: Canvas,
    current:
        FabricImage &
        MAQuadroFabricObject,
    file: File
) {
    const frame =
        getMAQuadroImageFrameKind(
            current
        );

    const filters =
        getMAQuadroImageFilters(
            current
        );

    const viewport =
        getMAQuadroCropViewportState(
            current
        );

    const aspectLocked =
        getMAQuadroAspectLocked(
            current
        );

    const index =
        canvas
            .getObjects()
            .indexOf(
                current
            );

    const displayWidth =
        Math.max(
            1,
            Math.abs(
                Number(
                    current.width ||
                    1
                ) *
                Number(
                    current.scaleX ||
                    1
                )
            )
        );

    const displayHeight =
        Math.max(
            1,
            Math.abs(
                Number(
                    current.height ||
                    1
                ) *
                Number(
                    current.scaleY ||
                    1
                )
            )
        );

    const replacement =
        await createMAQuadroImage(
            canvas,
            file
        ) as
            FabricImage &
            MAQuadroFabricObject;

    const sourceWidth =
        Math.max(
            1,
            Number(
                replacement.maOriginalWidth ||
                replacement.width ||
                1
            )
        );

    const sourceHeight =
        Math.max(
            1,
            Number(
                replacement.maOriginalHeight ||
                replacement.height ||
                1
            )
        );

    replacement.set({
        left:
            current.left,
        top:
            current.top,
        originX:
            current.originX,
        originY:
            current.originY,
        angle:
            current.angle,
        skewX:
            current.skewX,
        skewY:
            current.skewY,
        flipX:
            current.flipX,
        flipY:
            current.flipY,
        opacity:
            current.opacity,
        stroke:
            current.stroke,
        strokeWidth:
            current.strokeWidth,
        strokeDashArray:
            current.strokeDashArray
                ? [
                    ...current.strokeDashArray
                ]
                : null,
        strokeDashOffset:
            current.strokeDashOffset,
        strokeLineCap:
            current.strokeLineCap,
        strokeLineJoin:
            current.strokeLineJoin,
        strokeMiterLimit:
            current.strokeMiterLimit,
        shadow:
            cloneShadow(
                current.shadow
            ),
        width:
            sourceWidth,
        height:
            sourceHeight,
        cropX: 0,
        cropY: 0,
        scaleX:
            displayWidth /
            sourceWidth,
        scaleY:
            displayHeight /
            sourceHeight
    });

    replacement.maId =
        current.maId;

    replacement.maName =
        current.maName;

    replacement.maRole =
        'image';

    applyMAQuadroImageFilters(
        replacement,
        filters
    );

    setMAQuadroCropViewport(
        replacement,
        viewport
    );

    applyMAQuadroImageFrame(
        replacement,
        frame
    );

    setMAQuadroAspectLocked(
        replacement,
        aspectLocked
    );

    canvas.discardActiveObject();

    canvas.remove(
        current
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

    replacement.setCoords();
    canvas.requestRenderAll();

    return replacement;
}
