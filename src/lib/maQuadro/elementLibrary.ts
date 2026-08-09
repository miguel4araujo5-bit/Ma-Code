export type MAQuadroElementCategory =
  | 'shapes'
  | 'communication'
  | 'business'
  | 'education'
  | 'technology'
  | 'interface'

export type MAQuadroLibraryElementDefinition = {
  id: string
  name: string
  category: MAQuadroElementCategory
  keywords: string[]
  usesStroke: boolean
  body: string
}

export type MAQuadroLibraryElementDocument = {
  version: 1
  elementId: string
  color: string
  strokeWidth: number
}

export const MA_QUADRO_ELEMENT_CATEGORIES: Array<{
  id: 'all' | MAQuadroElementCategory
  label: string
}> = [
  { id: 'all', label: 'Todos' },
  { id: 'shapes', label: 'Formas' },
  { id: 'communication', label: 'Comunicação' },
  { id: 'business', label: 'Negócio' },
  { id: 'education', label: 'Educação' },
  { id: 'technology', label: 'Tecnologia' },
  { id: 'interface', label: 'Interface' }
]

export const MA_QUADRO_ELEMENT_MIN_STROKE = 4
export const MA_QUADRO_ELEMENT_MAX_STROKE = 40
export const MA_QUADRO_ELEMENT_DEFAULT_COLOR = '#22D3EE'
export const MA_QUADRO_ELEMENT_DEFAULT_STROKE = 18

const SVG_SIZE = 512
const META_START = '\u{E0001}'
const META_END = '\u{E007F}'
const TAG_BASE = 0xE0000
const COLOR_TOKEN = '{{color}}'
const STROKE_TOKEN = '{{stroke}}'

