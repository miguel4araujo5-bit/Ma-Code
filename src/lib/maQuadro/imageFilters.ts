import {
    FabricImage,
    FabricObject,
    filters
} from 'fabric';

import type {
    MAQuadroImageFilterState
} from '../../types/maQuadro';

import type {
    MAQuadroFabricObject
} from './canvasObjects';

import {
    MAQuadroHighlightsShadowsFilter,
    MAQuadroVignetteFilter
} from './photoProFilters';

type MAQuadroFilteredImage =
    FabricImage &
    MAQuadroFabricObject & {
        maFilterTemperature?: number;
        maFilterHue?: number;
        maFilterFade?: number;
        maFilterShadows?: number;
        maFilterHighlights?: number;
        maFilterVignette?: number;
        maFilterDuotoneEnabled?: boolean;
        maFilterDuotoneShadows?: string;
        maFilterDuotoneHighlights?: string;
    };

type RgbColour =
    readonly [
        number,
        number,
        number
    ];

const EXTENDED_IMAGE_FILTER_PROPERTIES = [
    'maFilterTemperature',
    'maFilterHue',
    'maFilterFade',
    'maFilterShadows',
    'maFilterHighlights',
    'maFilterVignette',
    'maFilterDuotoneEnabled',
    'maFilterDuotoneShadows',
    'maFilterDuotoneHighlights'
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
            ...EXTENDED_IMAGE_FILTER_PROPERTIES
        ])
    );

export const
    DEFAULT_IMAGE_FILTERS:
        MAQuadroImageFilterState = {
            brightness: 0,
            contrast: 0,
            saturation: 0,
            blur: 0,
            grayscale: false,
            temperature: 0,
            hue: 0,
            fade: 0,
            shadows: 0,
            highlights: 0,
            vignette: 0,
            duotoneEnabled: false,
            duotoneShadows: '#0F172A',
            duotoneHighlights: '#F8FAFC'
        };

const
    BACKGROUND_ANALYSIS_MAX_SIDE =
        1400;

const
    BACKGROUND_ANALYSIS_MAX_PIXELS =
        2_000_000;

const
    BACKGROUND_OUTPUT_MAX_SIDE =
        8192;

const
    BACKGROUND_OUTPUT_MAX_PIXELS =
        40_000_000;

const FLOOD_FILL_CHUNK =
    40_000;

const FEATHER_DISTANCE =
    28;

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

function normalizeHexColour(
    value: unknown,
    fallback: string
) {
    const normalized =
        typeof value ===
        'string'
            ? value
                .trim()
                .toUpperCase()
            : fallback;

    return /^#[0-9A-F]{6}$/.test(
        normalized
    )
        ? normalized
        : fallback;
}

function hexToRgb(
    value: string
): RgbColour {
    const normalized =
        normalizeHexColour(
            value,
            '#000000'
        );

    return [
        Number.parseInt(
            normalized.slice(1, 3),
            16
        ),
        Number.parseInt(
            normalized.slice(3, 5),
            16
        ),
        Number.parseInt(
            normalized.slice(5, 7),
            16
        )
    ];
}

function normalizeFilterState(
    state:
        MAQuadroImageFilterState
): MAQuadroImageFilterState {
    return {
        brightness:
            clamp(
                state.brightness,
                -100,
                100
            ),

        contrast:
            clamp(
                state.contrast,
                -100,
                100
            ),

        saturation:
            clamp(
                state.saturation,
                -100,
                100
            ),

        blur:
            clamp(
                state.blur,
                0,
                100
            ),

        grayscale:
            Boolean(
                state.grayscale
            ),

        temperature:
            clamp(
                Number(
                    state.temperature ??
                    0
                ),
                -100,
                100
            ),

        hue:
            clamp(
                Number(
                    state.hue ??
                    0
                ),
                -180,
                180
            ),

        fade:
            clamp(
                Number(
                    state.fade ??
                    0
                ),
                0,
                100
            ),

        shadows:
            clamp(
                Number(
                    state.shadows ??
                    0
                ),
                -100,
                100
            ),

        highlights:
            clamp(
                Number(
                    state.highlights ??
                    0
                ),
                -100,
                100
            ),

        vignette:
            clamp(
                Number(
                    state.vignette ??
                    0
                ),
                0,
                100
            ),

        duotoneEnabled:
            Boolean(
                state.duotoneEnabled
            ),

        duotoneShadows:
            normalizeHexColour(
                state.duotoneShadows,
                '#0F172A'
            ),

        duotoneHighlights:
            normalizeHexColour(
                state.duotoneHighlights,
                '#F8FAFC'
            )
    };
}

