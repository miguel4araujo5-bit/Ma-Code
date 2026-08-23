export type MAQuadroElementCategory =
  | 'shapes'
  | 'arrows'
  | 'communication'
  | 'social'
  | 'business'
  | 'commerce'
  | 'education'
  | 'technology'
  | 'interface'
  | 'decorative'
  | 'nature'
  | 'media'
  | 'people'

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
  { id: 'arrows', label: 'Setas' },
  { id: 'communication', label: 'Comunicação' },
  { id: 'social', label: 'Social' },
  { id: 'business', label: 'Negócio' },
  { id: 'commerce', label: 'Comércio' },
  { id: 'education', label: 'Educação' },
  { id: 'technology', label: 'Tecnologia' },
  { id: 'interface', label: 'Interface' },
  { id: 'decorative', label: 'Decoração' },
  { id: 'nature', label: 'Natureza' },
  { id: 'media', label: 'Multimédia' },
  { id: 'people', label: 'Pessoas' }
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
    id: 'diamond',
    name: 'Losango',
    category: 'shapes',
    keywords: ['losango', 'diamante', 'diamond'],
    usesStroke: false,
    body: '<polygon points="256,42 470,256 256,470 42,256" fill="{{color}}"/>'
  },
  {
    id: 'pentagon',
    name: 'Pentágono',
    category: 'shapes',
    keywords: ['pentagono', 'pentágono', '5 lados'],
    usesStroke: false,
    body: '<polygon points="256,35 472,192 389,446 123,446 40,192" fill="{{color}}"/>'
  },
  {
    id: 'hexagon',
    name: 'Hexágono',
    category: 'shapes',
    keywords: ['hexagono', 'hexágono', '6 lados'],
    usesStroke: false,
    body: '<polygon points="128,48 384,48 480,256 384,464 128,464 32,256" fill="{{color}}"/>'
  },
  {
    id: 'octagon',
    name: 'Octógono',
    category: 'shapes',
    keywords: ['octogono', 'octógono', '8 lados'],
    usesStroke: false,
    body: '<polygon points="160,38 352,38 474,160 474,352 352,474 160,474 38,352 38,160" fill="{{color}}"/>'
  },
  {
    id: 'heart',
    name: 'Coração',
    category: 'shapes',
    keywords: ['coracao', 'coração', 'amor', 'heart'],
    usesStroke: false,
    body: '<path d="M232 456C201 424 48 316 48 176C48 94 106 50 169 50C208 50 236 72 256 104C277 72 305 50 344 50C407 50 464 94 464 176C464 316 311 424 280 456L256 479Z" fill="{{color}}"/>'
  },
  {
    id: 'cross',
    name: 'Cruz',
    category: 'shapes',
    keywords: ['cruz', 'mais', 'plus', 'cross'],
    usesStroke: false,
    body: '<path d="M196 52H316V196H460V316H316V460H196V316H52V196H196Z" fill="{{color}}"/>'
  },
  {
    id: 'chevron',
    name: 'Chevron',
    category: 'shapes',
    keywords: ['chevron', 'seta', 'direita', 'angulo'],
    usesStroke: false,
    body: '<path d="M82 62H238L430 256L238 450H82L274 256Z" fill="{{color}}"/>'
  },
  {
    id: 'speech-bubble',
    name: 'Balão de fala',
    category: 'shapes',
    keywords: ['balao', 'balão', 'fala', 'chat', 'mensagem'],
    usesStroke: false,
    body: '<path d="M104 64H408C430 64 448 82 448 104V310C448 332 430 350 408 350H256L142 448V350H104C82 350 64 332 64 310V104C64 82 82 64 104 64Z" fill="{{color}}"/>'
  },
  {
    id: 'bolt',
    name: 'Raio',
    category: 'shapes',
    keywords: ['raio', 'energia', 'bolt', 'flash'],
    usesStroke: false,
    body: '<path d="M286 28L92 286H222L188 484L420 204H286Z" fill="{{color}}"/>'
  },
  {
    id: 'badge',
    name: 'Selo',
    category: 'shapes',
    keywords: ['selo', 'badge', 'estrela', 'destaque'],
    usesStroke: false,
    body: '<path d="M256 30L303 82L371 62L391 130L459 150L439 218L491 265L439 312L459 380L391 400L371 468L303 448L256 500L209 448L141 468L121 400L53 380L73 312L21 265L73 218L53 150L121 130L141 62L209 82Z" fill="{{color}}"/>'
  },
  {
    id: 'parallelogram',
    name: 'Paralelogramo',
    category: 'shapes',
    keywords: ['paralelogramo', 'inclinado', 'forma'],
    usesStroke: false,
    body: '<polygon points="142,74 474,74 370,438 38,438" fill="{{color}}"/>'
  },
  {
    id: 'pill',
    name: 'Cápsula',
    category: 'shapes',
    keywords: ['capsula', 'cápsula', 'pill', 'botao', 'botão'],
    usesStroke: false,
    body: '<rect x="38" y="154" width="436" height="204" rx="102" fill="{{color}}"/>'
  },
  {
    id: 'mail',
    name: 'Email',
    category: 'communication',
    keywords: ['email', 'mail', 'correio', 'envelope'],
    usesStroke: true,
    body: '<rect x="58" y="112" width="396" height="288" rx="34" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><path d="M76 138L256 278L436 138" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round" stroke-linejoin="round"/>'
  },
  {
    id: 'phone',
    name: 'Telefone',
    category: 'communication',
    keywords: ['telefone', 'phone', 'chamada', 'call'],
    usesStroke: true,
    body: '<path d="M150 70L214 164L174 212C202 272 240 310 300 338L348 298L442 362C410 424 366 454 310 444C200 425 87 312 68 202C58 146 88 102 150 70Z" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round" stroke-linejoin="round"/>'
  },
  {
    id: 'chat',
    name: 'Mensagem',
    category: 'communication',
    keywords: ['mensagem', 'chat', 'conversa', 'fala'],
    usesStroke: true,
    body: '<path d="M70 82H442V350H250L142 440V350H70Z" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linejoin="round"/><circle cx="174" cy="216" r="14" fill="{{color}}"/><circle cx="256" cy="216" r="14" fill="{{color}}"/><circle cx="338" cy="216" r="14" fill="{{color}}"/>'
  },
  {
    id: 'send',
    name: 'Enviar',
    category: 'communication',
    keywords: ['enviar', 'send', 'aviao', 'avião', 'mensagem'],
    usesStroke: true,
    body: '<path d="M54 244L458 62L340 450L244 286L54 244Z" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linejoin="round"/><path d="M244 286L458 62" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round"/>'
  },
  {
    id: 'briefcase',
    name: 'Pasta',
    category: 'business',
    keywords: ['pasta', 'briefcase', 'trabalho', 'negocio', 'negócio'],
    usesStroke: true,
    body: '<rect x="54" y="142" width="404" height="286" rx="30" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><path d="M176 142V96C176 72 194 54 218 54H294C318 54 336 72 336 96V142M54 238H458M220 238V280H292V238" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round" stroke-linejoin="round"/>'
  },
  {
    id: 'calendar',
    name: 'Calendário',
    category: 'business',
    keywords: ['calendario', 'calendário', 'data', 'agenda'],
    usesStroke: true,
    body: '<rect x="62" y="92" width="388" height="352" rx="30" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><path d="M62 184H450M156 54V126M356 54V126" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round"/><circle cx="166" cy="270" r="18" fill="{{color}}"/><circle cx="256" cy="270" r="18" fill="{{color}}"/><circle cx="346" cy="270" r="18" fill="{{color}}"/><circle cx="166" cy="354" r="18" fill="{{color}}"/><circle cx="256" cy="354" r="18" fill="{{color}}"/>'
  },
  {
    id: 'bar-chart',
    name: 'Estatísticas',
    category: 'business',
    keywords: ['grafico', 'gráfico', 'estatisticas', 'estatísticas', 'barras'],
    usesStroke: true,
    body: '<path d="M76 430V82M76 430H452" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round"/><rect x="126" y="292" width="66" height="138" rx="10" fill="{{color}}"/><rect x="228" y="210" width="66" height="220" rx="10" fill="{{color}}"/><rect x="330" y="122" width="66" height="308" rx="10" fill="{{color}}"/>'
  },
  {
    id: 'target',
    name: 'Objetivo',
    category: 'business',
    keywords: ['objetivo', 'target', 'meta', 'alvo'],
    usesStroke: true,
    body: '<circle cx="242" cy="270" r="172" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><circle cx="242" cy="270" r="102" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><circle cx="242" cy="270" r="34" fill="{{color}}"/><path d="M264 248L438 74M368 74H438V144" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round" stroke-linejoin="round"/>'
  },
  {
    id: 'book',
    name: 'Livro',
    category: 'education',
    keywords: ['livro', 'book', 'educacao', 'educação', 'estudo'],
    usesStroke: true,
    body: '<path d="M70 92H210C244 92 256 112 256 144V432C246 406 224 392 190 392H70ZM442 92H302C268 92 256 112 256 144V432C266 406 288 392 322 392H442Z" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linejoin="round"/>'
  },
  {
    id: 'graduation-cap',
    name: 'Graduação',
    category: 'education',
    keywords: ['graduacao', 'graduação', 'escola', 'universidade', 'cap'],
    usesStroke: true,
    body: '<path d="M42 190L256 88L470 190L256 292Z" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linejoin="round"/><path d="M134 246V344C174 392 338 392 378 344V246M470 190V350" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round" stroke-linejoin="round"/><circle cx="470" cy="378" r="20" fill="{{color}}"/>'
  },
  {
    id: 'pencil',
    name: 'Lápis',
    category: 'education',
    keywords: ['lapis', 'lápis', 'pencil', 'escrever', 'editar'],
    usesStroke: true,
    body: '<path d="M100 394L126 288L360 54L458 152L224 386L100 394Z" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linejoin="round"/><path d="M126 288L224 386M334 80L432 178" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/>'
  },
  {
    id: 'lightbulb',
    name: 'Ideia',
    category: 'education',
    keywords: ['ideia', 'lampada', 'lâmpada', 'lightbulb', 'criatividade'],
    usesStroke: true,
    body: '<path d="M256 52C158 52 102 122 102 206C102 268 132 300 174 338C194 356 204 380 204 408H308C308 380 318 356 338 338C380 300 410 268 410 206C410 122 354 52 256 52Z" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linejoin="round"/><path d="M204 448H308M218 486H294" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round"/>'
  },
  {
    id: 'code',
    name: 'Código',
    category: 'technology',
    keywords: ['codigo', 'código', 'code', 'programacao', 'programação'],
    usesStroke: true,
    body: '<path d="M190 136L76 256L190 376M322 136L436 256L322 376M286 92L226 420" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round" stroke-linejoin="round"/>'
  },
  {
    id: 'monitor',
    name: 'Computador',
    category: 'technology',
    keywords: ['computador', 'monitor', 'ecra', 'ecrã', 'desktop'],
    usesStroke: true,
    body: '<rect x="58" y="72" width="396" height="284" rx="28" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><path d="M256 356V424M164 438H348" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round"/>'
  },
  {
    id: 'wifi',
    name: 'Wi-Fi',
    category: 'technology',
    keywords: ['wifi', 'internet', 'rede', 'wireless'],
    usesStroke: true,
    body: '<path d="M70 202C176 104 336 104 442 202M130 274C202 208 310 208 382 274M194 344C230 312 282 312 318 344" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round"/><circle cx="256" cy="408" r="26" fill="{{color}}"/>'
  },
  {
    id: 'database',
    name: 'Base de dados',
    category: 'technology',
    keywords: ['base dados', 'database', 'servidor', 'dados'],
    usesStroke: true,
    body: '<ellipse cx="256" cy="108" rx="162" ry="62" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><path d="M94 108V404C94 438 166 466 256 466C346 466 418 438 418 404V108M94 252C94 286 166 314 256 314C346 314 418 286 418 252" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/>'
  },
  {
    id: 'home',
    name: 'Início',
    category: 'interface',
    keywords: ['inicio', 'início', 'home', 'casa'],
    usesStroke: true,
    body: '<path d="M62 250L256 72L450 250V446H316V326H196V446H62Z" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round" stroke-linejoin="round"/>'
  },
  {
    id: 'search',
    name: 'Pesquisa',
    category: 'interface',
    keywords: ['pesquisa', 'search', 'lupa', 'procurar'],
    usesStroke: true,
    body: '<circle cx="222" cy="218" r="142" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><path d="M326 322L448 444" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round"/>'
  },
  {
    id: 'location',
    name: 'Localização',
    category: 'interface',
    keywords: ['localizacao', 'localização', 'pin', 'mapa', 'location'],
    usesStroke: true,
    body: '<path d="M256 468C256 468 102 320 102 190C102 104 170 42 256 42C342 42 410 104 410 190C410 320 256 468 256 468Z" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linejoin="round"/><circle cx="256" cy="190" r="58" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/>'
  },
  {
    id: 'check',
    name: 'Visto',
    category: 'interface',
    keywords: ['visto', 'check', 'confirmar', 'ok'],
    usesStroke: true,
    body: '<path d="M74 270L196 390L440 118" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round" stroke-linejoin="round"/>'
  },
  {
    id: 'info',
    name: 'Informação',
    category: 'interface',
    keywords: ['informacao', 'informação', 'info', 'ajuda'],
    usesStroke: true,
    body: '<circle cx="256" cy="256" r="202" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><circle cx="256" cy="158" r="22" fill="{{color}}"/><path d="M256 232V366" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round"/>'
  },
  {
    id: 'user',
    name: 'Pessoa',
    category: 'interface',
    keywords: ['pessoa', 'user', 'utilizador', 'perfil'],
    usesStroke: true,
    body: '<circle cx="256" cy="166" r="92" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><path d="M84 448C98 340 166 292 256 292C346 292 414 340 428 448" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round"/>'
  },
  {
    id: 'sparkles',
    name: 'Brilhos',
    category: 'decorative',
    keywords: ['brilhos', 'sparkles', 'estrela', 'magia', 'decoracao', 'decoração'],
    usesStroke: false,
    body: '<path d="M174 54L196 122L264 144L196 166L174 234L152 166L84 144L152 122Z" fill="{{color}}"/><path d="M350 196L374 270L448 294L374 318L350 392L326 318L252 294L326 270Z" fill="{{color}}"/><circle cx="120" cy="354" r="28" fill="{{color}}"/>'
  },
  {
    id: 'flower',
    name: 'Flor',
    category: 'decorative',
    keywords: ['flor', 'flower', 'natureza', 'primavera', 'decoracao', 'decoração'],
    usesStroke: true,
    body: '<circle cx="256" cy="256" r="48" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><ellipse cx="256" cy="128" rx="62" ry="88" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><ellipse cx="256" cy="384" rx="62" ry="88" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><ellipse cx="128" cy="256" rx="88" ry="62" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><ellipse cx="384" cy="256" rx="88" ry="62" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/>'
  },
  {
    id: 'sun',
    name: 'Sol',
    category: 'decorative',
    keywords: ['sol', 'sun', 'verao', 'verão', 'tempo', 'natureza'],
    usesStroke: true,
    body: '<circle cx="256" cy="256" r="92" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><path d="M256 48V104M256 408V464M48 256H104M408 256H464M109 109L149 149M363 363L403 403M403 109L363 149M149 363L109 403" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round"/>'
  },
  {
    id: 'moon',
    name: 'Lua',
    category: 'decorative',
    keywords: ['lua', 'moon', 'noite', 'ceu', 'céu'],
    usesStroke: false,
    body: '<path d="M350 64C246 78 166 168 166 276C166 354 210 424 278 458C150 466 48 368 48 244C48 120 152 24 276 34C302 36 326 46 350 64Z" fill="{{color}}"/>'
  },
  {
    id: 'cloud',
    name: 'Nuvem',
    category: 'decorative',
    keywords: ['nuvem', 'cloud', 'ceu', 'céu', 'tempo'],
    usesStroke: true,
    body: '<path d="M124 390H394C442 390 472 354 472 312C472 268 438 232 394 232C386 232 378 234 370 236C350 166 292 122 224 122C146 122 82 184 78 262C40 274 18 306 18 342C18 370 40 390 68 390Z" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linejoin="round"/>'
  },
  {
    id: 'leaf',
    name: 'Folha',
    category: 'decorative',
    keywords: ['folha', 'leaf', 'natureza', 'eco', 'verde'],
    usesStroke: true,
    body: '<path d="M80 420C78 212 188 82 432 58C430 294 322 430 80 420Z" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linejoin="round"/><path d="M104 392C190 302 274 224 406 92" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round"/>'
  },
  {
    id: 'confetti',
    name: 'Confetes',
    category: 'decorative',
    keywords: ['confetes', 'confetti', 'festa', 'celebracao', 'celebração'],
    usesStroke: true,
    body: '<path d="M120 76L150 140M278 62L266 138M398 112L350 166M86 264L154 276M410 258L344 282M138 392L188 346M330 420L312 354" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round"/><circle cx="230" cy="248" r="34" fill="{{color}}"/><rect x="362" y="340" width="58" height="58" rx="10" fill="{{color}}"/>'
  },
  {
    id: 'music-note',
    name: 'Música',
    category: 'media',
    keywords: ['musica', 'música', 'music', 'som', 'nota'],
    usesStroke: true,
    body: '<path d="M198 100V360M198 126L406 82V316" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round" stroke-linejoin="round"/><ellipse cx="142" cy="382" rx="64" ry="46" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><ellipse cx="350" cy="338" rx="64" ry="46" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/>'
  },
  {
    id: 'play',
    name: 'Reproduzir',
    category: 'media',
    keywords: ['play', 'reproduzir', 'video', 'vídeo', 'media'],
    usesStroke: false,
    body: '<circle cx="256" cy="256" r="214" fill="{{color}}"/><path d="M212 154L370 256L212 358Z" fill="#ffffff"/>'
  },
  {
    id: 'camera',
    name: 'Câmara',
    category: 'media',
    keywords: ['camera', 'câmara', 'foto', 'fotografia', 'imagem'],
    usesStroke: true,
    body: '<rect x="54" y="142" width="404" height="278" rx="34" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><path d="M160 142L198 90H314L352 142" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linejoin="round"/><circle cx="256" cy="280" r="86" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/>'
  },
  {
    id: 'image',
    name: 'Imagem',
    category: 'media',
    keywords: ['imagem', 'image', 'foto', 'paisagem', 'galeria'],
    usesStroke: true,
    body: '<rect x="58" y="70" width="396" height="372" rx="28" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><circle cx="176" cy="170" r="42" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><path d="M82 394L184 286L258 350L330 264L430 394" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round" stroke-linejoin="round"/>'
  },
  {
    id: 'microphone',
    name: 'Microfone',
    category: 'media',
    keywords: ['microfone', 'microphone', 'audio', 'áudio', 'voz', 'podcast'],
    usesStroke: true,
    body: '<rect x="188" y="56" width="136" height="278" rx="68" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><path d="M126 250V270C126 342 184 400 256 400C328 400 386 342 386 270V250M256 400V462M188 462H324" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round"/>'
  },
  {
    id: 'volume',
    name: 'Som',
    category: 'media',
    keywords: ['som', 'volume', 'audio', 'áudio', 'speaker'],
    usesStroke: true,
    body: '<path d="M72 216H166L268 130V382L166 296H72Z" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linejoin="round"/><path d="M326 200C354 228 354 284 326 312M374 150C434 210 434 302 374 362" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round"/>'
  },
  {
    id: 'users',
    name: 'Grupo',
    category: 'people',
    keywords: ['grupo', 'pessoas', 'users', 'equipa', 'equipe', 'team'],
    usesStroke: true,
    body: '<circle cx="210" cy="160" r="76" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><circle cx="364" cy="188" r="58" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><path d="M56 432C68 330 128 280 210 280C292 280 352 330 364 432M330 304C394 306 438 344 454 412" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round"/>'
  },
  {
    id: 'teacher',
    name: 'Professor',
    category: 'people',
    keywords: ['professor', 'professora', 'teacher', 'educacao', 'educação', 'aula'],
    usesStroke: true,
    body: '<circle cx="168" cy="148" r="66" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><path d="M60 420C70 328 112 286 168 286C224 286 266 328 276 420M302 106H458V316H302M332 164H428M332 218H404" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round" stroke-linejoin="round"/>'
  },
  {
    id: 'child',
    name: 'Aluno',
    category: 'people',
    keywords: ['aluno', 'aluna', 'crianca', 'criança', 'student', 'escola'],
    usesStroke: true,
    body: '<circle cx="256" cy="162" r="82" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><path d="M92 442C108 338 164 292 256 292C348 292 404 338 420 442" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round"/><path d="M184 104C208 64 304 58 336 112" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round"/>'
  },
  {
    id: 'trophy',
    name: 'Troféu',
    category: 'decorative',
    keywords: ['trofeu', 'troféu', 'premio', 'prémio', 'winner', 'vencedor'],
    usesStroke: true,
    body: '<path d="M166 70H346V188C346 266 310 318 256 318C202 318 166 266 166 188ZM256 318V392M184 442H328M214 392H298" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round" stroke-linejoin="round"/><path d="M166 112H86V166C86 226 124 264 178 272M346 112H426V166C426 226 388 264 334 272" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linejoin="round"/>'
  },
  {
    id: 'gift',
    name: 'Presente',
    category: 'decorative',
    keywords: ['presente', 'gift', 'oferta', 'aniversario', 'aniversário'],
    usesStroke: true,
    body: '<rect x="72" y="190" width="368" height="254" rx="20" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><path d="M256 190V444M72 268H440M256 190C206 190 146 174 146 124C146 84 188 68 218 92C240 110 252 144 256 190ZM256 190C306 190 366 174 366 124C366 84 324 68 294 92C272 110 260 144 256 190Z" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linejoin="round"/>'
  },
  {
    id: 'flag',
    name: 'Bandeira',
    category: 'decorative',
    keywords: ['bandeira', 'flag', 'marcador', 'objetivo'],
    usesStroke: true,
    body: '<path d="M112 458V62M126 84H404L344 176L404 268H126" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round" stroke-linejoin="round"/>'
  },
  {
    id: 'rocket',
    name: 'Foguetão',
    category: 'technology',
    keywords: ['foguetao', 'foguetão', 'rocket', 'lancamento', 'lançamento', 'startup'],
    usesStroke: true,
    body: '<path d="M222 310C160 292 126 250 112 204C194 102 300 48 418 54C424 172 370 278 268 360C250 346 234 330 222 310Z" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linejoin="round"/><circle cx="314" cy="158" r="42" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><path d="M178 328L94 412L100 340L172 268M246 386L188 454L180 368" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linejoin="round"/>'
  },
  {
    id: 'globe',
    name: 'Mundo',
    category: 'education',
    keywords: ['mundo', 'globe', 'planeta', 'geografia', 'global'],
    usesStroke: true,
    body: '<circle cx="256" cy="256" r="202" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><path d="M54 256H458M256 54C316 108 344 174 344 256C344 338 316 404 256 458C196 404 168 338 168 256C168 174 196 108 256 54ZM88 148H424M88 364H424" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/>'
  },
  {
    id: 'clock',
    name: 'Relógio',
    category: 'interface',
    keywords: ['relogio', 'relógio', 'clock', 'tempo', 'hora'],
    usesStroke: true,
    body: '<circle cx="256" cy="256" r="202" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><path d="M256 126V264L350 326" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round" stroke-linejoin="round"/>'
  },
  {
    id: 'lock',
    name: 'Cadeado',
    category: 'interface',
    keywords: ['cadeado', 'lock', 'seguranca', 'segurança', 'privado'],
    usesStroke: true,
    body: '<rect x="98" y="222" width="316" height="232" rx="28" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><path d="M166 222V158C166 108 204 68 256 68C308 68 346 108 346 158V222" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round"/><circle cx="256" cy="330" r="24" fill="{{color}}"/>'
  },
  {
    id: 'eye',
    name: 'Visualizar',
    category: 'interface',
    keywords: ['olho', 'eye', 'visualizar', 'ver', 'preview'],
    usesStroke: true,
    body: '<path d="M48 256C104 154 176 106 256 106C336 106 408 154 464 256C408 358 336 406 256 406C176 406 104 358 48 256Z" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linejoin="round"/><circle cx="256" cy="256" r="70" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/>'
  },
  {
    id: 'arrow-right',
    name: 'Seta direita',
    category: 'arrows',
    keywords: ['seta', 'direita', 'arrow', 'right', 'seguinte'],
    usesStroke: true,
    body: '<path d="M66 256H430M312 132L438 256L312 380" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round" stroke-linejoin="round"/>'
  },
  {
    id: 'arrow-left',
    name: 'Seta esquerda',
    category: 'arrows',
    keywords: ['seta', 'esquerda', 'arrow', 'left', 'voltar'],
    usesStroke: true,
    body: '<path d="M446 256H82M200 132L74 256L200 380" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round" stroke-linejoin="round"/>'
  },
  {
    id: 'arrow-up',
    name: 'Seta cima',
    category: 'arrows',
    keywords: ['seta', 'cima', 'arrow', 'up', 'subir'],
    usesStroke: true,
    body: '<path d="M256 446V82M132 200L256 74L380 200" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round" stroke-linejoin="round"/>'
  },
  {
    id: 'arrow-down',
    name: 'Seta baixo',
    category: 'arrows',
    keywords: ['seta', 'baixo', 'arrow', 'down', 'descer'],
    usesStroke: true,
    body: '<path d="M256 66V430M132 312L256 438L380 312" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round" stroke-linejoin="round"/>'
  },
  {
    id: 'arrow-up-right',
    name: 'Seta diagonal',
    category: 'arrows',
    keywords: ['seta', 'diagonal', 'nordeste', 'arrow', 'externo'],
    usesStroke: true,
    body: '<path d="M92 420L420 92M246 92H420V266" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round" stroke-linejoin="round"/>'
  },
  {
    id: 'arrow-curved-right',
    name: 'Seta curva',
    category: 'arrows',
    keywords: ['seta', 'curva', 'curved', 'retorno', 'direita'],
    usesStroke: true,
    body: '<path d="M86 366C96 190 230 116 390 166M316 94L402 166L322 250" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round" stroke-linejoin="round"/>'
  },
  {
    id: 'refresh',
    name: 'Atualizar',
    category: 'arrows',
    keywords: ['atualizar', 'refresh', 'recarregar', 'ciclo', 'seta'],
    usesStroke: true,
    body: '<path d="M402 186C374 112 304 70 226 80C138 90 78 164 82 252C86 346 164 420 258 418C330 416 394 370 420 304M402 186V84M402 186H300" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round" stroke-linejoin="round"/>'
  },
  {
    id: 'swap-horizontal',
    name: 'Trocar',
    category: 'arrows',
    keywords: ['trocar', 'swap', 'horizontal', 'setas', 'intercambiar'],
    usesStroke: true,
    body: '<path d="M78 170H408M330 92L416 170L330 248M434 342H104M182 264L96 342L182 420" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round" stroke-linejoin="round"/>'
  },
  {
    id: 'trend-up',
    name: 'Tendência positiva',
    category: 'arrows',
    keywords: ['tendencia', 'tendência', 'subida', 'growth', 'crescimento'],
    usesStroke: true,
    body: '<path d="M76 386L198 264L282 326L430 150M314 150H430V266" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round" stroke-linejoin="round"/>'
  },
  {
    id: 'trend-down',
    name: 'Tendência negativa',
    category: 'arrows',
    keywords: ['tendencia', 'tendência', 'descida', 'queda', 'down'],
    usesStroke: true,
    body: '<path d="M76 126L198 248L282 186L430 362M314 362H430V246" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round" stroke-linejoin="round"/>'
  },
  {
    id: 'euro',
    name: 'Euro',
    category: 'commerce',
    keywords: ['euro', 'dinheiro', 'preco', 'preço', 'moeda'],
    usesStroke: true,
    body: '<path d="M378 130C342 92 302 76 252 76C146 76 88 154 88 256C88 358 146 436 252 436C302 436 342 420 378 382M68 222H302M68 290H282" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round"/>'
  },
  {
    id: 'credit-card',
    name: 'Cartão',
    category: 'commerce',
    keywords: ['cartao', 'cartão', 'credito', 'crédito', 'pagamento', 'card'],
    usesStroke: true,
    body: '<rect x="54" y="112" width="404" height="288" rx="34" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><path d="M54 190H458M112 330H220" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round"/>'
  },
  {
    id: 'shopping-cart',
    name: 'Carrinho',
    category: 'commerce',
    keywords: ['carrinho', 'compras', 'shopping', 'cart', 'loja'],
    usesStroke: true,
    body: '<path d="M60 88H118L160 326H394L438 164H142" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round" stroke-linejoin="round"/><circle cx="194" cy="404" r="30" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><circle cx="366" cy="404" r="30" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/>'
  },
  {
    id: 'shopping-bag',
    name: 'Saco de compras',
    category: 'commerce',
    keywords: ['saco', 'compras', 'shopping', 'bag', 'loja'],
    usesStroke: true,
    body: '<path d="M112 164H400L426 446H86Z" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linejoin="round"/><path d="M184 190V142C184 96 214 66 256 66C298 66 328 96 328 142V190" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round"/>'
  },
  {
    id: 'price-tag',
    name: 'Etiqueta de preço',
    category: 'commerce',
    keywords: ['etiqueta', 'preco', 'preço', 'tag', 'venda', 'promoção'],
    usesStroke: true,
    body: '<path d="M62 238L250 54H438V242L250 430Z" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linejoin="round"/><circle cx="354" cy="140" r="30" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/>'
  },
  {
    id: 'receipt',
    name: 'Recibo',
    category: 'commerce',
    keywords: ['recibo', 'fatura', 'invoice', 'receipt', 'compra'],
    usesStroke: true,
    body: '<path d="M126 58H386V454L350 424L314 454L278 424L242 454L206 424L170 454L126 424Z" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linejoin="round"/><path d="M180 154H330M180 226H330M180 298H286" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round"/>'
  },
  {
    id: 'wallet',
    name: 'Carteira',
    category: 'commerce',
    keywords: ['carteira', 'wallet', 'dinheiro', 'pagamento'],
    usesStroke: true,
    body: '<rect x="62" y="118" width="388" height="288" rx="34" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><path d="M62 170L328 82C350 74 370 88 374 110L386 152M320 224H450V318H320C294 318 276 300 276 272C276 244 294 224 320 224Z" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linejoin="round"/><circle cx="330" cy="270" r="12" fill="{{color}}"/>'
  },
  {
    id: 'coins',
    name: 'Moedas',
    category: 'commerce',
    keywords: ['moedas', 'coins', 'dinheiro', 'economia', 'preço'],
    usesStroke: true,
    body: '<ellipse cx="208" cy="150" rx="126" ry="54" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><path d="M82 150V260C82 290 138 314 208 314C278 314 334 290 334 260V150M82 210C82 240 138 264 208 264C278 264 334 240 334 210" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><ellipse cx="334" cy="336" rx="96" ry="42" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><path d="M238 336V410C238 434 280 454 334 454C388 454 430 434 430 410V336" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/>'
  },
  {
    id: 'store',
    name: 'Loja',
    category: 'commerce',
    keywords: ['loja', 'store', 'shop', 'comercio', 'comércio'],
    usesStroke: true,
    body: '<path d="M84 196L118 78H394L428 196M100 196V438H412V196" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linejoin="round"/><path d="M84 196C84 232 110 252 142 252C174 252 198 232 198 196C198 232 222 252 256 252C290 252 314 232 314 196C314 232 338 252 370 252C402 252 428 232 428 196M186 438V330H326V438" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linejoin="round"/>'
  },
  {
    id: 'percent',
    name: 'Percentagem',
    category: 'commerce',
    keywords: ['percentagem', 'percent', 'desconto', 'promoção', 'sale'],
    usesStroke: true,
    body: '<circle cx="154" cy="160" r="58" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><circle cx="358" cy="352" r="58" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><path d="M402 94L110 418" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round"/>'
  },
  {
    id: 'thumbs-up',
    name: 'Gosto',
    category: 'social',
    keywords: ['gosto', 'like', 'thumbs up', 'social', 'positivo'],
    usesStroke: true,
    body: '<path d="M198 214L252 86C260 64 286 58 304 74C320 88 324 112 316 134L290 208H414C442 208 460 232 454 260L422 410C418 430 400 444 380 444H198ZM80 214H198V444H80Z" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linejoin="round"/>'
  },
  {
    id: 'share',
    name: 'Partilhar',
    category: 'social',
    keywords: ['partilhar', 'share', 'social', 'enviar', 'rede'],
    usesStroke: true,
    body: '<circle cx="386" cy="112" r="54" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><circle cx="126" cy="256" r="54" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><circle cx="386" cy="400" r="54" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><path d="M174 230L338 138M174 282L338 374" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round"/>'
  },
  {
    id: 'notification',
    name: 'Notificação',
    category: 'social',
    keywords: ['notificacao', 'notificação', 'sino', 'bell', 'alerta'],
    usesStroke: true,
    body: '<path d="M128 358H384L352 316V218C352 156 314 112 256 112C198 112 160 156 160 218V316Z" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linejoin="round"/><path d="M218 404C228 432 244 444 256 444C268 444 284 432 294 404M256 72V50" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round"/>'
  },
  {
    id: 'megaphone',
    name: 'Megafone',
    category: 'social',
    keywords: ['megafone', 'megaphone', 'anuncio', 'anúncio', 'marketing'],
    usesStroke: true,
    body: '<path d="M92 214H176L382 116V396L176 298H92Z" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linejoin="round"/><path d="M176 298L204 422H126L100 298M410 190L456 164M414 256H470M410 322L456 348" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round"/>'
  },
  {
    id: 'hashtag',
    name: 'Hashtag',
    category: 'social',
    keywords: ['hashtag', 'hash', 'social', 'numero', 'número'],
    usesStroke: true,
    body: '<path d="M174 72L130 440M346 72L302 440M72 188H430M58 324H416" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round"/>'
  },
  {
    id: 'at-sign',
    name: 'Arroba',
    category: 'social',
    keywords: ['arroba', 'email', 'at', 'social', 'contacto'],
    usesStroke: true,
    body: '<path d="M346 328V222C346 168 308 132 256 132C198 132 156 174 156 232C156 292 196 334 248 334C286 334 318 314 334 284M346 328C360 352 384 362 406 350C446 328 462 278 450 220C432 132 356 72 260 72C154 72 74 150 74 256C74 362 154 440 260 440C318 440 368 420 404 388" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round" stroke-linejoin="round"/>'
  },
  {
    id: 'link',
    name: 'Ligação',
    category: 'social',
    keywords: ['ligacao', 'ligação', 'link', 'url', 'corrente'],
    usesStroke: true,
    body: '<path d="M204 308L154 358C118 394 60 394 24 358C-12 322-12 264 24 228L112 140C148 104 206 104 242 140M308 204L358 154C394 118 452 118 488 154C524 190 524 248 488 284L400 372C364 408 306 408 270 372M164 348L348 164" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round" stroke-linejoin="round"/>'
  },
  {
    id: 'attachment',
    name: 'Anexo',
    category: 'social',
    keywords: ['anexo', 'attachment', 'clip', 'ficheiro', 'arquivo'],
    usesStroke: true,
    body: '<path d="M174 286L330 130C366 94 424 94 460 130C496 166 496 224 460 260L248 472C194 526 108 526 54 472C0 418 0 332 54 278L262 70" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round"/>'
  },
  {
    id: 'tree',
    name: 'Árvore',
    category: 'nature',
    keywords: ['arvore', 'árvore', 'tree', 'natureza', 'planta'],
    usesStroke: true,
    body: '<path d="M256 438V300M174 438H338M256 90C182 90 128 144 128 210C128 262 158 298 198 314C166 282 154 248 164 212C174 172 208 146 256 144C304 146 338 172 348 212C358 248 346 282 314 314C354 298 384 262 384 210C384 144 330 90 256 90Z" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round" stroke-linejoin="round"/>'
  },
  {
    id: 'mountain',
    name: 'Montanha',
    category: 'nature',
    keywords: ['montanha', 'mountain', 'paisagem', 'natureza', 'aventura'],
    usesStroke: true,
    body: '<path d="M48 414L184 188L258 300L328 208L464 414Z" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linejoin="round"/><path d="M150 246L184 188L218 240M302 242L328 208L356 246" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round"/>'
  },
  {
    id: 'wave',
    name: 'Onda',
    category: 'nature',
    keywords: ['onda', 'wave', 'mar', 'oceano', 'agua', 'água'],
    usesStroke: true,
    body: '<path d="M42 286C112 208 184 208 256 286C328 364 400 364 470 286M42 366C112 288 184 288 256 366C328 444 400 444 470 366" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round"/>'
  },
  {
    id: 'fire',
    name: 'Fogo',
    category: 'nature',
    keywords: ['fogo', 'fire', 'chama', 'calor', 'energia'],
    usesStroke: true,
    body: '<path d="M256 54C274 138 350 172 350 260C350 326 310 374 256 374C202 374 162 332 162 278C162 238 184 204 214 176C208 238 232 260 256 280C280 256 306 230 300 178C338 210 376 254 376 320C376 398 324 458 256 458C188 458 136 404 136 330C136 246 196 180 256 54Z" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linejoin="round"/>'
  },
  {
    id: 'snowflake',
    name: 'Floco de neve',
    category: 'nature',
    keywords: ['neve', 'snowflake', 'inverno', 'frio', 'floco'],
    usesStroke: true,
    body: '<path d="M256 54V458M82 154L430 358M82 358L430 154M256 54L214 104M256 54L298 104M256 458L214 408M256 458L298 408M82 154L150 160M82 154L110 216M430 358L362 352M430 358L402 296M82 358L150 352M82 358L110 296M430 154L362 160M430 154L402 216" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round"/>'
  },
  {
    id: 'rainbow',
    name: 'Arco-íris',
    category: 'nature',
    keywords: ['arco iris', 'arco-íris', 'rainbow', 'cores', 'natureza'],
    usesStroke: true,
    body: '<path d="M76 380C76 214 156 114 256 114C356 114 436 214 436 380M140 380C140 254 190 190 256 190C322 190 372 254 372 380M204 380C204 302 226 266 256 266C286 266 308 302 308 380" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round"/>'
  },
  {
    id: 'butterfly',
    name: 'Borboleta',
    category: 'nature',
    keywords: ['borboleta', 'butterfly', 'natureza', 'primavera'],
    usesStroke: true,
    body: '<path d="M246 246C194 116 76 90 66 184C58 260 140 286 226 272C150 300 96 370 138 424C182 482 238 380 246 302M266 246C318 116 436 90 446 184C454 260 372 286 286 272C362 300 416 370 374 424C330 482 274 380 266 302M256 216V344" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round" stroke-linejoin="round"/>'
  },
  {
    id: 'cactus',
    name: 'Cacto',
    category: 'nature',
    keywords: ['cacto', 'cactus', 'planta', 'deserto', 'natureza'],
    usesStroke: true,
    body: '<path d="M216 446V156C216 110 236 84 266 84C296 84 316 110 316 156V238H354V190C354 160 370 144 392 144C414 144 430 160 430 190V278C430 316 404 340 366 340H316V446M216 294H164C126 294 102 270 102 234V176C102 146 118 130 140 130C162 130 178 146 178 176V214H216M164 446H368" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round" stroke-linejoin="round"/>'
  },
  {
    id: 'water-drop',
    name: 'Gota',
    category: 'nature',
    keywords: ['gota', 'agua', 'água', 'drop', 'water', 'chuva'],
    usesStroke: true,
    body: '<path d="M256 54C256 54 116 228 116 326C116 406 178 458 256 458C334 458 396 406 396 326C396 228 256 54 256 54Z" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linejoin="round"/><path d="M196 340C204 376 226 396 256 402" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round"/>'
  },
  {
    id: 'seedling',
    name: 'Rebento',
    category: 'nature',
    keywords: ['rebento', 'seedling', 'planta', 'eco', 'crescimento'],
    usesStroke: true,
    body: '<path d="M256 438V254M256 286C206 286 158 244 154 178C220 178 256 220 256 286ZM256 254C306 254 354 212 358 146C292 146 256 188 256 254ZM180 438H332" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round" stroke-linejoin="round"/>'
  },
  {
    id: 'planet',
    name: 'Planeta',
    category: 'nature',
    keywords: ['planeta', 'planet', 'espaco', 'espaço', 'saturno'],
    usesStroke: true,
    body: '<circle cx="256" cy="256" r="118" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><path d="M68 326C122 362 252 350 356 294C454 242 500 178 470 150C440 122 350 140 250 192C146 246 78 302 68 326Z" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linejoin="round"/>'
  },
  {
    id: 'smartphone',
    name: 'Telemóvel',
    category: 'technology',
    keywords: ['telemovel', 'telemóvel', 'smartphone', 'phone', 'mobile'],
    usesStroke: true,
    body: '<rect x="154" y="48" width="204" height="416" rx="34" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><path d="M214 104H298M230 414H282" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round"/>'
  },
  {
    id: 'laptop',
    name: 'Portátil',
    category: 'technology',
    keywords: ['portatil', 'portátil', 'laptop', 'computador', 'notebook'],
    usesStroke: true,
    body: '<rect x="112" y="84" width="288" height="246" rx="20" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><path d="M58 390H454L408 330H104Z" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linejoin="round"/>'
  },
  {
    id: 'cloud-upload',
    name: 'Cloud upload',
    category: 'technology',
    keywords: ['cloud', 'upload', 'nuvem', 'carregar', 'ficheiro'],
    usesStroke: true,
    body: '<path d="M130 380H392C438 380 466 346 466 306C466 264 434 232 394 232C382 166 328 126 266 126C190 126 128 184 124 258C80 266 48 300 48 342C48 364 66 380 88 380Z" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linejoin="round"/><path d="M256 332V208M198 266L256 208L314 266" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round" stroke-linejoin="round"/>'
  },
  {
    id: 'shield',
    name: 'Escudo',
    category: 'technology',
    keywords: ['escudo', 'shield', 'seguranca', 'segurança', 'protecao', 'proteção'],
    usesStroke: true,
    body: '<path d="M256 54L408 112V236C408 338 348 414 256 462C164 414 104 338 104 236V112Z" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linejoin="round"/><path d="M178 258L230 310L344 190" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round" stroke-linejoin="round"/>'
  },
  {
    id: 'key',
    name: 'Chave',
    category: 'technology',
    keywords: ['chave', 'key', 'acesso', 'seguranca', 'segurança'],
    usesStroke: true,
    body: '<circle cx="174" cy="238" r="100" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><path d="M250 306L448 108M372 184L426 238M326 230L380 284" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round"/>'
  },
  {
    id: 'cpu',
    name: 'Processador',
    category: 'technology',
    keywords: ['processador', 'cpu', 'chip', 'tecnologia', 'hardware'],
    usesStroke: true,
    body: '<rect x="130" y="130" width="252" height="252" rx="30" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><rect x="196" y="196" width="120" height="120" rx="16" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><path d="M178 68V130M256 68V130M334 68V130M178 382V444M256 382V444M334 382V444M68 178H130M68 256H130M68 334H130M382 178H444M382 256H444M382 334H444" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round"/>'
  },
  {
    id: 'robot',
    name: 'Robô',
    category: 'technology',
    keywords: ['robo', 'robô', 'robot', 'ai', 'ia', 'inteligencia'],
    usesStroke: true,
    body: '<rect x="98" y="152" width="316" height="242" rx="54" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><path d="M256 152V104M220 78H292M154 254H174M338 254H358M182 330H330M98 232H58V316H98M414 232H454V316H414" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round"/><circle cx="164" cy="254" r="18" fill="{{color}}"/><circle cx="348" cy="254" r="18" fill="{{color}}"/>'
  },
  {
    id: 'settings',
    name: 'Definições',
    category: 'technology',
    keywords: ['definicoes', 'definições', 'settings', 'engrenagem', 'configuracao'],
    usesStroke: true,
    body: '<circle cx="256" cy="256" r="78" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><path d="M256 62V112M256 400V450M62 256H112M400 256H450M118 118L154 154M358 358L394 394M394 118L358 154M154 358L118 394" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round"/><circle cx="256" cy="256" r="154" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-dasharray="44 30"/>'
  },
  {
    id: 'plus-circle',
    name: 'Adicionar',
    category: 'interface',
    keywords: ['adicionar', 'plus', 'mais', 'novo', 'circle'],
    usesStroke: true,
    body: '<circle cx="256" cy="256" r="202" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><path d="M256 150V362M150 256H362" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round"/>'
  },
  {
    id: 'minus-circle',
    name: 'Remover',
    category: 'interface',
    keywords: ['remover', 'minus', 'menos', 'circle'],
    usesStroke: true,
    body: '<circle cx="256" cy="256" r="202" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><path d="M150 256H362" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round"/>'
  },
  {
    id: 'close-circle',
    name: 'Fechar',
    category: 'interface',
    keywords: ['fechar', 'close', 'x', 'cancelar', 'circle'],
    usesStroke: true,
    body: '<circle cx="256" cy="256" r="202" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><path d="M176 176L336 336M336 176L176 336" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round"/>'
  },
  {
    id: 'menu',
    name: 'Menu',
    category: 'interface',
    keywords: ['menu', 'hamburger', 'navegacao', 'navegação', 'linhas'],
    usesStroke: true,
    body: '<path d="M82 140H430M82 256H430M82 372H430" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round"/>'
  },
  {
    id: 'trash',
    name: 'Eliminar',
    category: 'interface',
    keywords: ['eliminar', 'trash', 'lixo', 'apagar', 'delete'],
    usesStroke: true,
    body: '<path d="M144 148H368L346 446H166ZM104 148H408M202 148V92H310V148M222 218V374M290 218V374" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round" stroke-linejoin="round"/>'
  },
  {
    id: 'download',
    name: 'Descarregar',
    category: 'interface',
    keywords: ['descarregar', 'download', 'guardar', 'ficheiro'],
    usesStroke: true,
    body: '<path d="M256 62V326M160 236L256 332L352 236M92 350V444H420V350" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round" stroke-linejoin="round"/>'
  },
  {
    id: 'crown',
    name: 'Coroa',
    category: 'decorative',
    keywords: ['coroa', 'crown', 'premium', 'rei', 'rainha'],
    usesStroke: true,
    body: '<path d="M76 160L164 244L256 104L348 244L436 160L398 394H114Z" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linejoin="round"/><path d="M126 338H386" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round"/>'
  },
  {
    id: 'balloon',
    name: 'Balão',
    category: 'decorative',
    keywords: ['balao', 'balão', 'balloon', 'festa', 'aniversario'],
    usesStroke: true,
    body: '<ellipse cx="256" cy="194" rx="132" ry="148" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><path d="M238 342L256 376L274 342M256 376C230 404 292 430 248 466" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round" stroke-linejoin="round"/>'
  },
  {
    id: 'quote',
    name: 'Aspas',
    category: 'decorative',
    keywords: ['aspas', 'quote', 'citacao', 'citação', 'texto'],
    usesStroke: false,
    body: '<path d="M70 132H232V278H142C142 350 176 392 226 420C132 408 70 344 70 242ZM280 132H442V278H352C352 350 386 392 436 420C342 408 280 344 280 242Z" fill="{{color}}"/>'
  },
  {
    id: 'star-outline',
    name: 'Estrela',
    category: 'decorative',
    keywords: ['estrela', 'star', 'favorito', 'destaque', 'outline'],
    usesStroke: true,
    body: '<path d="M256 48L316 174L454 194L354 292L378 430L256 364L134 430L158 292L58 194L196 174Z" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linejoin="round"/>'
  },
  {
    id: 'handshake',
    name: 'Acordo',
    category: 'business',
    keywords: ['acordo', 'handshake', 'parceria', 'negocio', 'negócio'],
    usesStroke: true,
    body: '<path d="M52 214L132 134L226 188M460 214L380 134L286 188M132 134L62 306L166 382L236 312M380 134L450 306L346 382L276 312M196 214L254 164C276 144 304 144 324 162L370 204M168 290L254 376C270 392 292 392 308 376L352 332" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round" stroke-linejoin="round"/>'
  },
  {
    id: 'building',
    name: 'Empresa',
    category: 'business',
    keywords: ['empresa', 'building', 'edificio', 'edifício', 'corporate'],
    usesStroke: true,
    body: '<path d="M104 446V100H316V446M316 206H408V446M154 166H202M242 166H290M154 242H202M242 242H290M154 318H202M242 318H290M352 272H382M352 338H382M72 446H440" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round" stroke-linejoin="round"/>'
  },
  {
    id: 'calculator',
    name: 'Calculadora',
    category: 'education',
    keywords: ['calculadora', 'calculator', 'matematica', 'matemática', 'contas'],
    usesStroke: true,
    body: '<rect x="112" y="54" width="288" height="404" rx="28" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><rect x="158" y="100" width="196" height="82" rx="12" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><path d="M174 250H206M256 250H288M338 250H370M174 320H206M256 320H288M338 320H370M174 390H206M256 390H288M338 390H370" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round"/>'
  },
  {
    id: 'puzzle',
    name: 'Puzzle',
    category: 'education',
    keywords: ['puzzle', 'peca', 'peça', 'aprendizagem', 'jogo'],
    usesStroke: true,
    body: '<path d="M86 102H214C204 84 208 62 222 48C244 26 280 26 302 48C316 62 320 84 310 102H426V218C444 208 466 212 480 226C502 248 502 284 480 306C466 320 444 324 426 314V430H310C320 448 316 470 302 484C280 506 244 506 222 484C208 470 204 448 214 430H86V314C68 324 46 320 32 306C10 284 10 248 32 226C46 212 68 208 86 218Z" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linejoin="round"/>'
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
      (character) => character.charCodeAt(0)
    )
  )
}