export const MA_QUADRO_LIBRARY_ELEMENTS: MAQuadroLibraryElementDefinition[] = [
  {
    id: 'diamond', name: 'Losango', category: 'shapes',
    keywords: ['losango', 'diamante', 'diamond'], usesStroke: false,
    body: '<polygon points="256,42 470,256 256,470 42,256" fill="{{color}}"/>'
  },
  {
    id: 'pentagon', name: 'Pentágono', category: 'shapes',
    keywords: ['pentagono', 'pentágono', '5 lados'], usesStroke: false,
    body: '<polygon points="256,35 472,192 389,446 123,446 40,192" fill="{{color}}"/>'
  },
  {
    id: 'hexagon', name: 'Hexágono', category: 'shapes',
    keywords: ['hexagono', 'hexágono', '6 lados'], usesStroke: false,
    body: '<polygon points="128,48 384,48 480,256 384,464 128,464 32,256" fill="{{color}}"/>'
  },
  {
    id: 'octagon', name: 'Octógono', category: 'shapes',
    keywords: ['octogono', 'octógono', '8 lados'], usesStroke: false,
    body: '<polygon points="160,38 352,38 474,160 474,352 352,474 160,474 38,352 38,160" fill="{{color}}"/>'
  },
  {
    id: 'heart', name: 'Coração', category: 'shapes',
    keywords: ['coracao', 'coração', 'amor', 'heart'], usesStroke: false,
    body: '<path d="M232 456C201 424 48 316 48 176C48 94 106 50 169 50C208 50 236 72 256 104C277 72 305 50 344 50C407 50 464 94 464 176C464 316 311 424 280 456L256 479Z" fill="{{color}}"/>'
  },
  {
    id: 'cross', name: 'Cruz', category: 'shapes',
    keywords: ['cruz', 'mais', 'plus', 'cross'], usesStroke: false,
    body: '<path d="M196 52H316V196H460V316H316V460H196V316H52V196H196Z" fill="{{color}}"/>'
  },
  {
    id: 'chevron', name: 'Chevron', category: 'shapes',
    keywords: ['chevron', 'seta', 'direita', 'angulo'], usesStroke: false,
    body: '<path d="M82 62H238L430 256L238 450H82L274 256Z" fill="{{color}}"/>'
  },
  {
    id: 'speech-bubble', name: 'Balão de fala', category: 'shapes',
    keywords: ['balao', 'balão', 'fala', 'chat', 'mensagem'], usesStroke: false,
    body: '<path d="M104 64H408C430 64 448 82 448 104V310C448 332 430 350 408 350H256L142 448V350H104C82 350 64 332 64 310V104C64 82 82 64 104 64Z" fill="{{color}}"/>'
  },
  {
    id: 'bolt', name: 'Raio', category: 'shapes',
    keywords: ['raio', 'energia', 'bolt', 'flash'], usesStroke: false,
    body: '<path d="M286 28L92 286H222L188 484L420 204H286Z" fill="{{color}}"/>'
  },
  {
    id: 'badge', name: 'Selo', category: 'shapes',
    keywords: ['selo', 'badge', 'estrela', 'destaque'], usesStroke: false,
    body: '<path d="M256 30L303 82L371 62L391 130L459 150L439 218L491 265L439 312L459 380L391 400L371 468L303 448L256 500L209 448L141 468L121 400L53 380L73 312L21 265L73 218L53 150L121 130L141 62L209 82Z" fill="{{color}}"/>'
  },
  {
    id: 'parallelogram', name: 'Paralelogramo', category: 'shapes',
    keywords: ['paralelogramo', 'inclinado', 'forma'], usesStroke: false,
    body: '<polygon points="142,74 474,74 370,438 38,438" fill="{{color}}"/>'
  },
  {
    id: 'pill', name: 'Cápsula', category: 'shapes',
    keywords: ['capsula', 'cápsula', 'pill', 'botao', 'botão'], usesStroke: false,
    body: '<rect x="38" y="154" width="436" height="204" rx="102" fill="{{color}}"/>'
  },
  {
    id: 'mail', name: 'Email', category: 'communication',
    keywords: ['email', 'mail', 'correio', 'envelope'], usesStroke: true,
    body: '<rect x="58" y="112" width="396" height="288" rx="34" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><path d="M76 138L256 278L436 138" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round" stroke-linejoin="round"/>'
  },
  {
    id: 'phone', name: 'Telefone', category: 'communication',
    keywords: ['telefone', 'phone', 'chamada', 'call'], usesStroke: true,
    body: '<path d="M150 70L214 164L174 212C202 272 240 310 300 338L348 298L442 362C410 424 366 454 310 444C200 425 87 312 68 202C58 146 88 102 150 70Z" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round" stroke-linejoin="round"/>'
  },
  {
    id: 'chat', name: 'Mensagem', category: 'communication',
    keywords: ['mensagem', 'chat', 'conversa', 'fala'], usesStroke: true,
    body: '<path d="M70 82H442V350H250L142 440V350H70Z" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linejoin="round"/><circle cx="174" cy="216" r="14" fill="{{color}}"/><circle cx="256" cy="216" r="14" fill="{{color}}"/><circle cx="338" cy="216" r="14" fill="{{color}}"/>'
  },
  {
    id: 'send', name: 'Enviar', category: 'communication',
    keywords: ['enviar', 'send', 'aviao', 'avião', 'mensagem'], usesStroke: true,
    body: '<path d="M54 244L458 62L340 450L244 286L54 244Z" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linejoin="round"/><path d="M244 286L458 62" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round"/>'
  },
  {
    id: 'briefcase', name: 'Pasta', category: 'business',
    keywords: ['pasta', 'briefcase', 'trabalho', 'negocio', 'negócio'], usesStroke: true,
    body: '<rect x="54" y="142" width="404" height="286" rx="30" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><path d="M176 142V96C176 72 194 54 218 54H294C318 54 336 72 336 96V142M54 238H458M220 238V280H292V238" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round" stroke-linejoin="round"/>'
  },
  {
    id: 'calendar', name: 'Calendário', category: 'business',
    keywords: ['calendario', 'calendário', 'data', 'agenda'], usesStroke: true,
    body: '<rect x="62" y="92" width="388" height="352" rx="30" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><path d="M62 184H450M156 54V126M356 54V126" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round"/><circle cx="166" cy="270" r="18" fill="{{color}}"/><circle cx="256" cy="270" r="18" fill="{{color}}"/><circle cx="346" cy="270" r="18" fill="{{color}}"/><circle cx="166" cy="354" r="18" fill="{{color}}"/><circle cx="256" cy="354" r="18" fill="{{color}}"/>'
  },
  {
    id: 'bar-chart', name: 'Estatísticas', category: 'business',
    keywords: ['grafico', 'gráfico', 'estatisticas', 'estatísticas', 'barras'], usesStroke: true,
    body: '<path d="M76 430V82M76 430H452" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round"/><rect x="126" y="292" width="66" height="138" rx="10" fill="{{color}}"/><rect x="228" y="210" width="66" height="220" rx="10" fill="{{color}}"/><rect x="330" y="122" width="66" height="308" rx="10" fill="{{color}}"/>'
  },
  {
    id: 'target', name: 'Objetivo', category: 'business',
    keywords: ['objetivo', 'target', 'meta', 'alvo'], usesStroke: true,
    body: '<circle cx="242" cy="270" r="172" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><circle cx="242" cy="270" r="102" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><circle cx="242" cy="270" r="34" fill="{{color}}"/><path d="M264 248L438 74M368 74H438V144" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round" stroke-linejoin="round"/>'
  },
  {
    id: 'book', name: 'Livro', category: 'education',
    keywords: ['livro', 'book', 'educacao', 'educação', 'estudo'], usesStroke: true,
    body: '<path d="M70 92H210C244 92 256 112 256 144V432C246 406 224 392 190 392H70ZM442 92H302C268 92 256 112 256 144V432C266 406 288 392 322 392H442Z" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linejoin="round"/>'
  },
  {
    id: 'graduation-cap', name: 'Graduação', category: 'education',
    keywords: ['graduacao', 'graduação', 'escola', 'universidade', 'cap'], usesStroke: true,
    body: '<path d="M42 190L256 88L470 190L256 292Z" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linejoin="round"/><path d="M134 246V344C174 392 338 392 378 344V246M470 190V350" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round" stroke-linejoin="round"/><circle cx="470" cy="378" r="20" fill="{{color}}"/>'
  },
  {
    id: 'pencil', name: 'Lápis', category: 'education',
    keywords: ['lapis', 'lápis', 'pencil', 'escrever', 'editar'], usesStroke: true,
    body: '<path d="M100 394L126 288L360 54L458 152L224 386L100 394Z" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linejoin="round"/><path d="M126 288L224 386M334 80L432 178" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/>'
  },
  {
    id: 'lightbulb', name: 'Ideia', category: 'education',
    keywords: ['ideia', 'lampada', 'lâmpada', 'lightbulb', 'criatividade'], usesStroke: true,
    body: '<path d="M256 52C158 52 102 122 102 206C102 268 132 300 174 338C194 356 204 380 204 408H308C308 380 318 356 338 338C380 300 410 268 410 206C410 122 354 52 256 52Z" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linejoin="round"/><path d="M204 448H308M218 486H294" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round"/>'
  },
  {
    id: 'code', name: 'Código', category: 'technology',
    keywords: ['codigo', 'código', 'code', 'programacao', 'programação'], usesStroke: true,
    body: '<path d="M190 136L76 256L190 376M322 136L436 256L322 376M286 92L226 420" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round" stroke-linejoin="round"/>'
  },
  {
    id: 'monitor', name: 'Computador', category: 'technology',
    keywords: ['computador', 'monitor', 'ecra', 'ecrã', 'desktop'], usesStroke: true,
    body: '<rect x="58" y="72" width="396" height="284" rx="28" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><path d="M256 356V424M164 438H348" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round"/>'
  },
  {
    id: 'wifi', name: 'Wi-Fi', category: 'technology',
    keywords: ['wifi', 'internet', 'rede', 'wireless'], usesStroke: true,
    body: '<path d="M70 202C176 104 336 104 442 202M130 274C202 208 310 208 382 274M194 344C230 312 282 312 318 344" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round"/><circle cx="256" cy="408" r="26" fill="{{color}}"/>'
  },
  {
    id: 'database', name: 'Base de dados', category: 'technology',
    keywords: ['base dados', 'database', 'servidor', 'dados'], usesStroke: true,
    body: '<ellipse cx="256" cy="108" rx="162" ry="62" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><path d="M94 108V404C94 438 166 466 256 466C346 466 418 438 418 404V108M94 252C94 286 166 314 256 314C346 314 418 286 418 252" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/>'
  },
  {
    id: 'home', name: 'Início', category: 'interface',
    keywords: ['inicio', 'início', 'home', 'casa'], usesStroke: true,
    body: '<path d="M62 250L256 72L450 250V446H316V326H196V446H62Z" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round" stroke-linejoin="round"/>'
  },
  {
    id: 'search', name: 'Pesquisa', category: 'interface',
    keywords: ['pesquisa', 'search', 'lupa', 'procurar'], usesStroke: true,
    body: '<circle cx="222" cy="218" r="142" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><path d="M326 322L448 444" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round"/>'
  },
  {
    id: 'location', name: 'Localização', category: 'interface',
    keywords: ['localizacao', 'localização', 'pin', 'mapa', 'location'], usesStroke: true,
    body: '<path d="M256 468C256 468 102 320 102 190C102 104 170 42 256 42C342 42 410 104 410 190C410 320 256 468 256 468Z" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linejoin="round"/><circle cx="256" cy="190" r="58" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/>'
  },
  {
    id: 'check', name: 'Visto', category: 'interface',
    keywords: ['visto', 'check', 'confirmar', 'ok'], usesStroke: true,
    body: '<path d="M74 270L196 390L440 118" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round" stroke-linejoin="round"/>'
  },
  {
    id: 'info', name: 'Informação', category: 'interface',
    keywords: ['informacao', 'informação', 'info', 'ajuda'], usesStroke: true,
    body: '<circle cx="256" cy="256" r="202" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><circle cx="256" cy="158" r="22" fill="{{color}}"/><path d="M256 232V366" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round"/>'
  },
  {
    id: 'user', name: 'Pessoa', category: 'interface',
    keywords: ['pessoa', 'user', 'utilizador', 'perfil'], usesStroke: true,
    body: '<circle cx="256" cy="166" r="92" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><path d="M84 448C98 340 166 292 256 292C346 292 414 340 428 448" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round"/>'
  }
]