function createDuotoneMatrix(
    shadowColour: string,
    highlightColour: string
) {
    const [
        shadowRed,
        shadowGreen,
        shadowBlue
    ] = hexToRgb(
        shadowColour
    );

    const [
        highlightRed,
        highlightGreen,
        highlightBlue
    ] = hexToRgb(
        highlightColour
    );

    const redDifference =
        highlightRed -
        shadowRed;

    const greenDifference =
        highlightGreen -
        shadowGreen;

    const blueDifference =
        highlightBlue -
        shadowBlue;

    return [
        0.2126 * redDifference / 255,
        0.7152 * redDifference / 255,
        0.0722 * redDifference / 255,
        0,
        shadowRed / 255,

        0.2126 * greenDifference / 255,
        0.7152 * greenDifference / 255,
        0.0722 * greenDifference / 255,
        0,
        shadowGreen / 255,

        0.2126 * blueDifference / 255,
        0.7152 * blueDifference / 255,
        0.0722 * blueDifference / 255,
        0,
        shadowBlue / 255,

        0,
        0,
        0,
        1,
        0
    ] as [
        number, number, number, number, number,
        number, number, number, number, number,
        number, number, number, number, number,
        number, number, number, number, number
    ];
}

export function
getMAQuadroImageFilters(
    image:
        MAQuadroFabricObject
): MAQuadroImageFilterState {
    const filteredImage =
        image as
            MAQuadroFilteredImage;

    return normalizeFilterState({
        brightness:
            Number(
                image
                    .maFilterBrightness ||
                0
            ),

        contrast:
            Number(
                image
                    .maFilterContrast ||
                0
            ),

        saturation:
            Number(
                image
                    .maFilterSaturation ||
                0
            ),

        blur:
            Number(
                image
                    .maFilterBlur ||
                0
            ),

        grayscale:
            Boolean(
                image
                    .maFilterGrayscale
            ),

        temperature:
            Number(
                filteredImage
                    .maFilterTemperature ||
                0
            ),

        hue:
            Number(
                filteredImage
                    .maFilterHue ||
                0
            ),

        fade:
            Number(
                filteredImage
                    .maFilterFade ||
                0
            ),

        shadows:
            Number(
                filteredImage
                    .maFilterShadows ||
                0
            ),

        highlights:
            Number(
                filteredImage
                    .maFilterHighlights ||
                0
            ),

        vignette:
            Number(
                filteredImage
                    .maFilterVignette ||
                0
            ),

        duotoneEnabled:
            Boolean(
                filteredImage
                    .maFilterDuotoneEnabled
            ),

        duotoneShadows:
            filteredImage
                .maFilterDuotoneShadows ||
            '#0F172A',

        duotoneHighlights:
            filteredImage
                .maFilterDuotoneHighlights ||
            '#F8FAFC'
    });
}

