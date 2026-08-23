import {
    classRegistry,
    filters,
    type T2DPipelineState,
    type TWebGLUniformLocationMap
} from 'fabric';

type HighlightsShadowsProps = {
    shadows: number;
    highlights: number;
};

type VignetteProps = {
    vignette: number;
};

const HIGHLIGHTS_SHADOWS_FRAGMENT = `
precision highp float;

uniform sampler2D uTexture;
varying vec2 vTexCoord;

uniform float uShadows;
uniform float uHighlights;

float tonalSmoothstep(
    float edge0,
    float edge1,
    float value
) {
    float t = clamp(
        (value - edge0) /
        (edge1 - edge0),
        0.0,
        1.0
    );

    return t * t * (3.0 - 2.0 * t);
}

void main() {
    vec4 color =
        texture2D(
            uTexture,
            vTexCoord
        );

    float luminance =
        dot(
            color.rgb,
            vec3(
                0.2126,
                0.7152,
                0.0722
            )
        );

    float shadowWeight =
        1.0 -
        tonalSmoothstep(
            0.0,
            0.66,
            luminance
        );

    float highlightWeight =
        tonalSmoothstep(
            0.34,
            1.0,
            luminance
        );

    vec3 result =
        color.rgb;

    if (
        uShadows >
        0.0
    ) {
        result +=
            (
                1.0 -
                result
            ) *
            uShadows *
            shadowWeight *
            0.72;
    } else {
        result *=
            1.0 +
            uShadows *
            shadowWeight *
            0.72;
    }

    if (
        uHighlights >
        0.0
    ) {
        result +=
            (
                1.0 -
                result
            ) *
            uHighlights *
            highlightWeight *
            0.72;
    } else {
        result *=
            1.0 +
            uHighlights *
            highlightWeight *
            0.72;
    }

    gl_FragColor =
        vec4(
            clamp(
                result,
                0.0,
                1.0
            ),
            color.a
        );
}
`;

const VIGNETTE_FRAGMENT = `
precision highp float;

uniform sampler2D uTexture;
varying vec2 vTexCoord;

uniform float uVignette;

float vignetteSmoothstep(
    float edge0,
    float edge1,
    float value
) {
    float t = clamp(
        (value - edge0) /
        (edge1 - edge0),
        0.0,
        1.0
    );

    return t * t * (3.0 - 2.0 * t);
}

void main() {
    vec4 color =
        texture2D(
            uTexture,
            vTexCoord
        );

    vec2 centered =
        vTexCoord -
        vec2(
            0.5,
            0.5
        );

    float distanceFromCenter =
        length(
            centered
        ) *
        1.41421356237;

    float edgeMask =
        vignetteSmoothstep(
            0.30,
            1.0,
            distanceFromCenter
        );

    float multiplier =
        1.0 -
        uVignette *
        edgeMask *
        0.86;

    gl_FragColor =
        vec4(
            color.rgb *
            multiplier,
            color.a
        );
}
`;

function clampUnit(
    value: number
) {
    return Math.min(
        1,
        Math.max(
            -1,
            Number.isFinite(value)
                ? value
                : 0
        )
    );
}

function clampPositiveUnit(
    value: number
) {
    return Math.min(
        1,
        Math.max(
            0,
            Number.isFinite(value)
                ? value
                : 0
        )
    );
}

function smoothstep(
    edge0: number,
    edge1: number,
    value: number
) {
    const t =
        Math.min(
            1,
            Math.max(
                0,
                (
                    value -
                    edge0
                ) /
                (
                    edge1 -
                    edge0
                )
            )
        );

    return (
        t *
        t *
        (
            3 -
            2 *
            t
        )
    );
}

function adjustTonalChannel(
    channel: number,
    shadows: number,
    highlights: number,
    shadowWeight: number,
    highlightWeight: number
) {
    let result =
        channel;

    if (
        shadows >
        0
    ) {
        result +=
            (
                1 -
                result
            ) *
            shadows *
            shadowWeight *
            0.72;
    } else {
        result *=
            1 +
            shadows *
            shadowWeight *
            0.72;
    }

    if (
        highlights >
        0
    ) {
        result +=
            (
                1 -
                result
            ) *
            highlights *
            highlightWeight *
            0.72;
    } else {
        result *=
            1 +
            highlights *
            highlightWeight *
            0.72;
    }

    return Math.min(
        1,
        Math.max(
            0,
            result
        )
    );
}

