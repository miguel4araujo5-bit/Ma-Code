import type {
  MAQuadroCanvasPreset,
  MAQuadroPage,
  MAQuadroProject,
  MAQuadroProjectCategory
} from '../../types/maQuadro'
import {
  saveMAQuadroProject
} from './db'
import {
  createDefaultBackground,
  createMAQuadroId
} from './project'

export const MA_QUADRO_PRESETS: MAQuadroCanvasPreset[] = [
  {
    id: 'instagram-post',
    name: 'Publicação Instagram',
    description: 'Quadrado para redes sociais',
    width: 1080,
    height: 1080,
    category: 'social'
  },
  {
    id: 'instagram-story',
    name: 'Story ou Reel',
    description: 'Formato vertical 9:16',
    width: 1080,
    height: 1920,
    category: 'story'
  },
  {
    id: 'presentation-16-9',
    name: 'Apresentação 16:9',
    description: 'Slide panorâmico',
    width: 1920,
    height: 1080,
    category: 'presentation'
  },
  {
    id: 'x-header',
    name: 'Cabeçalho X',
    description: 'Capa horizontal',
    width: 1500,
    height: 500,
    category: 'social'
  },
  {
    id: 'a4-poster',
    name: 'Cartaz A4',
    description: 'A4 a 300 ppp',
    width: 2480,
    height: 3508,
    category: 'print'
  },
  {
    id: 'invitation',
    name: 'Convite',
    description: 'Convite vertical',
    width: 1200,
    height: 1800,
    category: 'invitation'
  }
]

const templateTimestamp =
  '2026-08-03T00:00:00.000Z'

function canvas(
  objects: Record<string, unknown>[]
) {
  return {
    version: '7.4.0',
    objects
  }
}

function page(
  id: string,
  name: string,
  width: number,
  height: number,
  color: string,
  objects: Record<string, unknown>[]
): MAQuadroPage {
  return {
    id,
    name,
    width,
    height,
    background:
      createDefaultBackground(color),
    canvasJson:
      canvas(objects)
  }
}

function project(
  id: string,
  name: string,
  category: MAQuadroProjectCategory,
  pages: MAQuadroPage[]
): MAQuadroProject {
  return {
    schemaVersion: 2,
    id,
    name,
    pages,
    activePageId: pages[0].id,
    category,
    isTemplate: true,
    createdAt: templateTimestamp,
    updatedAt: templateTimestamp
  }
}

function text(
  name: string,
  value: string,
  left: number,
  top: number,
  width: number,
  fontSize: number,
  fill: string,
  extra: Record<string, unknown> = {}
) {
  return {
    type: 'Textbox',
    maId:
      createMAQuadroId(
        'template-object'
      ),
    maName: name,
    maRole: 'text',
    originX: 'left',
    originY: 'top',
    left,
    top,
    width,
    text: value,
    fontFamily: 'Arial',
    fontSize,
    fill,
    lineHeight: 1.05,
    ...extra
  }
}

function rect(
  name: string,
  left: number,
  top: number,
  width: number,
  height: number,
  fill: string,
  extra: Record<string, unknown> = {}
) {
  return {
    type: 'Rect',
    maId:
      createMAQuadroId(
        'template-object'
      ),
    maName: name,
    maRole: 'shape',
    originX: 'left',
    originY: 'top',
    left,
    top,
    width,
    height,
    fill,
    strokeWidth: 0,
    ...extra
  }
}

function circle(
  name: string,
  left: number,
  top: number,
  radius: number,
  fill: string,
  extra: Record<string, unknown> = {}
) {
  return {
    type: 'Circle',
    maId:
      createMAQuadroId(
        'template-object'
      ),
    maName: name,
    maRole: 'shape',
    originX: 'left',
    originY: 'top',
    left,
    top,
    radius,
    fill,
    strokeWidth: 0,
    ...extra
  }
}