export function
applyMAQuadroImageFilters(
    image:
        MAQuadroFilteredImage,
    state:
        MAQuadroImageFilterState
) {
    const normalized =
        normalizeFilterState(
            state
        );

    image.maFilterBrightness =
        normalized.brightness;

    image.maFilterContrast =
        normalized.contrast;

    image.maFilterSaturation =
        normalized.saturation;

    image.maFilterBlur =
        normalized.blur;

    image.maFilterGrayscale =
        normalized.grayscale;

    image.maFilterTemperature =
        normalized.temperature;

    image.maFilterHue =
        normalized.hue;

    image.maFilterFade =
        normalized.fade;

    image.maFilterShadows =
        normalized.shadows;

    image.maFilterHighlights =
        normalized.highlights;

    image.maFilterVignette =
        normalized.vignette;

    image.maFilterDuotoneEnabled =
        normalized.duotoneEnabled;

    image.maFilterDuotoneShadows =
        normalized.duotoneShadows;

    image.maFilterDuotoneHighlights =
        normalized.duotoneHighlights;

    const nextFilters:
        FabricImage['filters'] =
        [];

    if (
        normalized.brightness !==
        0
    ) {
        nextFilters.push(
            new filters.Brightness({
                brightness:
                    normalized.brightness /
                    100
            })
        );
    }

    if (
        normalized.contrast !==
        0
    ) {
        nextFilters.push(
            new filters.Contrast({
                contrast:
                    normalized.contrast /
                    100
            })
        );
    }

    if (
        normalized.saturation !==
        0
    ) {
        nextFilters.push(
            new filters.Saturation({
                saturation:
                    normalized.saturation /
                    100
            })
        );
    }

    if (
        normalized.temperature !==
        0
    ) {
        const warm =
            normalized.temperature >
            0;

        nextFilters.push(
            new filters.BlendColor({
                color:
                    warm
                        ? '#FF8A3D'
                        : '#60A5FA',

                mode:
                    'tint',

                alpha:
                    Math.abs(
                        normalized.temperature
                    ) /
                    100 *
                    0.28
            })
        );
    }

    if (
        normalized.hue !==
        0
    ) {
        nextFilters.push(
            new filters.HueRotation({
                rotation:
                    normalized.hue /
                    360
            })
        );
    }

    if (
        normalized.fade !==
        0
    ) {
        nextFilters.push(
            new filters.BlendColor({
                color:
                    '#FFFFFF',

                mode:
                    'tint',

                alpha:
                    normalized.fade /
                    100 *
                    0.32
            })
        );
    }

    if (
        normalized.shadows !==
        0 ||
        normalized.highlights !==
        0
    ) {
        nextFilters.push(
            new MAQuadroHighlightsShadowsFilter({
                shadows:
                    normalized.shadows /
                    100,

                highlights:
                    normalized.highlights /
                    100
            })
        );
    }

    if (
        normalized.grayscale
    ) {
        nextFilters.push(
            new filters.Grayscale()
        );
    }

    if (
        normalized.duotoneEnabled
    ) {
        nextFilters.push(
            new filters.ColorMatrix({
                matrix:
                    createDuotoneMatrix(
                        normalized
                            .duotoneShadows,

                        normalized
                            .duotoneHighlights
                    )
            })
        );
    }

    if (
        normalized.vignette !==
        0
    ) {
        nextFilters.push(
            new MAQuadroVignetteFilter({
                vignette:
                    normalized.vignette /
                    100
            })
        );
    }

    if (
        normalized.blur !==
        0
    ) {
        nextFilters.push(
            new filters.Blur({
                blur:
                    normalized.blur /
                    100
            })
        );
    }

    image.filters =
        nextFilters;

    image.applyFilters();
    image.setCoords();
}

export function
resetMAQuadroImageFilters(
    image:
        MAQuadroFilteredImage
) {
    applyMAQuadroImageFilters(
        image,
        DEFAULT_IMAGE_FILTERS
    );
}

export function
getMAQuadroImageCropPercentages(
    image:
        MAQuadroFilteredImage
) {
    const sourceWidth =
        Math.max(
            1,

            image.maOriginalWidth ||
            image.width ||
            1
        );

    const sourceHeight =
        Math.max(
            1,

            image.maOriginalHeight ||
            image.height ||
            1
        );

    return {
        horizontal:
            Math.round(
                clamp(
                    (
                        Number(
                            image.cropX ||
                            0
                        ) /
                        sourceWidth
                    ) *
                    100,

                    0,
                    45
                )
            ),

        vertical:
            Math.round(
                clamp(
                    (
                        Number(
                            image.cropY ||
                            0
                        ) /
                        sourceHeight
                    ) *
                    100,

                    0,
                    45
                )
            )
    };
}

