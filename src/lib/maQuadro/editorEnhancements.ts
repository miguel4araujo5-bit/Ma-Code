import {
    Canvas,
    Circle,
    Ellipse,
    FabricImage,
    Polygon,
    Rect,
    Triangle
} from 'fabric';

import type {
    MAQuadroFabricObject
} from './canvasObjects';

export type MAQuadroImageFrameKind =
    | 'none'
    | 'rounded'
    | 'circle'
    | 'ellipse'
    | 'triangle'
    | 'star';

export type MAQuadroGuideState = {
    vertical: number | null;
    horizontal: number | null;
    source:
        | 'page'
        | 'object'
        | null;
};

export type MAQuadroCropViewportState = {
    zoom: number;
    positionX: number;
    positionY: number;
};

const EMPTY_GUIDES: MAQuadroGuideState = {
    vertical: null,
    horizontal: null,
    source: null
};

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

function starPoints(
    outerRadius: number,
    innerRadius: number,
    points = 5
) {
    const result: Array<{
        x: number;
        y: number;
    }> = [];

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

        result.push({
            x:
                Math.cos(angle) *
                radius,
            y:
                Math.sin(angle) *
                radius
        });
    }

    return result;
}

export function getMAQuadroImageFrameKind(
    image:
        FabricImage &
        MAQuadroFabricObject
): MAQuadroImageFrameKind {
    const clipPath =
        image.clipPath;

    if (!clipPath) {
        return 'none';
    }

    if (clipPath instanceof Circle) {
        return 'circle';
    }

    if (clipPath instanceof Ellipse) {
        return 'ellipse';
    }

    if (clipPath instanceof Triangle) {
        return 'triangle';
    }

    if (clipPath instanceof Polygon) {
        return 'star';
    }

    if (clipPath instanceof Rect) {
        return (
            Number(
                clipPath.rx ||
                0
            ) > 0 ||
            Number(
                clipPath.ry ||
                0
            ) > 0
        )
            ? 'rounded'
            : 'none';
    }

    return 'none';
}

export function applyMAQuadroImageFrame(
    image:
        FabricImage &
        MAQuadroFabricObject,
    kind:
        MAQuadroImageFrameKind
) {
    if (kind === 'none') {
        image.set({
            clipPath: undefined
        });

        image.setCoords();

        return true;
    }

    const width =
        Math.max(
            1,
            Number(
                image.width ||
                1
            )
        );

    const height =
        Math.max(
            1,
            Number(
                image.height ||
                1
            )
        );

    const shortest =
        Math.min(
            width,
            height
        );

    let clipPath:
        | Circle
        | Ellipse
        | Polygon
        | Rect
        | Triangle;

    if (kind === 'circle') {
        clipPath =
            new Circle({
                radius:
                    shortest /
                    2,
                left: 0,
                top: 0,
                originX:
                    'center',
                originY:
                    'center',
                fill: '#000000',
                strokeWidth: 0
            });
    } else if (
        kind === 'ellipse'
    ) {
        clipPath =
            new Ellipse({
                rx:
                    width /
                    2,
                ry:
                    height /
                    2,
                left: 0,
                top: 0,
                originX:
                    'center',
                originY:
                    'center',
                fill: '#000000',
                strokeWidth: 0
            });
    } else if (
        kind === 'triangle'
    ) {
        clipPath =
            new Triangle({
                width,
                height,
                left: 0,
                top: 0,
                originX:
                    'center',
                originY:
                    'center',
                fill: '#000000',
                strokeWidth: 0
            });
    } else if (
        kind === 'star'
    ) {
        const outerRadius =
            shortest /
            2;

        clipPath =
            new Polygon(
                starPoints(
                    outerRadius,
                    outerRadius *
                    0.46
                ),
                {
                    left: 0,
                    top: 0,
                    originX:
                        'center',
                    originY:
                        'center',
                    fill: '#000000',
                    strokeWidth: 0
                }
            );
    } else {
        const radius =
            Math.max(
                8,
                shortest *
                0.09
            );

        clipPath =
            new Rect({
                width,
                height,
                rx: radius,
                ry: radius,
                left: 0,
                top: 0,
                originX:
                    'center',
                originY:
                    'center',
                fill: '#000000',
                strokeWidth: 0
            });
    }

    clipPath.set({
        selectable: false,
        evented: false,
        objectCaching: true
    });

    image.set({
        clipPath
    });

    image.setCoords();

    return true;
}