function normalizeColor(value: string) {
  return /^#[0-9A-F]{6}$/i.test(value)
    ? value.toUpperCase()
    : MA_QUADRO_ELEMENT_DEFAULT_COLOR
}

function normalizeStrokeWidth(value: number) {
  return Math.min(
    MA_QUADRO_ELEMENT_MAX_STROKE,
    Math.max(
      MA_QUADRO_ELEMENT_MIN_STROKE,
      Number.isFinite(value)
        ? Math.round(value)
        : MA_QUADRO_ELEMENT_DEFAULT_STROKE
    )
  )
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function utf8ToBase64(value: string) {
  const bytes = new TextEncoder().encode(value)
  let binary = ''

  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary)
}

function base64ToUtf8(value: string) {
  const binary = atob(value)

  return new TextDecoder().decode(
    Uint8Array.from(
      binary,
      (character) =>
        character.charCodeAt(0)
    )
  )
}

function encodeMetadata(
  document: MAQuadroLibraryElementDocument
) {
  const base64 =
    utf8ToBase64(
      JSON.stringify(document)
    )

  let encoded = META_START

  for (const character of base64) {
    encoded += String.fromCodePoint(
      TAG_BASE +
      character.charCodeAt(0)
    )
  }

  return encoded + META_END
}

