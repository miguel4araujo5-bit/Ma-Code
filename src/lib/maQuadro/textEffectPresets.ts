export type MAQuadroTextEffectPresetId =
    | 'soft-shadow'
    | 'lift'
    | 'hard-shadow'
    | 'neon'
    | 'outline';

export type MAQuadroTextEffectPreset = {
    id: MAQuadroTextEffectPresetId;
    name: string;
    description: string;
    kind: 'shadow' | 'outline';
    shadow?: {
        enabled: true;
        color: string;
        blur: number;
        offsetX: number;
        offsetY: number;
    };
    outlineWidth?: number;
};

export const MA_QUADRO_TEXT_EFFECT_PRESETS:
    MAQuadroTextEffectPreset[] = [
        {
            id: 'soft-shadow',
            name: 'Sombra suave',
            description:
                'Profundidade discreta para títulos e texto.',
            kind: 'shadow',
            shadow: {
                enabled: true,
                color:
                    'rgba(15, 23, 42, 0.34)',
                blur: 18,
                offsetX: 0,
                offsetY: 6
            }
        },
        {
            id: 'lift',
            name: 'Elevação',
            description:
                'Sombra curta para destacar o texto do fundo.',
            kind: 'shadow',
            shadow: {
                enabled: true,
                color:
                    'rgba(15, 23, 42, 0.42)',
                blur: 12,
                offsetX: 0,
                offsetY: 8
            }
        },
        {
            id: 'hard-shadow',
            name: 'Sombra dura',
            description:
                'Deslocamento definido sem desfoque.',
            kind: 'shadow',
            shadow: {
                enabled: true,
                color:
                    'rgba(15, 23, 42, 0.62)',
                blur: 0,
                offsetX: 8,
                offsetY: 8
            }
        },
        {
            id: 'neon',
            name: 'Néon',
            description:
                'Brilho colorido centrado no texto.',
            kind: 'shadow',
            shadow: {
                enabled: true,
                color: '#22D3EE',
                blur: 28,
                offsetX: 0,
                offsetY: 0
            }
        },
        {
            id: 'outline',
            name: 'Contorno',
            description:
                'Realça o texto usando a cor de contorno atual.',
            kind: 'outline',
            outlineWidth: 3
        }
    ];

export function isMAQuadroTextShadowPresetActive(
    preset: MAQuadroTextEffectPreset,
    selection: {
        shadowEnabled: boolean;
        shadowColor: string;
        shadowBlur: number;
        shadowOffsetX: number;
        shadowOffsetY: number;
        strokeWidth: number;
    }
) {
    if (preset.kind === 'outline') {
        return (
            selection.strokeWidth >=
            Math.max(
                1,
                preset.outlineWidth || 1
            )
        );
    }

    if (
        !preset.shadow ||
        !selection.shadowEnabled
    ) {
        return false;
    }

    return (
        Math.abs(
            selection.shadowBlur -
            preset.shadow.blur
        ) <= 1 &&
        Math.abs(
            selection.shadowOffsetX -
            preset.shadow.offsetX
        ) <= 1 &&
        Math.abs(
            selection.shadowOffsetY -
            preset.shadow.offsetY
        ) <= 1
    );
}