export function
cropMAQuadroImageSymmetrically(
    image:
        MAQuadroFilteredImage,

    horizontalPercent:
        number,

    verticalPercent:
        number
) {
    const sourceWidth =
        Math.max(
            1,

            image.maOriginalWidth ||
            image.width ||
            1
        );

    const sourceHeight =
        Math.max(
            1,

            image.maOriginalHeight ||
            image.height ||
            1
        );

    image.maOriginalWidth ||=
        sourceWidth;

    image.maOriginalHeight ||=
        sourceHeight;

    const safeHorizontal =
        clamp(
            horizontalPercent,
            0,
            45
        );

    const safeVertical =
        clamp(
            verticalPercent,
            0,
            45
        );

    const nextCropX =
        sourceWidth *
        safeHorizontal /
        100;

    const nextCropY =
        sourceHeight *
        safeVertical /
        100;

    const nextWidth =
        Math.max(
            1,

            sourceWidth -
            nextCropX *
            2
        );

    const nextHeight =
        Math.max(
            1,

            sourceHeight -
            nextCropY *
            2
        );

    image.set({
        cropX:
            nextCropX,

        cropY:
            nextCropY,

        width:
            nextWidth,

        height:
            nextHeight
    });

    image.setCoords();
}

export function
resetMAQuadroImageCrop(
    image:
        MAQuadroFilteredImage
) {
    const sourceWidth =
        Math.max(
            1,

            image.maOriginalWidth ||
            image.width ||
            1
        );

    const sourceHeight =
        Math.max(
            1,

            image.maOriginalHeight ||
            image.height ||
            1
        );

    image.set({
        cropX:
            0,

        cropY:
            0,

        width:
            sourceWidth,

        height:
            sourceHeight
    });

    image.setCoords();
}

export function
getMAQuadroImageSourceDataUrl(
    image:
        MAQuadroFilteredImage
) {
    if (
        image.maSourceDataUrl
    ) {
        return image.maSourceDataUrl;
    }

    const element =
        image.getElement();

    if (
        element instanceof
        HTMLImageElement
    ) {
        return (
            element.currentSrc ||
            element.src ||
            null
        );
    }

    if (
        element instanceof
        HTMLCanvasElement
    ) {
        try {
            return element.toDataURL(
                'image/png'
            );
        } catch {
            return null;
        }
    }

    return null;
}

function loadHtmlImage(
    dataUrl: string
) {
    return new Promise<
        HTMLImageElement
    >(
        (
            resolve,
            reject
        ) => {
            const image =
                new Image();

            image.decoding =
                'async';

            image.onload =
                () =>
                    resolve(
                        image
                    );

            image.onerror =
                () =>
                    reject(
                        new Error(
                            'Não foi possível processar a imagem.'
                        )
                    );

            image.src =
                dataUrl;
        }
    );
}

function yieldToBrowser() {
    return new Promise<void>(
        (resolve) => {
            window.setTimeout(
                resolve,
                0
            );
        }
    );
}

function calculateSafeScale(
    width: number,
    height: number,
    maxSide: number,
    maxPixels: number
) {
    return Math.min(
        1,

        maxSide /
        Math.max(
            width,
            height
        ),

        Math.sqrt(
            maxPixels /
            Math.max(
                1,
                width *
                height
            )
        )
    );
}

function median(
    values: number[]
) {
    const sorted =
        [...values].sort(
            (
                first,
                second
            ) =>
                first -
                second
        );

    return (
        sorted[
            Math.floor(
                sorted.length /
                2
            )
        ] ||
        0
    );
}

function getPixelColour(
    pixels:
        Uint8ClampedArray,

    index: number
): RgbColour {
    const offset =
        index *
        4;

    return [
        pixels[offset],

        pixels[
            offset + 1
        ],

        pixels[
            offset + 2
        ]
    ];
}