function encodeMetadata(
  document: MAQuadroLibraryElementDocument
) {
  const base64 = utf8ToBase64(
    JSON.stringify(document)
  )

  let encoded = META_START

  for (const character of base64) {
    encoded += String.fromCodePoint(
      TAG_BASE + character.charCodeAt(0)
    )
  }

  return encoded + META_END
}

function decodeMetadata(value: string) {
  let base64 = ''

  for (const character of value) {
    const codePoint = character.codePointAt(0)

    if (codePoint === undefined) {
      continue
    }

    const ascii = codePoint - TAG_BASE

    if (ascii < 0 || ascii > 127) {
      throw new Error('Metadados de elemento inválidos.')
    }

    base64 += String.fromCharCode(ascii)
  }

  return base64ToUtf8(base64)
}

export function getMAQuadroLibraryElement(
  elementId: string
) {
  return MA_QUADRO_LIBRARY_ELEMENTS.find(
    (element) => element.id === elementId
  ) || null
}

export function normalizeMAQuadroLibraryElementDocument(
  document: MAQuadroLibraryElementDocument
): MAQuadroLibraryElementDocument | null {
  const definition = getMAQuadroLibraryElement(
    document.elementId
  )

  if (!definition) {
    return null
  }

  return {
    version: 1,
    elementId: definition.id,
    color: normalizeColor(document.color),
    strokeWidth: normalizeStrokeWidth(
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
    color: normalizeColor(color),
    strokeWidth: normalizeStrokeWidth(
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
    throw new Error('Elemento desconhecido.')
  }

  const definition = getMAQuadroLibraryElement(
    normalized.elementId
  )

  if (!definition) {
    throw new Error('Elemento desconhecido.')
  }

  const body = definition.body
    .split(COLOR_TOKEN)
    .join(normalized.color)
    .split(STROKE_TOKEN)
    .join(String(normalized.strokeWidth))

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
    createMAQuadroLibraryElementSvg(document)
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
    throw new Error('Elemento desconhecido.')
  }

  const definition = getMAQuadroLibraryElement(
    normalized.elementId
  )

  return `Elemento · ${
    definition?.name || 'Biblioteca'
  }${encodeMetadata(normalized)}`
}

export function readMAQuadroLibraryElementDocumentFromName(
  name: string
): MAQuadroLibraryElementDocument | null {
  const start = name.indexOf(META_START)

  if (start < 0) {
    return null
  }

  const payloadStart = start + META_START.length
  const end = name.indexOf(
    META_END,
    payloadStart
  )

  if (end < 0) {
    return null
  }

  try {
    const parsed = JSON.parse(
      decodeMetadata(
        name.slice(payloadStart, end)
      )
    ) as Partial<MAQuadroLibraryElementDocument>

    if (
      parsed.version !== 1 ||
      typeof parsed.elementId !== 'string'
    ) {
      return null
    }

    return normalizeMAQuadroLibraryElementDocument(
      parsed as MAQuadroLibraryElementDocument
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
    throw new Error('Elemento desconhecido.')
  }

  return new File(
    [createMAQuadroLibraryElementSvg(normalized)],
    createMAQuadroLibraryElementObjectName(
      normalized
    ),
    {
      type: 'image/svg+xml',
      lastModified: Date.now()
    }
  )
}
