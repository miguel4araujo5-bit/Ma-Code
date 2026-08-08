import type {
    MAQuadroBrand,
    MAQuadroBrandColor,
    MAQuadroBrandFont,
    MAQuadroStoredBrandKit
} from '../../types/maQuadro';

import {
    createMAQuadroId
} from './project';

export const MA_QUADRO_DEFAULT_BRAND_KIT_ID =
    'ma-code';

const FALLBACK_COLORS:
    MAQuadroBrandColor[] = [
        {
            name: 'Cor 1',
            value: '#22D3EE'
        },
        {
            name: 'Cor 2',
            value: '#38BDF8'
        },
        {
            name: 'Cor 3',
            value: '#0F172A'
        },
        {
            name: 'Cor 4',
            value: '#FFFFFF'
        }
    ];

const FALLBACK_FONTS:
    MAQuadroBrandFont[] = [
        {
            name: 'Principal',
            family: 'Arial',
            fallback: 'sans-serif'
        },
        {
            name: 'Secundária',
            family: 'Georgia',
            fallback: 'serif'
        }
    ];

function cloneColors(
    colors: MAQuadroBrandColor[]
) {
    const source =
        colors.length > 0
            ? colors
            : FALLBACK_COLORS;

    return source.map((color) => ({
        name: color.name,
        value: color.value
    }));
}

function cloneFonts(
    fonts: MAQuadroBrandFont[]
) {
    const source =
        fonts.length > 0
            ? fonts
            : FALLBACK_FONTS;

    return source.map((font) => ({
        name: font.name,
        family: font.family,
        fallback: font.fallback
    }));
}

export function createMAQuadroDefaultBrandKit(
    brand: MAQuadroBrand
): MAQuadroStoredBrandKit {
    return {
        id: MA_QUADRO_DEFAULT_BRAND_KIT_ID,
        name: brand.name || 'MA-Code',
        colors: cloneColors(
            brand.colors
        ),
        fonts: cloneFonts(
            brand.fonts
        ),
        createdAt:
            '1970-01-01T00:00:00.000Z',
        updatedAt:
            '1970-01-01T00:00:00.000Z'
    };
}

export function createMAQuadroCustomBrandKit(
    source: MAQuadroStoredBrandKit,
    name = 'Nova marca'
): MAQuadroStoredBrandKit {
    const now =
        new Date().toISOString();

    return {
        id:
            createMAQuadroId(
                'brand'
            ),

        name:
            normalizeMAQuadroBrandKitName(
                name
            ),

        colors:
            cloneColors(
                source.colors
            ),

        fonts:
            cloneFonts(
                source.fonts
            ),

        createdAt:
            now,

        updatedAt:
            now
    };
}

export function normalizeMAQuadroBrandKitName(
    value: string
) {
    const normalized =
        value
            .trim()
            .replace(
                /\s+/g,
                ' '
            );

    return (
        normalized ||
        'Marca sem nome'
    ).slice(
        0,
        80
    );
}

export function touchMAQuadroBrandKit(
    kit: MAQuadroStoredBrandKit
): MAQuadroStoredBrandKit {
    return {
        ...kit,

        colors:
            cloneColors(
                kit.colors
            ),

        fonts:
            cloneFonts(
                kit.fonts
            ),

        updatedAt:
            new Date()
                .toISOString()
    };
}