function getBackgroundSample(
    pixels:
        Uint8ClampedArray,

    width: number,

    height: number
): RgbColour {
    const sampleSize =
        Math.max(
            1,

            Math.min(
                12,

                Math.floor(
                    Math.min(
                        width,
                        height
                    ) *
                    0.03
                )
            )
        );

    const reds:
        number[] = [];

    const greens:
        number[] = [];

    const blues:
        number[] = [];

    const samplePixel = (
        x: number,
        y: number
    ) => {
        const [
            red,
            green,
            blue
        ] =
            getPixelColour(
                pixels,

                y *
                width +
                x
            );

        reds.push(
            red
        );

        greens.push(
            green
        );

        blues.push(
            blue
        );
    };

    for (
        let offsetY = 0;
        offsetY <
        sampleSize;
        offsetY += 1
    ) {
        for (
            let offsetX = 0;
            offsetX <
            sampleSize;
            offsetX += 1
        ) {
            samplePixel(
                offsetX,
                offsetY
            );

            samplePixel(
                width -
                1 -
                offsetX,

                offsetY
            );

            samplePixel(
                offsetX,

                height -
                1 -
                offsetY
            );

            samplePixel(
                width -
                1 -
                offsetX,

                height -
                1 -
                offsetY
            );
        }
    }

    return [
        median(
            reds
        ),

        median(
            greens
        ),

        median(
            blues
        )
    ];
}

function colourDistanceSquared(
    first:
        RgbColour,

    second:
        RgbColour
) {
    const red =
        first[0] -
        second[0];

    const green =
        first[1] -
        second[1];

    const blue =
        first[2] -
        second[2];

    return (
        red *
        red +
        green *
        green +
        blue *
        blue
    );
}

async function
applyBackgroundMask(
    imageData:
        ImageData,

    width: number,

    height: number,

    tolerance: number
) {
    const pixels =
        imageData.data;

    const sample =
        getBackgroundSample(
            pixels,
            width,
            height
        );

    const safeTolerance =
        clamp(
            tolerance,
            0,
            180
        );

    const transparentLimit =
        safeTolerance *
        safeTolerance;

    const featherLimit =
        (
            safeTolerance +
            FEATHER_DISTANCE
        ) ** 2;

    const visited =
        new Uint8Array(
            width *
            height
        );

    const queue =
        new Int32Array(
            width *
            height
        );

    let head = 0;
    let tail = 0;

    const enqueue = (
        index: number
    ) => {
        if (
            index <
            0 ||
            index >=
            visited.length ||
            visited[
                index
            ]
        ) {
            return;
        }

        visited[
            index
        ] = 1;

        queue[
            tail
        ] =
            index;

        tail += 1;
    };

    for (
        let x = 0;
        x <
        width;
        x += 1
    ) {
        enqueue(
            x
        );

        enqueue(
            (
                height -
                1
            ) *
            width +
            x
        );
    }

    for (
        let y = 0;
        y <
        height;
        y += 1
    ) {
        enqueue(
            y *
            width
        );

        enqueue(
            y *
            width +
            width -
            1
        );
    }

    while (
        head <
        tail
    ) {
        const chunkEnd =
            Math.min(
                tail,

                head +
                FLOOD_FILL_CHUNK
            );

        while (
            head <
            chunkEnd
        ) {
            const index =
                queue[
                    head
                ];

            head += 1;

            const distanceSquared =
                colourDistanceSquared(
                    getPixelColour(
                        pixels,
                        index
                    ),

                    sample
                );

            if (
                distanceSquared >
                featherLimit
            ) {
                continue;
            }

            const distance =
                Math.sqrt(
                    distanceSquared
                );

            const alpha =
                distanceSquared <=
                transparentLimit
                    ? 0
                    : Math.round(
                        255 *
                        (
                            distance -
                            safeTolerance
                        ) /
                        FEATHER_DISTANCE
                    );

            const alphaOffset =
                index *
                4 +
                3;

            pixels[
                alphaOffset
            ] =
                Math.min(
                    pixels[
                        alphaOffset
                    ],

                    alpha
                );

            const x =
                index %
                width;

            const y =
                Math.floor(
                    index /
                    width
                );

            if (
                x >
                0
            ) {
                enqueue(
                    index -
                    1
                );
            }

            if (
                x <
                width -
                1
            ) {
                enqueue(
                    index +
                    1
                );
            }

            if (
                y >
                0
            ) {
                enqueue(
                    index -
                    width
                );
            }

            if (
                y <
                height -
                1
            ) {
                enqueue(
                    index +
                    width
                );
            }
        }

        if (
            head <
            tail
        ) {
            await yieldToBrowser();
        }
    }
}

