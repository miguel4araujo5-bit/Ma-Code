import {
    FabricImage,
    filters
} from 'fabric';

import type {
    MAQuadroImageFilterState
} from '../../types/maQuadro';

import type {
    MAQuadroFabricObject
} from './canvasObjects';

export const
    DEFAULT_IMAGE_FILTERS:
        MAQuadroImageFilterState = {
            brightness: 0,
            contrast: 0,
            saturation: 0,
            blur: 0,
            grayscale: false
        };

type MAQuadroFilteredImage =
    FabricImage &
    MAQuadroFabricObject;

type RgbColour =
    readonly [
        number,
        number,
        number
    ];

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
            )
    };
}

export function
getMAQuadroImageFilters(
    image:
        MAQuadroFabricObject
): MAQuadroImageFilterState {
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
            )
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

    if (
        normalized.grayscale
    ) {
        nextFilters.push(
            new filters.Grayscale()
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
        cropX: 0,
        cropY: 0,

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
                width * height
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
        index * 4;

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
        ] = getPixelColour(
            pixels,
            y * width + x
        );

        reds.push(red);
        greens.push(green);
        blues.push(blue);
    };

    for (
        let offsetY = 0;
        offsetY < sampleSize;
        offsetY += 1
    ) {
        for (
            let offsetX = 0;
            offsetX < sampleSize;
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
        median(reds),
        median(greens),
        median(blues)
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
        red * red +
        green * green +
        blue * blue
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
            index < 0 ||
            index >=
            visited.length ||
            visited[index]
        ) {
            return;
        }

        visited[index] = 1;
        queue[tail] = index;

        tail += 1;
    };

    for (
        let x = 0;
        x < width;
        x += 1
    ) {
        enqueue(x);

        enqueue(
            (
                height - 1
            ) *
            width +
            x
        );
    }

    for (
        let y = 0;
        y < height;
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
                queue[head];

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

            pixels[alphaOffset] =
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

            if (x > 0) {
                enqueue(
                    index - 1
                );
            }

            if (
                x <
                width - 1
            ) {
                enqueue(
                    index + 1
                );
            }

            if (y > 0) {
                enqueue(
                    index -
                    width
                );
            }

            if (
                y <
                height - 1
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
    return new Promise<Blob>(
        (
            resolve,
            reject
        ) => {
            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        resolve(blob);
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
    blob: Blob
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
                        'Não foi possível converter a imagem processada.'
                    )
                );
            };

            reader.onerror = () => {
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
    dataUrl: string,
    tolerance = 58
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

    if (!analysisContext) {
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

    if (!outputContext) {
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

    analysisCanvas.width = 1;
    analysisCanvas.height = 1;

    outputCanvas.width = 1;
    outputCanvas.height = 1;

    return blobToDataUrl(
        blob
    );
}