export class MAQuadroHighlightsShadowsFilter
    extends filters.BaseFilter<
        'MAQuadroHighlightsShadows',
        HighlightsShadowsProps
    > {
    declare shadows:
        HighlightsShadowsProps['shadows'];

    declare highlights:
        HighlightsShadowsProps['highlights'];

    static type =
        'MAQuadroHighlightsShadows';

    static defaults:
        HighlightsShadowsProps = {
            shadows: 0,
            highlights: 0
        };

    static uniformLocations = [
        'uShadows',
        'uHighlights'
    ];

    protected getFragmentSource() {
        return HIGHLIGHTS_SHADOWS_FRAGMENT;
    }

    applyTo2d({
        imageData: {
            data
        }
    }: T2DPipelineState) {
        const shadows =
            clampUnit(
                this.shadows
            );

        const highlights =
            clampUnit(
                this.highlights
            );

        for (
            let offset = 0;
            offset < data.length;
            offset += 4
        ) {
            const red =
                data[offset] /
                255;

            const green =
                data[
                    offset + 1
                ] /
                255;

            const blue =
                data[
                    offset + 2
                ] /
                255;

            const luminance =
                red *
                0.2126 +
                green *
                0.7152 +
                blue *
                0.0722;

            const shadowWeight =
                1 -
                smoothstep(
                    0,
                    0.66,
                    luminance
                );

            const highlightWeight =
                smoothstep(
                    0.34,
                    1,
                    luminance
                );

            data[offset] =
                Math.round(
                    adjustTonalChannel(
                        red,
                        shadows,
                        highlights,
                        shadowWeight,
                        highlightWeight
                    ) *
                    255
                );

            data[
                offset + 1
            ] =
                Math.round(
                    adjustTonalChannel(
                        green,
                        shadows,
                        highlights,
                        shadowWeight,
                        highlightWeight
                    ) *
                    255
                );

            data[
                offset + 2
            ] =
                Math.round(
                    adjustTonalChannel(
                        blue,
                        shadows,
                        highlights,
                        shadowWeight,
                        highlightWeight
                    ) *
                    255
                );
        }
    }

    sendUniformData(
        gl:
            WebGLRenderingContext,

        uniformLocations:
            TWebGLUniformLocationMap
    ) {
        gl.uniform1f(
            uniformLocations
                .uShadows,

            clampUnit(
                this.shadows
            )
        );

        gl.uniform1f(
            uniformLocations
                .uHighlights,

            clampUnit(
                this.highlights
            )
        );
    }

    isNeutralState() {
        return (
            this.shadows ===
            0 &&
            this.highlights ===
            0
        );
    }
}

export class MAQuadroVignetteFilter
    extends filters.BaseFilter<
        'MAQuadroVignette',
        VignetteProps
    > {
    declare vignette:
        VignetteProps['vignette'];

    static type =
        'MAQuadroVignette';

    static defaults:
        VignetteProps = {
            vignette: 0
        };

    static uniformLocations = [
        'uVignette'
    ];

    protected getFragmentSource() {
        return VIGNETTE_FRAGMENT;
    }

    applyTo2d({
        imageData
    }: T2DPipelineState) {
        const {
            data,
            width,
            height
        } =
            imageData;

        const vignette =
            clampPositiveUnit(
                this.vignette
            );

        if (
            vignette ===
            0
        ) {
            return;
        }

        const denominatorX =
            Math.max(
                1,
                width - 1
            );

        const denominatorY =
            Math.max(
                1,
                height - 1
            );

        for (
            let y = 0;
            y < height;
            y += 1
        ) {
            const normalizedY =
                y /
                denominatorY -
                0.5;

            for (
                let x = 0;
                x < width;
                x += 1
            ) {
                const normalizedX =
                    x /
                    denominatorX -
                    0.5;

                const distance =
                    Math.sqrt(
                        normalizedX *
                        normalizedX +
                        normalizedY *
                        normalizedY
                    ) *
                    Math.SQRT2;

                const edgeMask =
                    smoothstep(
                        0.30,
                        1,
                        distance
                    );

                const multiplier =
                    1 -
                    vignette *
                    edgeMask *
                    0.86;

                const offset =
                    (
                        y *
                        width +
                        x
                    ) *
                    4;

                data[offset] =
                    Math.round(
                        data[offset] *
                        multiplier
                    );

                data[
                    offset + 1
                ] =
                    Math.round(
                        data[
                            offset + 1
                        ] *
                        multiplier
                    );

                data[
                    offset + 2
                ] =
                    Math.round(
                        data[
                            offset + 2
                        ] *
                        multiplier
                    );
            }
        }
    }

    sendUniformData(
        gl:
            WebGLRenderingContext,

        uniformLocations:
            TWebGLUniformLocationMap
    ) {
        gl.uniform1f(
            uniformLocations
                .uVignette,

            clampPositiveUnit(
                this.vignette
            )
        );
    }

    isNeutralState() {
        return (
            this.vignette ===
            0
        );
    }
}

classRegistry.setClass(
    MAQuadroHighlightsShadowsFilter
);

classRegistry.setClass(
    MAQuadroVignetteFilter
);