function canvasToPngBlob(
    canvas:
        HTMLCanvasElement
) {
    return new Promise<
        Blob
    >(
        (
            resolve,
            reject
        ) => {
            canvas.toBlob(
                (
                    blob
                ) => {
                    if (
                        blob
                    ) {
                        resolve(
                            blob
                        );

                        return;
                    }

                    reject(
                        new Error(
                            'O navegador não conseguiu criar a imagem sem fundo.'
                        )
                    );
                },

                'image/png'
            );
        }
    );
}

function blobToDataUrl(
    blob:
        Blob
) {
    return new Promise<
        string
    >(
        (
            resolve,
            reject
        ) => {
            const reader =
                new FileReader();

            reader.onload =
                () => {
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
                            'Não foi possível converter a imagem processada.'
                        )
                    );
                };

            reader.onerror =
                () => {
                    reject(
                        reader.error ||
                        new Error(
                            'Não foi possível ler a imagem processada.'
                        )
                    );
                };

            reader.readAsDataURL(
                blob
            );
        }
    );
}

export async function
removeSimpleImageBackground(
    dataUrl:
        string,

    tolerance =
        58
) {
    const image =
        await loadHtmlImage(
            dataUrl
        );

    const sourceWidth =
        Math.max(
            1,
            image.naturalWidth
        );

    const sourceHeight =
        Math.max(
            1,
            image.naturalHeight
        );

    const outputScale =
        calculateSafeScale(
            sourceWidth,
            sourceHeight,
            BACKGROUND_OUTPUT_MAX_SIDE,
            BACKGROUND_OUTPUT_MAX_PIXELS
        );

    const outputWidth =
        Math.max(
            1,

            Math.round(
                sourceWidth *
                outputScale
            )
        );

    const outputHeight =
        Math.max(
            1,

            Math.round(
                sourceHeight *
                outputScale
            )
        );

    const analysisScale =
        calculateSafeScale(
            outputWidth,
            outputHeight,
            BACKGROUND_ANALYSIS_MAX_SIDE,
            BACKGROUND_ANALYSIS_MAX_PIXELS
        );

    const analysisWidth =
        Math.max(
            1,

            Math.round(
                outputWidth *
                analysisScale
            )
        );

    const analysisHeight =
        Math.max(
            1,

            Math.round(
                outputHeight *
                analysisScale
            )
        );

    const analysisCanvas =
        document.createElement(
            'canvas'
        );

    analysisCanvas.width =
        analysisWidth;

    analysisCanvas.height =
        analysisHeight;

    const analysisContext =
        analysisCanvas.getContext(
            '2d',

            {
                willReadFrequently:
                    true
            }
        );

    if (
        !analysisContext
    ) {
        throw new Error(
            'O navegador não permitiu analisar a imagem.'
        );
    }

    analysisContext.drawImage(
        image,
        0,
        0,
        analysisWidth,
        analysisHeight
    );

    const imageData =
        analysisContext.getImageData(
            0,
            0,
            analysisWidth,
            analysisHeight
        );

    await applyBackgroundMask(
        imageData,
        analysisWidth,
        analysisHeight,
        tolerance
    );

    analysisContext.putImageData(
        imageData,
        0,
        0
    );

    await yieldToBrowser();

    const outputCanvas =
        document.createElement(
            'canvas'
        );

    outputCanvas.width =
        outputWidth;

    outputCanvas.height =
        outputHeight;

    const outputContext =
        outputCanvas.getContext(
            '2d'
        );

    if (
        !outputContext
    ) {
        throw new Error(
            'O navegador não permitiu criar a imagem sem fundo.'
        );
    }

    outputContext.drawImage(
        image,
        0,
        0,
        outputWidth,
        outputHeight
    );

    outputContext.save();

    outputContext
        .globalCompositeOperation =
        'destination-in';

    outputContext
        .imageSmoothingEnabled =
        true;

    outputContext
        .imageSmoothingQuality =
        'high';

    outputContext.drawImage(
        analysisCanvas,
        0,
        0,
        outputWidth,
        outputHeight
    );

    outputContext.restore();

    const blob =
        await canvasToPngBlob(
            outputCanvas
        );

    analysisCanvas.width =
        1;

    analysisCanvas.height =
        1;

    outputCanvas.width =
        1;

    outputCanvas.height =
        1;

    return blobToDataUrl(
        blob
    );
}