export const MA_QUADRO_STARTER_PROJECTS:
  MAQuadroProject[] = [
  project(
    'template-social-impacto-v2',
    'Social — Impacto',
    'social',
    [
      page(
        'template-social-impacto-page-1',
        'Capa',
        1080,
        1080,
        '#0F172A',
        [
          rect(
            'Faixa',
            72,
            72,
            936,
            24,
            '#22D3EE',
            {
              rx: 12,
              ry: 12
            }
          ),
          circle(
            'Círculo decorativo',
            728,
            648,
            260,
            '#8B5CF6',
            {
              opacity: 0.65
            }
          ),
          circle(
            'Círculo ciano',
            818,
            742,
            150,
            '#22D3EE',
            {
              opacity: 0.8
            }
          ),
          text(
            'Título',
            'A SUA IDEIA\nMERECE IMPACTO.',
            90,
            220,
            850,
            102,
            '#FFFFFF',
            {
              fontWeight: 700,
              lineHeight: 0.94
            }
          ),
          text(
            'Descrição',
            'Design claro, moderno e preparado para comunicar melhor.',
            94,
            555,
            690,
            38,
            '#CBD5E1',
            {
              lineHeight: 1.25
            }
          ),
          rect(
            'Botão',
            90,
            838,
            410,
            108,
            '#22D3EE',
            {
              rx: 54,
              ry: 54,
              shadow: {
                color:
                  'rgba(34, 211, 238, 0.28)',
                blur: 24,
                offsetX: 0,
                offsetY: 12
              }
            }
          ),
          text(
            'Texto do botão',
            'SAIBA MAIS',
            136,
            867,
            320,
            39,
            '#0F172A',
            {
              fontWeight: 700,
              textAlign: 'center'
            }
          )
        ]
      )
    ]
  ),

  project(
    'template-carousel-educativo-v2',
    'Carrossel — Conteúdo educativo',
    'social',
    [
      page(
        'template-carousel-page-1',
        'Capa',
        1080,
        1080,
        '#F8FAFC',
        [
          rect(
            'Topo',
            0,
            0,
            1080,
            180,
            '#0F172A'
          ),
          text(
            'Etiqueta',
            'GUIA PRÁTICO',
            78,
            58,
            780,
            34,
            '#22D3EE',
            {
              fontWeight: 700,
              charSpacing: 120
            }
          ),
          text(
            'Título',
            '5 PASSOS PARA\nUMA MARCA MAIS FORTE',
            78,
            280,
            900,
            88,
            '#0F172A',
            {
              fontWeight: 700,
              lineHeight: 1
            }
          ),
          text(
            'Rodapé',
            'DESLIZE PARA CONTINUAR  →',
            78,
            930,
            900,
            30,
            '#64748B',
            {
              fontWeight: 700,
              charSpacing: 40
            }
          )
        ]
      ),

      page(
        'template-carousel-page-2',
        'Passo 1',
        1080,
        1080,
        '#0F172A',
        [
          text(
            'Número',
            '01',
            76,
            70,
            300,
            180,
            '#22D3EE',
            {
              fontWeight: 700
            }
          ),
          text(
            'Título',
            'DEFINA UMA\nMENSAGEM CLARA',
            80,
            330,
            880,
            94,
            '#FFFFFF',
            {
              fontWeight: 700,
              lineHeight: 0.98
            }
          ),
          text(
            'Descrição',
            'Uma pessoa deve perceber rapidamente o que oferece, para quem e qual o resultado.',
            84,
            660,
            800,
            38,
            '#CBD5E1',
            {
              lineHeight: 1.3
            }
          )
        ]
      ),

      page(
        'template-carousel-page-3',
        'Conclusão',
        1080,
        1080,
        '#8B5CF6',
        [
          circle(
            'Círculo',
            700,
            70,
            250,
            '#22D3EE',
            {
              opacity: 0.55
            }
          ),
          text(
            'Título',
            'PRONTO PARA\nCOMEÇAR?',
            84,
            260,
            840,
            110,
            '#FFFFFF',
            {
              fontWeight: 700,
              lineHeight: 0.95
            }
          ),
          text(
            'Ação',
            'Guarde este conteúdo e aplique o primeiro passo hoje.',
            88,
            650,
            780,
            42,
            '#EDE9FE',
            {
              lineHeight: 1.25
            }
          ),
          text(
            'Website',
            'MA-CODE.PT',
            88,
            920,
            840,
            34,
            '#FFFFFF',
            {
              fontWeight: 700,
              charSpacing: 100
            }
          )
        ]
      )
    ]
  ),

  project(
    'template-story-launch-v2',
    'Story — Lançamento',
    'story',
    [
      page(
        'template-story-launch-page-1',
        'Story',
        1080,
        1920,
        '#F8FAFC',
        [
          rect(
            'Bloco azul',
            0,
            0,
            1080,
            720,
            '#38BDF8'
          ),
          text(
            'Etiqueta',
            'NOVO LANÇAMENTO',
            82,
            108,
            820,
            34,
            '#0F172A',
            {
              fontWeight: 700,
              charSpacing: 100
            }
          ),
          text(
            'Título',
            'CRIE.\nEDITE.\nPUBLIQUE.',
            78,
            255,
            900,
            126,
            '#0F172A',
            {
              fontWeight: 700,
              lineHeight: 0.9
            }
          ),
          rect(
            'Moldura de imagem',
            80,
            820,
            920,
            690,
            '#E2E8F0',
            {
              rx: 44,
              ry: 44,
              stroke: '#CBD5E1',
              strokeWidth: 4,
              strokeDashArray: [
                18,
                14
              ]
            }
          ),
          text(
            'Imagem',
            'ARRASTE UMA IMAGEM PARA AQUI',
            220,
            1125,
            640,
            32,
            '#64748B',
            {
              fontWeight: 700,
              textAlign: 'center'
            }
          ),
          text(
            'Rodapé',
            'MA-CODE.PT',
            80,
            1690,
            920,
            44,
            '#8B5CF6',
            {
              fontWeight: 700,
              textAlign: 'center'
            }
          )
        ]
      )
    ]
  ),

  project(
    'template-presentation-pitch-v2',
    'Apresentação — Pitch simples',
    'presentation',
    [
      page(
        'template-pitch-page-1',
        'Capa',
        1920,
        1080,
        '#0F172A',
        [
          rect(
            'Linha',
            120,
            100,
            530,
            20,
            '#22D3EE',
            {
              rx: 10,
              ry: 10
            }
          ),
          text(
            'Título',
            'UMA IDEIA\nCOM POTENCIAL.',
            120,
            245,
            1320,
            150,
            '#FFFFFF',
            {
              fontWeight: 700,
              lineHeight: 0.92
            }
          ),
          text(
            'Subtítulo',
            'Apresentação de projeto · 2026',
            128,
            760,
            1100,
            48,
            '#94A3B8'
          ),
          circle(
            'Forma violeta',
            1460,
            190,
            300,
            '#8B5CF6',
            {
              opacity: 0.7
            }
          )
        ]
      ),

      page(
        'template-pitch-page-2',
        'Problema',
        1920,
        1080,
        '#F8FAFC',
        [
          text(
            'Número',
            '01',
            110,
            85,
            250,
            88,
            '#8B5CF6',
            {
              fontWeight: 700
            }
          ),
          text(
            'Título',
            'O PROBLEMA',
            110,
            230,
            1100,
            118,
            '#0F172A',
            {
              fontWeight: 700
            }
          ),
          text(
            'Descrição',
            'Explique o problema de forma direta, indique quem é afetado e demonstre por que merece uma solução.',
            118,
            480,
            1040,
            52,
            '#334155',
            {
              lineHeight: 1.35
            }
          ),
          rect(
            'Destaque',
            1350,
            210,
            390,
            600,
            '#22D3EE',
            {
              rx: 36,
              ry: 36
            }
          ),
          text(
            'Dado',
            '72%',
            1400,
            350,
            290,
            130,
            '#0F172A',
            {
              fontWeight: 700,
              textAlign: 'center'
            }
          ),
          text(
            'Legenda',
            'adicione aqui um dado relevante',
            1410,
            535,
            270,
            32,
            '#0F172A',
            {
              textAlign: 'center',
              lineHeight: 1.25
            }
          )
        ]
      ),

      page(
        'template-pitch-page-3',
        'Solução',
        1920,
        1080,
        '#8B5CF6',
        [
          text(
            'Número',
            '02',
            110,
            85,
            250,
            88,
            '#C4B5FD',
            {
              fontWeight: 700
            }
          ),
          text(
            'Título',
            'A SOLUÇÃO',
            110,
            230,
            1100,
            118,
            '#FFFFFF',
            {
              fontWeight: 700
            }
          ),
          rect(
            'Cartão 1',
            115,
            500,
            500,
            350,
            '#FFFFFF',
            {
              rx: 34,
              ry: 34
            }
          ),
          rect(
            'Cartão 2',
            710,
            500,
            500,
            350,
            '#FFFFFF',
            {
              rx: 34,
              ry: 34
            }
          ),
          rect(
            'Cartão 3',
            1305,
            500,
            500,
            350,
            '#FFFFFF',
            {
              rx: 34,
              ry: 34
            }
          ),
          text(
            'Benefício 1',
            'SIMPLES',
            170,
            610,
            390,
            54,
            '#0F172A',
            {
              fontWeight: 700,
              textAlign: 'center'
            }
          ),
          text(
            'Benefício 2',
            'RÁPIDO',
            765,
            610,
            390,
            54,
            '#0F172A',
            {
              fontWeight: 700,
              textAlign: 'center'
            }
          ),
          text(
            'Benefício 3',
            'EFICAZ',
            1360,
            610,
            390,
            54,
            '#0F172A',
            {
              fontWeight: 700,
              textAlign: 'center'
            }
          )
        ]
      )
    ]
  ),

  project(
    'template-a4-event-v2',
    'Cartaz A4 — Evento',
    'print',
    [
      page(
        'template-a4-event-page-1',
        'Cartaz',
        2480,
        3508,
        '#FFFFFF',
        [
          rect(
            'Fundo superior',
            0,
            0,
            2480,
            1480,
            '#0F172A'
          ),
          rect(
            'Linha ciano',
            180,
            210,
            620,
            38,
            '#22D3EE',
            {
              rx: 19,
              ry: 19
            }
          ),
          text(
            'Título',
            'ENCONTRO\nCRIATIVO 2026',
            180,
            390,
            2080,
            250,
            '#FFFFFF',
            {
              fontWeight: 700,
              lineHeight: 0.95
            }
          ),
          text(
            'Data',
            '18 SETEMBRO · PORTO',
            180,
            1670,
            2080,
            108,
            '#8B5CF6',
            {
              fontWeight: 700
            }
          ),
          text(
            'Descrição',
            'Um dia para descobrir ideias, ferramentas e pessoas que transformam projetos em resultados.',
            180,
            1960,
            1900,
            92,
            '#334155',
            {
              fontFamily: 'Georgia',
              lineHeight: 1.3
            }
          ),
          rect(
            'Separador',
            180,
            2760,
            2120,
            8,
            '#CBD5E1'
          ),
          text(
            'Website',
            'MA-CODE.PT',
            180,
            2980,
            2080,
            100,
            '#0F172A',
            {
              fontWeight: 700,
              textAlign: 'right'
            }
          )
        ]
      )
    ]
  ),

  project(
    'template-invitation-elegant-v2',
    'Convite — Elegante',
    'invitation',
    [
      page(
        'template-invitation-page-1',
        'Convite',
        1200,
        1800,
        '#FFF7ED',
        [
          rect(
            'Moldura exterior',
            70,
            70,
            1060,
            1660,
            'rgba(0,0,0,0)',
            {
              stroke: '#A16207',
              strokeWidth: 4,
              rx: 20,
              ry: 20
            }
          ),
          circle(
            'Decoração superior',
            440,
            180,
            160,
            '#F59E0B',
            {
              opacity: 0.2
            }
          ),
          text(
            'Etiqueta',
            'TEMOS O PRAZER DE CONVIDAR',
            170,
            260,
            860,
            30,
            '#92400E',
            {
              fontWeight: 700,
              charSpacing: 120,
              textAlign: 'center'
            }
          ),
          text(
            'Título',
            'Celebração\nEspecial',
            160,
            470,
            880,
            112,
            '#422006',
            {
              fontFamily: 'Georgia',
              textAlign: 'center',
              lineHeight: 1.05
            }
          ),
          text(
            'Data',
            'SÁBADO · 19:30',
            190,
            970,
            820,
            44,
            '#A16207',
            {
              fontWeight: 700,
              textAlign: 'center',
              charSpacing: 80
            }
          ),
          text(
            'Local',
            'Casa da Cultura · Porto',
            190,
            1110,
            820,
            42,
            '#422006',
            {
              textAlign: 'center'
            }
          ),
          text(
            'Confirmação',
            'Confirme a sua presença até 10 de setembro',
            210,
            1450,
            780,
            32,
            '#78716C',
            {
              textAlign: 'center'
            }
          )
        ]
      )
    ]
  ),

  project(
    'template-certificate-academic-v2',
    'Certificado — Académico',
    'print',
    [
      page(
        'template-certificate-academic-page-1',
        'Certificado',
        3508,
        2480,
        '#F8FAFC',
        [
          rect(
            'Moldura exterior',
            110,
            110,
            3288,
            2260,
            'rgba(0,0,0,0)',
            {
              stroke: '#0F172A',
              strokeWidth: 10,
              rx: 24,
              ry: 24
            }
          ),
          rect(
            'Moldura interior',
            155,
            155,
            3198,
            2170,
            'rgba(0,0,0,0)',
            {
              stroke: '#38BDF8',
              strokeWidth: 4,
              rx: 18,
              ry: 18
            }
          ),
          rect(
            'Faixa lateral',
            110,
            110,
            115,
            2260,
            '#0F172A',
            {
              rx: 24,
              ry: 24
            }
          ),
          circle(
            'Selo exterior',
            2865,
            310,
            185,
            '#0F172A'
          ),
          circle(
            'Selo interior',
            2920,
            365,
            130,
            '#38BDF8'
          ),
          text(
            'Marca',
            'MA-CODE',
            310,
            250,
            1180,
            62,
            '#0F172A',
            {
              fontWeight: 700,
              charSpacing: 160
            }
          ),
          text(
            'Etiqueta',
            'CERTIFICADO DE PARTICIPAÇÃO',
            310,
            515,
            2450,
            74,
            '#0284C7',
            {
              fontWeight: 700,
              charSpacing: 85
            }
          ),
          text(
            'Título',
            'Certificamos que',
            310,
            750,
            2250,
            92,
            '#475569'
          ),
          text(
            'Nome',
            'NOME DO PARTICIPANTE',
            310,
            960,
            2600,
            150,
            '#0F172A',
            {
              fontWeight: 700,
              lineHeight: 1
            }
          ),
          rect(
            'Linha do nome',
            310,
            1175,
            2520,
            8,
            '#38BDF8'
          ),
          text(
            'Descrição',
            'participou com aproveitamento na atividade, formação ou projeto indicado neste certificado.',
            310,
            1305,
            2540,
            58,
            '#475569',
            {
              lineHeight: 1.35
            }
          ),
          text(
            'Atividade',
            'NOME DA ATIVIDADE · 2026',
            310,
            1610,
            2400,
            68,
            '#0F172A',
            {
              fontWeight: 700
            }
          ),
          rect(
            'Linha assinatura 1',
            310,
            2070,
            760,
            5,
            '#94A3B8'
          ),
          rect(
            'Linha assinatura 2',
            1590,
            2070,
            760,
            5,
            '#94A3B8'
          ),
          text(
            'Assinatura 1',
            'Responsável',
            310,
            2105,
            760,
            42,
            '#64748B',
            {
              textAlign: 'center'
            }
          ),
          text(
            'Assinatura 2',
            'Coordenação',
            1590,
            2105,
            760,
            42,
            '#64748B',
            {
              textAlign: 'center'
            }
          ),
          text(
            'Data',
            '11 AGOSTO 2026',
            2630,
            2095,
            520,
            40,
            '#64748B',
            {
              fontWeight: 700,
              textAlign: 'right'
            }
          )
        ]
      )
    ]
  ),

  project(
    'template-weekly-schedule-v2',
    'Horário — Semanal',
    'print',
    [
      page(
        'template-weekly-schedule-page-1',
        'Horário',
        3508,
        2480,
        '#F8FAFC',
        [
          rect(
            'Cabeçalho',
            0,
            0,
            3508,
            420,
            '#0F172A'
          ),
          text(
            'Título',
            'HORÁRIO SEMANAL',
            180,
            105,
            2050,
            112,
            '#FFFFFF',
            {
              fontWeight: 700,
              charSpacing: 55
            }
          ),
          text(
            'Subtítulo',
            'Organize a semana num único quadro.',
            184,
            265,
            1800,
            48,
            '#CBD5E1'
          ),
          text(
            'Identificação',
            'NOME / TURMA / EQUIPA',
            2440,
            145,
            860,
            42,
            '#38BDF8',
            {
              fontWeight: 700,
              textAlign: 'right'
            }
          ),

          rect(
            'Cabeçalho horas',
            150,
            545,
            430,
            170,
            '#E2E8F0',
            { rx: 18, ry: 18 }
          ),
          text(
            'Horas',
            'HORAS',
            190,
            595,
            350,
            52,
            '#334155',
            {
              fontWeight: 700,
              textAlign: 'center'
            }
          ),

          rect(
            'Segunda fundo',
            600,
            545,
            520,
            170,
            '#38BDF8',
            { rx: 18, ry: 18 }
          ),
          rect(
            'Terça fundo',
            1140,
            545,
            520,
            170,
            '#0EA5E9',
            { rx: 18, ry: 18 }
          ),
          rect(
            'Quarta fundo',
            1680,
            545,
            520,
            170,
            '#0284C7',
            { rx: 18, ry: 18 }
          ),
          rect(
            'Quinta fundo',
            2220,
            545,
            520,
            170,
            '#0369A1',
            { rx: 18, ry: 18 }
          ),
          rect(
            'Sexta fundo',
            2760,
            545,
            520,
            170,
            '#075985',
            { rx: 18, ry: 18 }
          ),
          text(
            'Segunda',
            'SEGUNDA',
            635,
            595,
            450,
            48,
            '#0F172A',
            {
              fontWeight: 700,
              textAlign: 'center'
            }
          ),
          text(
            'Terça',
            'TERÇA',
            1175,
            595,
            450,
            48,
            '#FFFFFF',
            {
              fontWeight: 700,
              textAlign: 'center'
            }
          ),
          text(
            'Quarta',
            'QUARTA',
            1715,
            595,
            450,
            48,
            '#FFFFFF',
            {
              fontWeight: 700,
              textAlign: 'center'
            }
          ),
          text(
            'Quinta',
            'QUINTA',
            2255,
            595,
            450,
            48,
            '#FFFFFF',
            {
              fontWeight: 700,
              textAlign: 'center'
            }
          ),
          text(
            'Sexta',
            'SEXTA',
            2795,
            595,
            450,
            48,
            '#FFFFFF',
            {
              fontWeight: 700,
              textAlign: 'center'
            }
          ),

          rect(
            'Linha 1 horas',
            150,
            745,
            430,
            230,
            '#FFFFFF',
            {
              stroke: '#CBD5E1',
              strokeWidth: 3,
              rx: 14,
              ry: 14
            }
          ),
          rect(
            'Linha 1 segunda',
            600,
            745,
            520,
            230,
            '#FFFFFF',
            {
              stroke: '#CBD5E1',
              strokeWidth: 3,
              rx: 14,
              ry: 14
            }
          ),
          rect(
            'Linha 1 terça',
            1140,
            745,
            520,
            230,
            '#FFFFFF',
            {
              stroke: '#CBD5E1',
              strokeWidth: 3,
              rx: 14,
              ry: 14
            }
          ),
          rect(
            'Linha 1 quarta',
            1680,
            745,
            520,
            230,
            '#FFFFFF',
            {
              stroke: '#CBD5E1',
              strokeWidth: 3,
              rx: 14,
              ry: 14
            }
          ),
          rect(
            'Linha 1 quinta',
            2220,
            745,
            520,
            230,
            '#FFFFFF',
            {
              stroke: '#CBD5E1',
              strokeWidth: 3,
              rx: 14,
              ry: 14
            }
          ),
          rect(
            'Linha 1 sexta',
            2760,
            745,
            520,
            230,
            '#FFFFFF',
            {
              stroke: '#CBD5E1',
              strokeWidth: 3,
              rx: 14,
              ry: 14
            }
          ),

          rect(
            'Linha 2 horas',
            150,
            995,
            430,
            230,
            '#E2E8F0',
            {
              stroke: '#CBD5E1',
              strokeWidth: 3,
              rx: 14,
              ry: 14
            }
          ),
          rect(
            'Linha 2 segunda',
            600,
            995,
            520,
            230,
            '#F8FAFC',
            {
              stroke: '#CBD5E1',
              strokeWidth: 3,
              rx: 14,
              ry: 14
            }
          ),
          rect(
            'Linha 2 terça',
            1140,
            995,
            520,
            230,
            '#F8FAFC',
            {
              stroke: '#CBD5E1',
              strokeWidth: 3,
              rx: 14,
              ry: 14
            }
          ),
          rect(
            'Linha 2 quarta',
            1680,
            995,
            520,
            230,
            '#F8FAFC',
            {
              stroke: '#CBD5E1',
              strokeWidth: 3,
              rx: 14,
              ry: 14
            }
          ),
          rect(
            'Linha 2 quinta',
            2220,
            995,
            520,
            230,
            '#F8FAFC',
            {
              stroke: '#CBD5E1',
              strokeWidth: 3,
              rx: 14,
              ry: 14
            }
          ),
          rect(
            'Linha 2 sexta',
            2760,
            995,
            520,
            230,
            '#F8FAFC',
            {
              stroke: '#CBD5E1',
              strokeWidth: 3,
              rx: 14,
              ry: 14
            }
          ),

          rect(
            'Linha 3 horas',
            150,
            1245,
            430,
            230,
            '#FFFFFF',
            {
              stroke: '#CBD5E1',
              strokeWidth: 3,
              rx: 14,
              ry: 14
            }
          ),
          rect(
            'Linha 3 segunda',
            600,
            1245,
            520,
            230,
            '#FFFFFF',
            {
              stroke: '#CBD5E1',
              strokeWidth: 3,
              rx: 14,
              ry: 14
            }
          ),
          rect(
            'Linha 3 terça',
            1140,
            1245,
            520,
            230,
            '#FFFFFF',
            {
              stroke: '#CBD5E1',
              strokeWidth: 3,
              rx: 14,
              ry: 14
            }
          ),
          rect(
            'Linha 3 quarta',
            1680,
            1245,
            520,
            230,
            '#FFFFFF',
            {
              stroke: '#CBD5E1',
              strokeWidth: 3,
              rx: 14,
              ry: 14
            }
          ),
          rect(
            'Linha 3 quinta',
            2220,
            1245,
            520,
            230,
            '#FFFFFF',
            {
              stroke: '#CBD5E1',
              strokeWidth: 3,
              rx: 14,
              ry: 14
            }
          ),
          rect(
            'Linha 3 sexta',
            2760,
            1245,
            520,
            230,
            '#FFFFFF',
            {
              stroke: '#CBD5E1',
              strokeWidth: 3,
              rx: 14,
              ry: 14
            }
          ),

          rect(
            'Linha 4 horas',
            150,
            1495,
            430,
            230,
            '#E2E8F0',
            {
              stroke: '#CBD5E1',
              strokeWidth: 3,
              rx: 14,
              ry: 14
            }
          ),
          rect(
            'Linha 4 segunda',
            600,
            1495,
            520,
            230,
            '#F8FAFC',
            {
              stroke: '#CBD5E1',
              strokeWidth: 3,
              rx: 14,
              ry: 14
            }
          ),
          rect(
            'Linha 4 terça',
            1140,
            1495,
            520,
            230,
            '#F8FAFC',
            {
              stroke: '#CBD5E1',
              strokeWidth: 3,
              rx: 14,
              ry: 14
            }
          ),
          rect(
            'Linha 4 quarta',
            1680,
            1495,
            520,
            230,
            '#F8FAFC',
            {
              stroke: '#CBD5E1',
              strokeWidth: 3,
              rx: 14,
              ry: 14
            }
          ),
          rect(
            'Linha 4 quinta',
            2220,
            1495,
            520,
            230,
            '#F8FAFC',
            {
              stroke: '#CBD5E1',
              strokeWidth: 3,
              rx: 14,
              ry: 14
            }
          ),
          rect(
            'Linha 4 sexta',
            2760,
            1495,
            520,
            230,
            '#F8FAFC',
            {
              stroke: '#CBD5E1',
              strokeWidth: 3,
              rx: 14,
              ry: 14
            }
          ),

          rect(
            'Linha 5 horas',
            150,
            1745,
            430,
            230,
            '#FFFFFF',
            {
              stroke: '#CBD5E1',
              strokeWidth: 3,
              rx: 14,
              ry: 14
            }
          ),
          rect(
            'Linha 5 segunda',
            600,
            1745,
            520,
            230,
            '#FFFFFF',
            {
              stroke: '#CBD5E1',
              strokeWidth: 3,
              rx: 14,
              ry: 14
            }
          ),
          rect(
            'Linha 5 terça',
            1140,
            1745,
            520,
            230,
            '#FFFFFF',
            {
              stroke: '#CBD5E1',
              strokeWidth: 3,
              rx: 14,
              ry: 14
            }
          ),
          rect(
            'Linha 5 quarta',
            1680,
            1745,
            520,
            230,
            '#FFFFFF',
            {
              stroke: '#CBD5E1',
              strokeWidth: 3,
              rx: 14,
              ry: 14
            }
          ),
          rect(
            'Linha 5 quinta',
            2220,
            1745,
            520,
            230,
            '#FFFFFF',
            {
              stroke: '#CBD5E1',
              strokeWidth: 3,
              rx: 14,
              ry: 14
            }
          ),
          rect(
            'Linha 5 sexta',
            2760,
            1745,
            520,
            230,
            '#FFFFFF',
            {
              stroke: '#CBD5E1',
              strokeWidth: 3,
              rx: 14,
              ry: 14
            }
          ),

          text(
            'Hora 1',
            '08:30–10:00',
            190,
            825,
            350,
            44,
            '#334155',
            {
              fontWeight: 700,
              textAlign: 'center'
            }
          ),
          text(
            'Hora 2',
            '10:15–11:45',
            190,
            1075,
            350,
            44,
            '#334155',
            {
              fontWeight: 700,
              textAlign: 'center'
            }
          ),
          text(
            'Hora 3',
            '12:00–13:30',
            190,
            1325,
            350,
            44,
            '#334155',
            {
              fontWeight: 700,
              textAlign: 'center'
            }
          ),
          text(
            'Hora 4',
            '14:30–16:00',
            190,
            1575,
            350,
            44,
            '#334155',
            {
              fontWeight: 700,
              textAlign: 'center'
            }
          ),
          text(
            'Hora 5',
            '16:15–17:45',
            190,
            1825,
            350,
            44,
            '#334155',
            {
              fontWeight: 700,
              textAlign: 'center'
            }
          ),

          text(
            'Exemplo 1',
            'DISCIPLINA / ATIVIDADE',
            640,
            825,
            440,
            38,
            '#0F172A',
            {
              fontWeight: 700,
              textAlign: 'center'
            }
          ),
          text(
            'Exemplo 2',
            'SALA / LOCAL',
            1180,
            1075,
            440,
            38,
            '#64748B',
            {
              textAlign: 'center'
            }
          ),
          text(
            'Nota',
            'Edite os horários, dias e blocos diretamente no quadro.',
            180,
            2175,
            2400,
            42,
            '#64748B'
          ),
          text(
            'Marca do horário',
            'MA-CODE.PT',
            2700,
            2165,
            600,
            42,
            '#0284C7',
            {
              fontWeight: 700,
              textAlign: 'right',
              charSpacing: 80
            }
          )
        ]
      )
    ]
  )
]

export async function seedMAQuadroTemplates() {
  for (
    const starter
    of MA_QUADRO_STARTER_PROJECTS
  ) {
    await saveMAQuadroProject(
      starter
    )
  }
}