function getSourceDimensions(
    image:
        FabricImage &
        MAQuadroFabricObject
) {
    return {
        width:
            Math.max(
                1,
                Number(
                    image.maOriginalWidth ||
                    image.width ||
                    1
                )
            ),

        height:
            Math.max(
                1,
                Number(
                    image.maOriginalHeight ||
                    image.height ||
                    1
                )
            )
    };
}

function getBaseCropWindow(
    sourceWidth: number,
    sourceHeight: number,
    ratio: number
) {
    const safeRatio =
        Number.isFinite(ratio) &&
        ratio > 0
            ? ratio
            : sourceWidth /
                sourceHeight;

    const sourceRatio =
        sourceWidth /
        sourceHeight;

    if (
        sourceRatio >=
        safeRatio
    ) {
        return {
            width:
                sourceHeight *
                safeRatio,
            height:
                sourceHeight
        };
    }

    return {
        width:
            sourceWidth,
        height:
            sourceWidth /
            safeRatio
    };
}

export function getMAQuadroCropViewportState(
    image:
        FabricImage &
        MAQuadroFabricObject
): MAQuadroCropViewportState {
    const source =
        getSourceDimensions(
            image
        );

    const viewWidth =
        Math.max(
            1,
            Number(
                image.width ||
                1
            )
        );

    const viewHeight =
        Math.max(
            1,
            Number(
                image.height ||
                1
            )
        );

    const base =
        getBaseCropWindow(
            source.width,
            source.height,
            viewWidth /
            viewHeight
        );

    const zoom =
        clamp(
            Math.max(
                base.width /
                viewWidth,
                base.height /
                viewHeight
            ) *
            100,
            100,
            400
        );

    const maxCropX =
        Math.max(
            0,
            source.width -
            viewWidth
        );

    const maxCropY =
        Math.max(
            0,
            source.height -
            viewHeight
        );

    return {
        zoom:
            Math.round(
                zoom
            ),

        positionX:
            maxCropX > 0
                ? Math.round(
                    clamp(
                        Number(
                            image.cropX ||
                            0
                        ) /
                        maxCropX *
                        100,
                        0,
                        100
                    )
                )
                : 50,

        positionY:
            maxCropY > 0
                ? Math.round(
                    clamp(
                        Number(
                            image.cropY ||
                            0
                        ) /
                        maxCropY *
                        100,
                        0,
                        100
                    )
                )
                : 50
    };
}