function decodeMetadata(value: string) {
  let base64 = ''

  for (const character of value) {
    const codePoint =
      character.codePointAt(0)

    if (codePoint === undefined) {
      continue
    }

    const ascii =
      codePoint -
      TAG_BASE

    if (
      ascii < 0 ||
      ascii > 127
    ) {
      throw new Error(
        'Metadados de elemento inválidos.'
      )
    }

    base64 +=
      String.fromCharCode(ascii)
  }

  return base64ToUtf8(base64)
}

export function getMAQuadroLibraryElement(
  elementId: string
) {
  return MA_QUADRO_LIBRARY_ELEMENTS.find(
    (element) =>
      element.id === elementId
  ) || null
}

export function normalizeMAQuadroLibraryElementDocument(
  document: MAQuadroLibraryElementDocument
): MAQuadroLibraryElementDocument | null {
  const definition =
    getMAQuadroLibraryElement(
      document.elementId
    )

  if (!definition) {
    return null
  }

  return {
    version: 1,
    elementId: definition.id,
    color:
      normalizeColor(
        document.color
      ),
    strokeWidth:
      normalizeStrokeWidth(
        document.strokeWidth
      )
  }
}

export function createMAQuadroLibraryElementDocument(
  elementId: string,
  color = MA_QUADRO_ELEMENT_DEFAULT_COLOR,
  strokeWidth = MA_QUADRO_ELEMENT_DEFAULT_STROKE
): MAQuadroLibraryElementDocument {
  return {
    version: 1,
    elementId,
    color:
      normalizeColor(color),
    strokeWidth:
      normalizeStrokeWidth(
        strokeWidth
      )
  }
}

