export type MAQuadroQuickStylePreset = {
    id: string;
    name: string;
    description: string;
    colors: [string, string, string, string];
    primary: string;
    background: string;
    fontFamily: string;
    fontWeight: string;
    shadow?: {
        enabled: true;
        color: string;
        blur: number;
        offsetX: number;
        offsetY: number;
    };
};

export const MA_QUADRO_QUICK_STYLE_PRESETS:
    MAQuadroQuickStylePreset[] = [
        {
            id: 'ma-cyan',
            name: 'MA Ciano',
            description:
                'Ciano e azul sobre azul-noite.',
            colors: [
                '#22D3EE',
                '#38BDF8',
                '#0F172A',
                '#FFFFFF'
            ],
            primary: '#22D3EE',
            background: '#0F172A',
            fontFamily: 'Arial',
            fontWeight: '700',
            shadow: {
                enabled: true,
                color:
                    'rgba(15, 23, 42, 0.34)',
                blur: 16,
                offsetX: 0,
                offsetY: 6
            }
        },
        {
            id: 'ma-violet',
            name: 'MA Violeta',
            description:
                'Violeta e rosa com contraste forte.',
            colors: [
                '#8B5CF6',
                '#F472B6',
                '#0F172A',
                '#FFFFFF'
            ],
            primary: '#8B5CF6',
            background: '#0F172A',
            fontFamily: 'Arial',
            fontWeight: '700',
            shadow: {
                enabled: true,
                color:
                    'rgba(15, 23, 42, 0.38)',
                blur: 18,
                offsetX: 0,
                offsetY: 7
            }
        },
        {
            id: 'editorial',
            name: 'Editorial',
            description:
                'Azul-noite, branco e âmbar com serif.',
            colors: [
                '#0F172A',
                '#FFFFFF',
                '#F59E0B',
                '#E2E8F0'
            ],
            primary: '#0F172A',
            background: '#FFFFFF',
            fontFamily: 'Georgia',
            fontWeight: '700'
        },
        {
            id: 'clear-tech',
            name: 'Claro Tech',
            description:
                'Branco, ciano e azul para composições limpas.',
            colors: [
                '#FFFFFF',
                '#22D3EE',
                '#38BDF8',
                '#0F172A'
            ],
            primary: '#FFFFFF',
            background: '#0F172A',
            fontFamily: 'Trebuchet MS',
            fontWeight: '700',
            shadow: {
                enabled: true,
                color:
                    'rgba(15, 23, 42, 0.44)',
                blur: 14,
                offsetX: 0,
                offsetY: 6
            }
        },
        {
            id: 'pink-pop',
            name: 'Rosa Pop',
            description:
                'Rosa, violeta e branco para destaques.',
            colors: [
                '#F472B6',
                '#8B5CF6',
                '#FFFFFF',
                '#0F172A'
            ],
            primary: '#F472B6',
            background: '#0F172A',
            fontFamily: 'Trebuchet MS',
            fontWeight: '700'
        },
        {
            id: 'amber-editorial',
            name: 'Âmbar',
            description:
                'Âmbar quente com neutros editoriais.',
            colors: [
                '#F59E0B',
                '#FFFFFF',
                '#0F172A',
                '#E2E8F0'
            ],
            primary: '#F59E0B',
            background: '#0F172A',
            fontFamily: 'Georgia',
            fontWeight: '700'
        }
    ];