export function setMAQuadroCropViewport(
    image:
        FabricImage &
        MAQuadroFabricObject,
    values:
        Partial<
            MAQuadroCropViewportState
        >
) {
    const current =
        getMAQuadroCropViewportState(
            image
        );

    const source =
        getSourceDimensions(
            image
        );

    const currentWidth =
        Math.max(
            1,
            Number(
                image.width ||
                1
            )
        );

    const currentHeight =
        Math.max(
            1,
            Number(
                image.height ||
                1
            )
        );

    const frameKind =
        getMAQuadroImageFrameKind(
            image
        );

    const displayWidth =
        currentWidth *
        Math.max(
            0.0001,
            Math.abs(
                Number(
                    image.scaleX ||
                    1
                )
            )
        );

    const displayHeight =
        currentHeight *
        Math.max(
            0.0001,
            Math.abs(
                Number(
                    image.scaleY ||
                    1
                )
            )
        );

    const signX =
        Number(
            image.scaleX ||
            1
        ) < 0
            ? -1
            : 1;

    const signY =
        Number(
            image.scaleY ||
            1
        ) < 0
            ? -1
            : 1;

    const base =
        getBaseCropWindow(
            source.width,
            source.height,
            currentWidth /
            currentHeight
        );

    const zoom =
        clamp(
            values.zoom ??
            current.zoom,
            100,
            400
        );

    const nextWidth =
        Math.max(
            1,
            base.width *
            100 /
            zoom
        );

    const nextHeight =
        Math.max(
            1,
            base.height *
            100 /
            zoom
        );

    const positionX =
        clamp(
            values.positionX ??
            current.positionX,
            0,
            100
        );

    const positionY =
        clamp(
            values.positionY ??
            current.positionY,
            0,
            100
        );

    const maxCropX =
        Math.max(
            0,
            source.width -
            nextWidth
        );

    const maxCropY =
        Math.max(
            0,
            source.height -
            nextHeight
        );

    image.set({
        width:
            nextWidth,

        height:
            nextHeight,

        cropX:
            maxCropX *
            positionX /
            100,

        cropY:
            maxCropY *
            positionY /
            100,

        scaleX:
            signX *
            displayWidth /
            nextWidth,

        scaleY:
            signY *
            displayHeight /
            nextHeight
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

    return getMAQuadroCropViewportState(
        image
    );
}

type SnapCandidate = {
    position: number;
    source:
        | 'page'
        | 'object';
};

function bestSnap(
    anchors: number[],
    candidates:
        SnapCandidate[],
    threshold: number
) {
    let best:
        | {
            delta: number;
            candidate:
                SnapCandidate;
        }
        | null = null;

    for (
        const anchor
        of anchors
    ) {
        for (
            const candidate
            of candidates
        ) {
            const delta =
                candidate.position -
                anchor;

            if (
                Math.abs(delta) >
                threshold
            ) {
                continue;
            }

            if (
                !best ||
                Math.abs(delta) <
                Math.abs(
                    best.delta
                )
            ) {
                best = {
                    delta,
                    candidate
                };
            }
        }
    }

    return best;
}

export function snapMAQuadroObject(
    canvas: Canvas,
    target:
        MAQuadroFabricObject,
    threshold: number
): MAQuadroGuideState {
    const bounds =
        target.getBoundingRect();

    const excluded =
        new Set(
            canvas.getActiveObjects()
        );

    excluded.add(
        target
    );

    const verticalCandidates:
        SnapCandidate[] = [
            {
                position: 0,
                source: 'page'
            },
            {
                position:
                    canvas.getWidth() /
                    2,
                source: 'page'
            },
            {
                position:
                    canvas.getWidth(),
                source: 'page'
            }
        ];

    const horizontalCandidates:
        SnapCandidate[] = [
            {
                position: 0,
                source: 'page'
            },
            {
                position:
                    canvas.getHeight() /
                    2,
                source: 'page'
            },
            {
                position:
                    canvas.getHeight(),
                source: 'page'
            }
        ];

    for (
        const object
        of canvas.getObjects()
    ) {
        if (
            excluded.has(
                object
            ) ||
            object.visible ===
            false
        ) {
            continue;
        }

        const otherBounds =
            object.getBoundingRect();

        verticalCandidates.push(
            {
                position:
                    otherBounds.left,
                source: 'object'
            },
            {
                position:
                    otherBounds.left +
                    otherBounds.width /
                    2,
                source: 'object'
            },
            {
                position:
                    otherBounds.left +
                    otherBounds.width,
                source: 'object'
            }
        );

        horizontalCandidates.push(
            {
                position:
                    otherBounds.top,
                source: 'object'
            },
            {
                position:
                    otherBounds.top +
                    otherBounds.height /
                    2,
                source: 'object'
            },
            {
                position:
                    otherBounds.top +
                    otherBounds.height,
                source: 'object'
            }
        );
    }

    const vertical =
        bestSnap(
            [
                bounds.left,
                bounds.left +
                bounds.width /
                2,
                bounds.left +
                bounds.width
            ],
            verticalCandidates,
            threshold
        );

    const horizontal =
        bestSnap(
            [
                bounds.top,
                bounds.top +
                bounds.height /
                2,
                bounds.top +
                bounds.height
            ],
            horizontalCandidates,
            threshold
        );

    if (vertical) {
        target.set({
            left:
                Number(
                    target.left ||
                    0
                ) +
                vertical.delta
        });
    }

    if (horizontal) {
        target.set({
            top:
                Number(
                    target.top ||
                    0
                ) +
                horizontal.delta
        });
    }

    if (
        vertical ||
        horizontal
    ) {
        target.setCoords();
    }

    if (
        !vertical &&
        !horizontal
    ) {
        return EMPTY_GUIDES;
    }

    return {
        vertical:
            vertical
                ? vertical.candidate
                    .position
                : null,

        horizontal:
            horizontal
                ? horizontal.candidate
                    .position
                : null,

        source:
            vertical?.candidate
                .source ||
            horizontal?.candidate
                .source ||
            null
    };
}

export function emptyMAQuadroGuides():
    MAQuadroGuideState {
    return {
        ...EMPTY_GUIDES
    };
}
