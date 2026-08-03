import type {
  MAQuadroCanvasPreset,
  MAQuadroDesign
} from '../../types/maQuadro'
import {
  listMAQuadroDesigns,
  saveMAQuadroDesign
} from './db'

export const MA_QUADRO_PRESETS: MAQuadroCanvasPreset[] = [
  {
    id: 'instagram-post',
    name: 'Instagram',
    description: 'Publicação quadrada',
    width: 1080,
    height: 1080
  },
  {
    id: 'instagram-story',
    name: 'Story',
    description: 'Story vertical',
    width: 1080,
    height: 1920
  },
  {
    id: 'x-header',
    name: 'Cabeçalho X',
    description: 'Capa horizontal',
    width: 1500,
    height: 500
  },
  {
    id: 'a4-poster',
    name: 'Cartaz A4',
    description: 'A4 a 300 ppp',
    width: 2480,
    height: 3508
  }
]

export function createMAQuadroId(prefix: string) {
  if (
    typeof crypto !== 'undefined' &&
    'randomUUID' in crypto
  ) {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`
}

export function createBlankMAQuadroDesign(
  width: number,
  height: number,
  name: string
): MAQuadroDesign {
  const timestamp = new Date().toISOString()

  return {
    id: createMAQuadroId('design'),
    name,
    width,
    height,
    backgroundColor: '#FFFFFF',
    transparentBackground: false,
    canvasJson: {
      version: '7.4.0',
      objects: []
    },
    isStarter: false,
    createdAt: timestamp,
    updatedAt: timestamp
  }
}

const starterTimestamp = '2026-08-01T00:00:00.000Z'

export const MA_QUADRO_STARTER_DESIGNS: MAQuadroDesign[] = [
  {
    id: 'starter-instagram-impacto',
    name: 'Modelo Instagram Impacto',
    width: 1080,
    height: 1080,
    backgroundColor: '#0F172A',
    transparentBackground: false,
    isStarter: true,
    createdAt: starterTimestamp,
    updatedAt: starterTimestamp,
    canvasJson: {
      version: '7.4.0',
      objects: [
        {
          type: 'Rect',
          maName: 'Faixa violeta',
          originX: 'left',
          originY: 'top',
          left: 70,
          top: 70,
          width: 940,
          height: 28,
          fill: '#8B5CF6',
          rx: 14,
          ry: 14
        },
        {
          type: 'Textbox',
          maName: 'Título principal',
          originX: 'left',
          originY: 'top',
          left: 90,
          top: 215,
          width: 900,
          text: 'A SUA IDEIA\nMERECE IMPACTO.',
          fontFamily: 'Arial',
          fontSize: 104,
          fontWeight: 700,
          lineHeight: 0.95,
          fill: '#FFFFFF'
        },
        {
          type: 'Textbox',
          maName: 'Texto de apoio',
          originX: 'left',
          originY: 'top',
          left: 94,
          top: 530,
          width: 760,
          text: 'Design simples, claro e preparado para comunicar melhor.',
          fontFamily: 'Arial',
          fontSize: 38,
          lineHeight: 1.25,
          fill: '#CBD5E1'
        },
        {
          type: 'Rect',
          maName: 'Botão',
          originX: 'left',
          originY: 'top',
          left: 90,
          top: 820,
          width: 430,
          height: 112,
          fill: '#22D3EE',
          rx: 56,
          ry: 56
        },
        {
          type: 'Textbox',
          maName: 'Texto do botão',
          originX: 'left',
          originY: 'top',
          left: 135,
          top: 849,
          width: 340,
          text: 'SAIBA MAIS',
          fontFamily: 'Arial',
          fontSize: 42,
          fontWeight: 700,
          textAlign: 'center',
          fill: '#0F172A'
        }
      ]
    }
  },
  {
    id: 'starter-story-lancamento',
    name: 'Modelo Story Lançamento',
    width: 1080,
    height: 1920,
    backgroundColor: '#F8FAFC',
    transparentBackground: false,
    isStarter: true,
    createdAt: starterTimestamp,
    updatedAt: starterTimestamp,
    canvasJson: {
      version: '7.4.0',
      objects: [
        {
          type: 'Rect',
          maName: 'Bloco superior',
          originX: 'left',
          originY: 'top',
          left: 0,
          top: 0,
          width: 1080,
          height: 680,
          fill: '#38BDF8'
        },
        {
          type: 'Textbox',
          maName: 'Etiqueta',
          originX: 'left',
          originY: 'top',
          left: 84,
          top: 105,
          width: 700,
          text: 'NOVO LANÇAMENTO',
          fontFamily: 'Arial',
          fontSize: 34,
          fontWeight: 700,
          charSpacing: 80,
          fill: '#0F172A'
        },
        {
          type: 'Textbox',
          maName: 'Título',
          originX: 'left',
          originY: 'top',
          left: 80,
          top: 245,
          width: 900,
          text: 'CRIE.\nEDITE.\nPUBLIQUE.',
          fontFamily: 'Arial',
          fontSize: 126,
          fontWeight: 700,
          lineHeight: 0.9,
          fill: '#0F172A'
        },
        {
          type: 'Rect',
          maName: 'Área de imagem',
          originX: 'left',
          originY: 'top',
          left: 80,
          top: 800,
          width: 920,
          height: 700,
          fill: '#E2E8F0',
          rx: 44,
          ry: 44,
          stroke: '#CBD5E1',
          strokeWidth: 4,
          strokeDashArray: [18, 14]
        },
        {
          type: 'Textbox',
          maName: 'Indicação de imagem',
          originX: 'left',
          originY: 'top',
          left: 250,
          top: 1110,
          width: 580,
          text: 'COLOQUE A SUA IMAGEM',
          fontFamily: 'Arial',
          fontSize: 34,
          fontWeight: 700,
          textAlign: 'center',
          fill: '#64748B'
        },
        {
          type: 'Textbox',
          maName: 'Rodapé',
          originX: 'left',
          originY: 'top',
          left: 80,
          top: 1650,
          width: 920,
          text: 'MA-CODE.PT',
          fontFamily: 'Arial',
          fontSize: 44,
          fontWeight: 700,
          textAlign: 'center',
          fill: '#8B5CF6'
        }
      ]
    }
  },
  {
    id: 'starter-a4-evento',
    name: 'Modelo Cartaz A4 Evento',
    width: 2480,
    height: 3508,
    backgroundColor: '#FFFFFF',
    transparentBackground: false,
    isStarter: true,
    createdAt: starterTimestamp,
    updatedAt: starterTimestamp,
    canvasJson: {
      version: '7.4.0',
      objects: [
        {
          type: 'Rect',
          maName: 'Fundo superior',
          originX: 'left',
          originY: 'top',
          left: 0,
          top: 0,
          width: 2480,
          height: 1450,
          fill: '#0F172A'
        },
        {
          type: 'Rect',
          maName: 'Linha de destaque',
          originX: 'left',
          originY: 'top',
          left: 180,
          top: 210,
          width: 600,
          height: 36,
          fill: '#22D3EE',
          rx: 18,
          ry: 18
        },
        {
          type: 'Textbox',
          maName: 'Título do evento',
          originX: 'left',
          originY: 'top',
          left: 180,
          top: 390,
          width: 2080,
          text: 'ENCONTRO\nCRIATIVO 2026',
          fontFamily: 'Arial',
          fontSize: 250,
          fontWeight: 700,
          lineHeight: 0.95,
          fill: '#FFFFFF'
        },
        {
          type: 'Textbox',
          maName: 'Data e local',
          originX: 'left',
          originY: 'top',
          left: 180,
          top: 1650,
          width: 2080,
          text: '18 SETEMBRO · PORTO',
          fontFamily: 'Arial',
          fontSize: 108,
          fontWeight: 700,
          fill: '#8B5CF6'
        },
        {
          type: 'Textbox',
          maName: 'Descrição',
          originX: 'left',
          originY: 'top',
          left: 180,
          top: 1940,
          width: 1900,
          text: 'Um dia para descobrir ideias, ferramentas e pessoas que transformam projetos em resultados.',
          fontFamily: 'Georgia',
          fontSize: 92,
          lineHeight: 1.3,
          fill: '#334155'
        },
        {
          type: 'Line',
          maName: 'Separador',
          originX: 'left',
          originY: 'top',
          left: 180,
          top: 2750,
          x1: 0,
          y1: 0,
          x2: 2120,
          y2: 0,
          stroke: '#CBD5E1',
          strokeWidth: 8
        },
        {
          type: 'Textbox',
          maName: 'Website',
          originX: 'left',
          originY: 'top',
          left: 180,
          top: 2960,
          width: 2080,
          text: 'MA-CODE.PT',
          fontFamily: 'Arial',
          fontSize: 100,
          fontWeight: 700,
          textAlign: 'right',
          fill: '#0F172A'
        }
      ]
    }
  }
]

export async function seedMAQuadroStarterDesigns() {
  const existing = await listMAQuadroDesigns()
  const existingIds = new Set(
    existing.map((design) => design.id)
  )

  for (const starter of MA_QUADRO_STARTER_DESIGNS) {
    if (!existingIds.has(starter.id)) {
      await saveMAQuadroDesign(starter)
    }
  }
}
