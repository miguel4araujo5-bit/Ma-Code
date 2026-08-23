import type {
  MAQuadroPage,
  MAQuadroProject,
  MAQuadroProjectCategory
} from '../../types/maQuadro'

import {
  createDefaultBackground,
  createMAQuadroId
} from './project'

const templateTimestamp =
  '2026-08-23T00:00:00.000Z'

type Palette = {
  background: string
  foreground: string
  muted: string
  accent: string
  soft: string
}

function canvas(
  objects:
    Record<
      string,
      unknown
    >[]
) {
  return {
    version:
      '7.4.0',
    objects
  }
}

function page(
  id: string,
  name: string,
  width: number,
  height: number,
  color: string,
  objects:
    Record<
      string,
      unknown
    >[]
): MAQuadroPage {
  return {
    id,
    name,
    width,
    height,
    background:
      createDefaultBackground(
        color
      ),
    canvasJson:
      canvas(
        objects
      )
  }
}

function project(
  id: string,
  name: string,
  category:
    MAQuadroProjectCategory,
  pages:
    MAQuadroPage[]
): MAQuadroProject {
  return {
    schemaVersion: 2,
    id,
    name,
    pages,
    activePageId:
      pages[0].id,
    category,
    isTemplate: true,
    createdAt:
      templateTimestamp,
    updatedAt:
      templateTimestamp
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
  extra:
    Record<
      string,
      unknown
    > = {}
) {
  return {
    type: 'Textbox',

    maId:
      createMAQuadroId(
        'template-object'
      ),

    maName: name,

    maRole:
      'text',

    originX:
      'left',

    originY:
      'top',

    left,
    top,
    width,

    text:
      value,

    fontFamily:
      'Arial',

    fontSize,
    fill,

    lineHeight:
      1.05,

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
  extra:
    Record<
      string,
      unknown
    > = {}
) {
  return {
    type: 'Rect',

    maId:
      createMAQuadroId(
        'template-object'
      ),

    maName:
      name,

    maRole:
      'shape',

    originX:
      'left',

    originY:
      'top',

    left,
    top,
    width,
    height,
    fill,

    strokeWidth:
      0,

    ...extra
  }
}

function circle(
  name: string,
  left: number,
  top: number,
  radius: number,
  fill: string,
  extra:
    Record<
      string,
      unknown
    > = {}
) {
  return {
    type:
      'Circle',

    maId:
      createMAQuadroId(
        'template-object'
      ),

    maName:
      name,

    maRole:
      'shape',

    originX:
      'left',

    originY:
      'top',

    left,
    top,
    radius,
    fill,

    strokeWidth:
      0,

    ...extra
  }
}

function imagePlaceholder(
  name: string,
  left: number,
  top: number,
  width: number,
  height: number,
  fill: string,
  stroke: string
) {
  return [
    rect(
      name,
      left,
      top,
      width,
      height,
      fill,
      {
        rx:
          Math.min(
            46,
            width *
              0.06
          ),

        ry:
          Math.min(
            46,
            width *
              0.06
          ),

        stroke,

        strokeWidth:
          4,

        strokeDashArray: [
          18,
          14
        ]
      }
    ),

    text(
      `${name} texto`,
      'ARRASTE UMA IMAGEM PARA AQUI',
      left +
        width *
          0.14,
      top +
        height *
          0.46,
      width *
        0.72,
      Math.max(
        26,
        Math.min(
          40,
          width *
            0.04
        )
      ),
      stroke,
      {
        fontWeight:
          700,

        textAlign:
          'center'
      }
    )
  ]
}

function socialTemplate({
  id,
  name,
  eyebrow,
  title,
  body,
  cta,
  palette,
  editorial = false
}: {
  id: string
  name: string
  eyebrow: string
  title: string
  body: string
  cta: string
  palette: Palette
  editorial?: boolean
}) {
  const objects:
    Record<
      string,
      unknown
    >[] = [
    rect(
      'Faixa',
      0,
      0,
      34,
      1080,
      palette.accent
    ),

    circle(
      'Forma grande',
      748,
      48,
      180,
      palette.soft,
      {
        opacity:
          0.85
      }
    ),

    text(
      'Etiqueta',
      eyebrow,
      96,
      118,
      720,
      30,
      palette.accent,
      {
        fontWeight:
          700,

        charSpacing:
          120
      }
    ),

    text(
      'Título',
      title,
      92,
      300,
      820,
      editorial
        ? 76
        : 94,
      palette.foreground,
      {
        fontFamily:
          editorial
            ? 'Georgia'
            : 'Arial',

        fontWeight:
          700,

        lineHeight:
          editorial
            ? 1.08
            : 0.94
      }
    ),

    text(
      'Descrição',
      body,
      96,
      690,
      700,
      34,
      palette.muted,
      {
        lineHeight:
          1.3
      }
    ),

    rect(
      'Botão',
      96,
      864,
      382,
      94,
      palette.accent,
      {
        rx:
          47,

        ry:
          47
      }
    ),

    text(
      'Botão texto',
      cta,
      126,
      893,
      322,
      27,
      palette.background,
      {
        fontWeight:
          700,

        textAlign:
          'center'
      }
    )
  ]

  return project(
    id,
    name,
    'social',
    [
      page(
        `${id}-page-1`,
        'Design',
        1080,
        1080,
        palette.background,
        objects
      )
    ]
  )
}

function storyTemplate({
  id,
  name,
  eyebrow,
  title,
  body,
  palette,
  withImage
}: {
  id: string
  name: string
  eyebrow: string
  title: string
  body: string
  palette: Palette
  withImage: boolean
}) {
  const objects:
    Record<
      string,
      unknown
    >[] = [
    circle(
      'Forma superior',
      760,
      36,
      190,
      palette.soft,
      {
        opacity:
          0.9
      }
    ),

    text(
      'Etiqueta',
      eyebrow,
      82,
      132,
      760,
      31,
      palette.accent,
      {
        fontWeight:
          700,

        charSpacing:
          120
      }
    )
  ]

  if (
    withImage
  ) {
    objects.push(
      ...imagePlaceholder(
        'Imagem',
        74,
        330,
        932,
        650,
        palette.soft,
        palette.muted
      )
    )
  }

  objects.push(
    text(
      'Título',
      title,
      78,
      withImage
        ? 1110
        : 500,
      900,
      96,
      palette.foreground,
      {
        fontWeight:
          700,

        lineHeight:
          0.94
      }
    ),

    text(
      'Descrição',
      body,
      82,
      withImage
        ? 1460
        : 1130,
      820,
      36,
      palette.muted,
      {
        lineHeight:
          1.35
      }
    ),

    rect(
      'CTA',
      82,
      1690,
      916,
      110,
      palette.accent,
      {
        rx:
          55,

        ry:
          55
      }
    ),

    text(
      'CTA texto',
      'SABER MAIS',
      260,
      1724,
      560,
      32,
      palette.background,
      {
        fontWeight:
          700,

        textAlign:
          'center'
      }
    )
  )

  return project(
    id,
    name,
    'story',
    [
      page(
        `${id}-page-1`,
        'Story',
        1080,
        1920,
        palette.background,
        objects
      )
    ]
  )
}

function presentationTemplate({
  id,
  name,
  eyebrow,
  title,
  palette,
  portfolio = false
}: {
  id: string
  name: string
  eyebrow: string
  title: string
  palette: Palette
  portfolio?: boolean
}) {
  const cover:
    Record<
      string,
      unknown
    >[] = [
    rect(
      'Faixa',
      0,
      0,
      130,
      1080,
      palette.accent
    ),

    text(
      'Etiqueta',
      eyebrow,
      240,
      154,
      900,
      32,
      palette.accent,
      {
        fontWeight:
          700,

        charSpacing:
          120
      }
    ),

    text(
      'Título',
      title,
      232,
      330,
      portfolio
        ? 900
        : 1160,
      124,
      palette.foreground,
      {
        fontWeight:
          700,

        lineHeight:
          0.9
      }
    )
  ]

  if (
    portfolio
  ) {
    cover.push(
      ...imagePlaceholder(
        'Imagem de capa',
        1320,
        110,
        500,
        850,
        palette.soft,
        palette.muted
      )
    )
  } else {
    cover.push(
      circle(
        'Forma',
        1480,
        210,
        230,
        palette.soft
      ),

      text(
        'Rodapé',
        'NOME · PROJETO · 2026',
        240,
        846,
        1000,
        38,
        palette.muted
      )
    )
  }

  const content:
    Record<
      string,
      unknown
    >[] =
    portfolio
      ? [
          ...imagePlaceholder(
            'Projeto',
            90,
            90,
            1040,
            900,
            palette.soft,
            palette.muted
          ),

          text(
            'Etiqueta',
            'PROJETO 01',
            1240,
            150,
            520,
            34,
            palette.accent,
            {
              fontWeight:
                700,

              charSpacing:
                100
            }
          ),

          text(
            'Título',
            'NOME DO\nPROJETO',
            1236,
            320,
            560,
            88,
            palette.foreground,
            {
              fontWeight:
                700,

              lineHeight:
                0.94
            }
          ),

          text(
            'Descrição',
            'Contexto, objetivo e resultado. Mantenha a explicação curta e deixe o trabalho respirar.',
            1240,
            610,
            520,
            36,
            palette.muted,
            {
              lineHeight:
                1.4
            }
          )
        ]
      : [
          text(
            'Número',
            '01',
            120,
            86,
            180,
            52,
            palette.accent,
            {
              fontWeight:
                700
            }
          ),

          text(
            'Título',
            'A IDEIA PRINCIPAL',
            120,
            230,
            1100,
            90,
            palette.foreground,
            {
              fontWeight:
                700
            }
          ),

          text(
            'Texto',
            'Explique a mensagem central em poucas linhas e use o espaço restante para dados, imagem ou contexto.',
            124,
            430,
            880,
            42,
            palette.muted,
            {
              lineHeight:
                1.4
            }
          ),

          rect(
            'Destaque',
            1180,
            180,
            600,
            650,
            palette.soft,
            {
              rx:
                42,

              ry:
                42
            }
          ),

          text(
            'Métrica',
            '72%',
            1260,
            330,
            440,
            132,
            palette.accent,
            {
              fontWeight:
                700,

              textAlign:
                'center'
            }
          ),

          text(
            'Métrica legenda',
            'MÉTRICA PRINCIPAL',
            1260,
            536,
            440,
            30,
            palette.foreground,
            {
              fontWeight:
                700,

              textAlign:
                'center'
            }
          )
        ]

  return project(
    id,
    name,
    'presentation',
    [
      page(
        `${id}-page-1`,
        'Capa',
        1920,
        1080,
        palette.background,
        cover
      ),

      page(
        `${id}-page-2`,
        portfolio
          ? 'Projeto'
          : 'Conteúdo',
        1920,
        1080,
        palette.background,
        content
      )
    ]
  )
}

function a4Template({
  id,
  name,
  eyebrow,
  title,
  body,
  palette,
  layout
}: {
  id: string
  name: string
  eyebrow: string
  title: string
  body: string
  palette: Palette
  layout:
    | 'flyer'
    | 'menu'
    | 'cv'
}) {
  const objects:
    Record<
      string,
      unknown
    >[] = []

  if (
    layout ===
    'cv'
  ) {
    objects.push(
      rect(
        'Coluna lateral',
        0,
        0,
        720,
        3508,
        palette.foreground
      ),

      circle(
        'Fotografia',
        180,
        190,
        180,
        palette.muted
      ),

      text(
        'Contacto título',
        'CONTACTO',
        100,
        720,
        500,
        46,
        palette.accent,
        {
          fontWeight:
            700
        }
      ),

      text(
        'Contacto',
        'email@exemplo.pt\n+351 000 000 000\nPorto, Portugal',
        100,
        850,
        500,
        40,
        palette.soft,
        {
          lineHeight:
            1.6
        }
      ),

      text(
        'Nome',
        title,
        900,
        220,
        1350,
        132,
        palette.foreground,
        {
          fontWeight:
            700,

          lineHeight:
            0.9
        }
      ),

      text(
        'Função',
        eyebrow,
        910,
        570,
        1200,
        50,
        palette.accent,
        {
          fontWeight:
            700,

          charSpacing:
            100
        }
      ),

      text(
        'Perfil título',
        'PERFIL',
        910,
        900,
        1200,
        54,
        palette.foreground,
        {
          fontWeight:
            700
        }
      ),

      text(
        'Perfil',
        body,
        910,
        1060,
        1300,
        48,
        palette.muted,
        {
          lineHeight:
            1.45
        }
      ),

      text(
        'Experiência título',
        'EXPERIÊNCIA',
        910,
        1570,
        1200,
        54,
        palette.foreground,
        {
          fontWeight:
            700
        }
      ),

      text(
        'Experiência',
        '2023–2026  ·  EMPRESA / FUNÇÃO\nResponsabilidade, impacto e resultados.\n\n2020–2023  ·  EMPRESA / FUNÇÃO\nInformação concreta e relevante.',
        910,
        1740,
        1300,
        46,
        palette.muted,
        {
          lineHeight:
            1.55
        }
      )
    )
  } else if (
    layout ===
    'menu'
  ) {
    objects.push(
      text(
        'Marca',
        eyebrow,
        220,
        180,
        2040,
        66,
        palette.accent,
        {
          fontWeight:
            700,

          textAlign:
            'center',

          charSpacing:
            150
        }
      ),

      text(
        'Título',
        title,
        220,
        430,
        2040,
        170,
        palette.foreground,
        {
          fontFamily:
            'Georgia',

          fontWeight:
            700,

          textAlign:
            'center'
        }
      ),

      rect(
        'Linha',
        720,
        720,
        1040,
        8,
        palette.accent
      ),

      text(
        'Secção 1',
        'ENTRADAS',
        220,
        920,
        2040,
        64,
        palette.accent,
        {
          fontWeight:
            700,

          textAlign:
            'center'
        }
      ),

      text(
        'Itens 1',
        'Prato de exemplo ................................ 8 €\nOutro prato ........................................ 10 €\nEspecialidade ....................................... 12 €',
        380,
        1130,
        1720,
        54,
        palette.muted,
        {
          lineHeight:
            1.65
        }
      ),

      text(
        'Secção 2',
        'PRINCIPAIS',
        220,
        1940,
        2040,
        64,
        palette.accent,
        {
          fontWeight:
            700,

          textAlign:
            'center'
        }
      ),

      text(
        'Itens 2',
        body,
        380,
        2150,
        1720,
        54,
        palette.muted,
        {
          lineHeight:
            1.65
        }
      )
    )
  } else {
    objects.push(
      rect(
        'Topo',
        0,
        0,
        2480,
        1120,
        palette.foreground
      ),

      circle(
        'Forma',
        1740,
        140,
        360,
        palette.accent,
        {
          opacity:
            0.78
        }
      ),

      text(
        'Etiqueta',
        eyebrow,
        190,
        220,
        1200,
        58,
        palette.soft,
        {
          fontWeight:
            700,

          charSpacing:
            120
        }
      ),

      text(
        'Título',
        title,
        180,
        450,
        1780,
        170,
        palette.background,
        {
          fontWeight:
            700,

          lineHeight:
            0.9
        }
      ),

      text(
        'Descrição',
        body,
        190,
        1380,
        1820,
        76,
        palette.muted,
        {
          lineHeight:
            1.35
        }
      ),

      rect(
        'Bloco 1',
        190,
        2050,
        640,
        520,
        palette.soft,
        {
          rx:
            36,

          ry:
            36
        }
      ),

      rect(
        'Bloco 2',
        920,
        2050,
        640,
        520,
        palette.soft,
        {
          rx:
            36,

          ry:
            36
        }
      ),

      rect(
        'Bloco 3',
        1650,
        2050,
        640,
        520,
        palette.soft,
        {
          rx:
            36,

          ry:
            36
        }
      ),

      text(
        'Contacto',
        'CONTACTO@EXEMPLO.PT  ·  +351 000 000 000',
        190,
        3070,
        2100,
        60,
        palette.accent,
        {
          fontWeight:
            700
        }
      )
    )
  }

  return project(
    id,
    name,
    'print',
    [
      page(
        `${id}-page-1`,
        name,
        2480,
        3508,
        palette.background,
        objects
      )
    ]
  )
}

function invitationTemplate({
  id,
  name,
  eyebrow,
  title,
  date,
  palette
}: {
  id: string
  name: string
  eyebrow: string
  title: string
  date: string
  palette: Palette
}) {
  return project(
    id,
    name,
    'invitation',
    [
      page(
        `${id}-page-1`,
        'Convite',
        1200,
        1800,
        palette.background,
        [
          circle(
            'Forma superior',
            810,
            -100,
            260,
            palette.accent,
            {
              opacity:
                0.74
            }
          ),

          circle(
            'Forma inferior',
            -180,
            1390,
            310,
            palette.soft,
            {
              opacity:
                0.74
            }
          ),

          text(
            'Etiqueta',
            eyebrow,
            150,
            230,
            900,
            34,
            palette.accent,
            {
              fontWeight:
                700,

              textAlign:
                'center',

              charSpacing:
                140
            }
          ),

          text(
            'Título',
            title,
            150,
            520,
            900,
            112,
            palette.foreground,
            {
              fontWeight:
                700,

              textAlign:
                'center',

              lineHeight:
                0.92
            }
          ),

          text(
            'Data',
            date,
            150,
            1010,
            900,
            50,
            palette.soft,
            {
              fontWeight:
                700,

              textAlign:
                'center'
            }
          ),

          text(
            'Local',
            'LOCAL DO EVENTO · PORTO',
            150,
            1160,
            900,
            34,
            palette.muted,
            {
              textAlign:
                'center'
            }
          ),

          rect(
            'Confirmar',
            300,
            1400,
            600,
            110,
            palette.foreground,
            {
              rx:
                55,

              ry:
                55
            }
          ),

          text(
            'Confirmar texto',
            'CONFIRMAR PRESENÇA',
            350,
            1434,
            500,
            30,
            palette.background,
            {
              fontWeight:
                700,

              textAlign:
                'center'
            }
          )
        ]
      )
    ]
  )
}

const orange:
  Palette = {
  background:
    '#FFF7ED',

  foreground:
    '#431407',

  muted:
    '#7C2D12',

  accent:
    '#F97316',

  soft:
    '#FED7AA'
}

const violet:
  Palette = {
  background:
    '#F8FAFC',

  foreground:
    '#0F172A',

  muted:
    '#64748B',

  accent:
    '#7C3AED',

  soft:
    '#DDD6FE'
}

const night:
  Palette = {
  background:
    '#111827',

  foreground:
    '#FFFFFF',

  muted:
    '#CBD5E1',

  accent:
    '#38BDF8',

  soft:
    '#1E3A8A'
}

const green:
  Palette = {
  background:
    '#ECFDF5',

  foreground:
    '#052E16',

  muted:
    '#047857',

  accent:
    '#059669',

  soft:
    '#A7F3D0'
}

const indigo:
  Palette = {
  background:
    '#EEF2FF',

  foreground:
    '#1E1B4B',

  muted:
    '#6366F1',

  accent:
    '#4F46E5',

  soft:
    '#C7D2FE'
}

const zinc:
  Palette = {
  background:
    '#18181B',

  foreground:
    '#FFFFFF',

  muted:
    '#A1A1AA',

  accent:
    '#A78BFA',

  soft:
    '#3F3F46'
}

const sky:
  Palette = {
  background:
    '#FFFFFF',

  foreground:
    '#0F172A',

  muted:
    '#475569',

  accent:
    '#0284C7',

  soft:
    '#E0F2FE'
}

const amber:
  Palette = {
  background:
    '#FFFBEB',

  foreground:
    '#451A03',

  muted:
    '#78350F',

  accent:
    '#D97706',

  soft:
    '#FEF3C7'
}

export const MA_QUADRO_EXTRA_STARTER_PROJECTS:
  MAQuadroProject[] = [
  socialTemplate({
    id:
      'template-social-promocao-v1',

    name:
      'Social — Promoção',

    eyebrow:
      'OFERTA ESPECIAL',

    title:
      'ATÉ 40%\nDE DESCONTO',

    body:
      'Uma mensagem curta que explica a promoção e cria urgência.',

    cta:
      'APROVEITAR AGORA',

    palette:
      orange
  }),

  socialTemplate({
    id:
      'template-social-citacao-v1',

    name:
      'Social — Citação editorial',

    eyebrow:
      'IDEIA DO DIA',

    title:
      'UMA BOA IDEIA\nTORNA-SE MELHOR\nQUANDO É BEM\nCOMUNICADA.',

    body:
      'NOME · FUNÇÃO',

    cta:
      'GUARDAR',

    palette:
      violet,

    editorial:
      true
  }),

  socialTemplate({
    id:
      'template-social-evento-v1',

    name:
      'Social — Evento',

    eyebrow:
      '24 SET · 18:30',

    title:
      'ENCONTRO\nCRIATIVO',

    body:
      'Ideias, pessoas e ferramentas para criar melhor.',

    cta:
      'VER PROGRAMA',

    palette:
      night
  }),

  socialTemplate({
    id:
      'template-social-testemunho-v1',

    name:
      'Social — Testemunho',

    eyebrow:
      'O QUE DIZEM',

    title:
      '“O PROCESSO FOI\nSIMPLES, CLARO E\nO RESULTADO SUPEROU\nAS EXPECTATIVAS.”',

    body:
      'ANA MARTINS · CLIENTE',

    cta:
      'VER PROJETO',

    palette:
      green,

    editorial:
      true
  }),

  storyTemplate({
    id:
      'template-story-promocao-v1',

    name:
      'Story — Promoção',

    eyebrow:
      'SÓ ESTA SEMANA',

    title:
      'UMA OFERTA\nDIFÍCIL DE IGNORAR.',

    body:
      'Use a imagem, a mensagem e um CTA claro para comunicar rapidamente.',

    palette:
      zinc,

    withImage:
      true
  }),

  storyTemplate({
    id:
      'template-story-pergunta-v1',

    name:
      'Story — Pergunta',

    eyebrow:
      'VAMOS CONVERSAR',

    title:
      'QUAL É O MAIOR\nDESAFIO DO SEU\nPROJETO AGORA?',

    body:
      'Edite esta área para incentivar respostas, opiniões ou participação.',

    palette:
      indigo,

    withImage:
      false
  }),

  presentationTemplate({
    id:
      'template-presentation-business-v1',

    name:
      'Apresentação — Negócio minimal',

    eyebrow:
      'APRESENTAÇÃO 2026',

    title:
      'ESTRATÉGIA\nQUE SE ENTENDE.',

    palette:
      sky
  }),

  presentationTemplate({
    id:
      'template-presentation-portfolio-v1',

    name:
      'Apresentação — Portefólio',

    eyebrow:
      'PORTEFÓLIO · 2026',

    title:
      'TRABALHO\nQUE FALA POR SI.',

    palette:
      zinc,

    portfolio:
      true
  }),

  a4Template({
    id:
      'template-print-flyer-servico-v1',

    name:
      'Flyer A4 — Serviço',

    eyebrow:
      'SERVIÇO EM DESTAQUE',

    title:
      'UMA SOLUÇÃO\nFEITA PARA SI.',

    body:
      'Explique de forma simples o benefício principal do serviço e o que torna a sua proposta diferente.',

    palette:
      sky,

    layout:
      'flyer'
  }),

  a4Template({
    id:
      'template-print-menu-v1',

    name:
      'Menu A4 — Minimal',

    eyebrow:
      'NOME DO ESPAÇO',

    title:
      'MENU',

    body:
      'Prato principal .................................. 16 €\nSugestão da casa ................................. 18 €\nOpção especial ..................................... 20 €',

    palette:
      amber,

    layout:
      'menu'
  }),

  a4Template({
    id:
      'template-print-cv-v1',

    name:
      'CV A4 — Profissional',

    eyebrow:
      'FUNÇÃO PROFISSIONAL',

    title:
      'NOME\nAPELIDO',

    body:
      'Resumo profissional curto, focado no valor que oferece e na experiência mais relevante.',

    palette:
      sky,

    layout:
      'cv'
  }),

  invitationTemplate({
    id:
      'template-invitation-modern-v1',

    name:
      'Convite — Moderno',

    eyebrow:
      'ESTÁ CONVIDADO',

    title:
      'UMA NOITE\nESPECIAL',

    date:
      '12 · 10 · 2026',

    palette:
      zinc
  })
]