export function updateMAQuadroLibraryElementDocument(
  document: MAQuadroLibraryElementDocument,
  values: Partial<MAQuadroLibraryElementDocument>
) {
  return normalizeMAQuadroLibraryElementDocument({
    ...document,
    ...values,
    version: 1
  })
}

export function createMAQuadroLibraryElementSvg(
  document: MAQuadroLibraryElementDocument
) {
  const normalized =
    normalizeMAQuadroLibraryElementDocument(
      document
    )

  if (!normalized) {
    throw new Error(
      'Elemento desconhecido.'
    )
  }

  const definition =
    getMAQuadroLibraryElement(
      normalized.elementId
    )

  if (!definition) {
    throw new Error(
      'Elemento desconhecido.'
    )
  }

  const body =
    definition.body
      .split(COLOR_TOKEN)
      .join(
        normalized.color
      )
      .split(STROKE_TOKEN)
      .join(
        String(
          normalized.strokeWidth
        )
      )

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_SIZE}" height="${SVG_SIZE}" viewBox="0 0 ${SVG_SIZE} ${SVG_SIZE}" role="img" aria-label="${escapeXml(
    definition.name
  )}">
  ${body}
</svg>`
}

export function createMAQuadroLibraryElementPreviewUrl(
  document: MAQuadroLibraryElementDocument
) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    createMAQuadroLibraryElementSvg(
      document
    )
  )}`
}

export function createMAQuadroLibraryElementObjectName(
  document: MAQuadroLibraryElementDocument
) {
  const normalized =
    normalizeMAQuadroLibraryElementDocument(
      document
    )

  if (!normalized) {
    throw new Error(
      'Elemento desconhecido.'
    )
  }

  const definition =
    getMAQuadroLibraryElement(
      normalized.elementId
    )

  return `Elemento · ${
    definition?.name ||
    'Biblioteca'
  }${encodeMetadata(
    normalized
  )}`
}

export function readMAQuadroLibraryElementDocumentFromName(
  name: string
): MAQuadroLibraryElementDocument | null {
  const start =
    name.indexOf(
      META_START
    )

  if (start < 0) {
    return null
  }

  const payloadStart =
    start +
    META_START.length

  const end =
    name.indexOf(
      META_END,
      payloadStart
    )

  if (end < 0) {
    return null
  }

  try {
    const parsed =
      JSON.parse(
        decodeMetadata(
          name.slice(
            payloadStart,
            end
          )
        )
      ) as Partial<MAQuadroLibraryElementDocument>

    if (
      parsed.version !== 1 ||
      typeof parsed.elementId !==
        'string'
    ) {
      return null
    }

    return normalizeMAQuadroLibraryElementDocument(
      parsed as
        MAQuadroLibraryElementDocument
    )
  } catch {
    return null
  }
}

export function createMAQuadroLibraryElementFile(
  document: MAQuadroLibraryElementDocument
) {
  const normalized =
    normalizeMAQuadroLibraryElementDocument(
      document
    )

  if (!normalized) {
    throw new Error(
      'Elemento desconhecido.'
    )
  }

  return new File(
    [
      createMAQuadroLibraryElementSvg(
        normalized
      )
    ],
    createMAQuadroLibraryElementObjectName(
      normalized
    ),
    {
      type:
        'image/svg+xml',
      lastModified:
        Date.now()
    }
  )
}
