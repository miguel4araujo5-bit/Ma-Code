export type MAQuadroElementCategory =
  | 'shapes'
  | 'communication'
  | 'business'
  | 'education'
  | 'technology'
  | 'interface'
  | 'decorative'
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
  { id: 'communication', label: 'Comunicação' },
  { id: 'business', label: 'Negócio' },
  { id: 'education', label: 'Educação' },
  { id: 'technology', label: 'Tecnologia' },
  { id: 'interface', label: 'Interface' },
  { id: 'decorative', label: 'Decoração' },
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
  },
  {
    id: 'sparkles', name: 'Brilhos', category: 'decorative',
    keywords: ['brilhos', 'sparkles', 'estrela', 'magia', 'decoracao', 'decoração'], usesStroke: false,
    body: '<path d="M174 54L196 122L264 144L196 166L174 234L152 166L84 144L152 122Z" fill="{{color}}"/><path d="M350 196L374 270L448 294L374 318L350 392L326 318L252 294L326 270Z" fill="{{color}}"/><circle cx="120" cy="354" r="28" fill="{{color}}"/>'
  },
  {
    id: 'flower', name: 'Flor', category: 'decorative',
    keywords: ['flor', 'flower', 'natureza', 'primavera', 'decoracao', 'decoração'], usesStroke: true,
    body: '<circle cx="256" cy="256" r="48" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><ellipse cx="256" cy="128" rx="62" ry="88" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><ellipse cx="256" cy="384" rx="62" ry="88" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><ellipse cx="128" cy="256" rx="88" ry="62" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><ellipse cx="384" cy="256" rx="88" ry="62" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/>'
  },
  {
    id: 'sun', name: 'Sol', category: 'decorative',
    keywords: ['sol', 'sun', 'verao', 'verão', 'tempo', 'natureza'], usesStroke: true,
    body: '<circle cx="256" cy="256" r="92" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><path d="M256 48V104M256 408V464M48 256H104M408 256H464M109 109L149 149M363 363L403 403M403 109L363 149M149 363L109 403" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round"/>'
  },
  {
    id: 'moon', name: 'Lua', category: 'decorative',
    keywords: ['lua', 'moon', 'noite', 'ceu', 'céu'], usesStroke: false,
    body: '<path d="M350 64C246 78 166 168 166 276C166 354 210 424 278 458C150 466 48 368 48 244C48 120 152 24 276 34C302 36 326 46 350 64Z" fill="{{color}}"/>'
  },
  {
    id: 'cloud', name: 'Nuvem', category: 'decorative',
    keywords: ['nuvem', 'cloud', 'ceu', 'céu', 'tempo'], usesStroke: true,
    body: '<path d="M124 390H394C442 390 472 354 472 312C472 268 438 232 394 232C386 232 378 234 370 236C350 166 292 122 224 122C146 122 82 184 78 262C40 274 18 306 18 342C18 370 40 390 68 390Z" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linejoin="round"/>'
  },
  {
    id: 'leaf', name: 'Folha', category: 'decorative',
    keywords: ['folha', 'leaf', 'natureza', 'eco', 'verde'], usesStroke: true,
    body: '<path d="M80 420C78 212 188 82 432 58C430 294 322 430 80 420Z" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linejoin="round"/><path d="M104 392C190 302 274 224 406 92" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round"/>'
  },
  {
    id: 'confetti', name: 'Confetes', category: 'decorative',
    keywords: ['confetes', 'confetti', 'festa', 'celebracao', 'celebração'], usesStroke: true,
    body: '<path d="M120 76L150 140M278 62L266 138M398 112L350 166M86 264L154 276M410 258L344 282M138 392L188 346M330 420L312 354" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round"/><circle cx="230" cy="248" r="34" fill="{{color}}"/><rect x="362" y="340" width="58" height="58" rx="10" fill="{{color}}"/>'
  },
  {
    id: 'music-note', name: 'Música', category: 'media',
    keywords: ['musica', 'música', 'music', 'som', 'nota'], usesStroke: true,
    body: '<path d="M198 100V360M198 126L406 82V316" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round" stroke-linejoin="round"/><ellipse cx="142" cy="382" rx="64" ry="46" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><ellipse cx="350" cy="338" rx="64" ry="46" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/>'
  },
  {
    id: 'play', name: 'Reproduzir', category: 'media',
    keywords: ['play', 'reproduzir', 'video', 'vídeo', 'media'], usesStroke: false,
    body: '<circle cx="256" cy="256" r="214" fill="{{color}}"/><path d="M212 154L370 256L212 358Z" fill="#ffffff"/>'
  },
  {
    id: 'camera', name: 'Câmara', category: 'media',
    keywords: ['camera', 'câmara', 'foto', 'fotografia', 'imagem'], usesStroke: true,
    body: '<rect x="54" y="142" width="404" height="278" rx="34" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><path d="M160 142L198 90H314L352 142" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linejoin="round"/><circle cx="256" cy="280" r="86" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/>'
  },
  {
    id: 'image', name: 'Imagem', category: 'media',
    keywords: ['imagem', 'image', 'foto', 'paisagem', 'galeria'], usesStroke: true,
    body: '<rect x="58" y="70" width="396" height="372" rx="28" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><circle cx="176" cy="170" r="42" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><path d="M82 394L184 286L258 350L330 264L430 394" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round" stroke-linejoin="round"/>'
  },
  {
    id: 'microphone', name: 'Microfone', category: 'media',
    keywords: ['microfone', 'microphone', 'audio', 'áudio', 'voz', 'podcast'], usesStroke: true,
    body: '<rect x="188" y="56" width="136" height="278" rx="68" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><path d="M126 250V270C126 342 184 400 256 400C328 400 386 342 386 270V250M256 400V462M188 462H324" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round"/>'
  },
  {
    id: 'volume', name: 'Som', category: 'media',
    keywords: ['som', 'volume', 'audio', 'áudio', 'speaker'], usesStroke: true,
    body: '<path d="M72 216H166L268 130V382L166 296H72Z" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linejoin="round"/><path d="M326 200C354 228 354 284 326 312M374 150C434 210 434 302 374 362" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round"/>'
  },
  {
    id: 'users', name: 'Grupo', category: 'people',
    keywords: ['grupo', 'pessoas', 'users', 'equipa', 'equipe', 'team'], usesStroke: true,
    body: '<circle cx="210" cy="160" r="76" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><circle cx="364" cy="188" r="58" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><path d="M56 432C68 330 128 280 210 280C292 280 352 330 364 432M330 304C394 306 438 344 454 412" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round"/>'
  },
  {
    id: 'teacher', name: 'Professor', category: 'people',
    keywords: ['professor', 'professora', 'teacher', 'educacao', 'educação', 'aula'], usesStroke: true,
    body: '<circle cx="168" cy="148" r="66" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><path d="M60 420C70 328 112 286 168 286C224 286 266 328 276 420M302 106H458V316H302M332 164H428M332 218H404" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round" stroke-linejoin="round"/>'
  },
  {
    id: 'child', name: 'Aluno', category: 'people',
    keywords: ['aluno', 'aluna', 'crianca', 'criança', 'student', 'escola'], usesStroke: true,
    body: '<circle cx="256" cy="162" r="82" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><path d="M92 442C108 338 164 292 256 292C348 292 404 338 420 442" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round"/><path d="M184 104C208 64 304 58 336 112" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round"/>'
  },
  {
    id: 'trophy', name: 'Troféu', category: 'decorative',
    keywords: ['trofeu', 'troféu', 'premio', 'prémio', 'winner', 'vencedor'], usesStroke: true,
    body: '<path d="M166 70H346V188C346 266 310 318 256 318C202 318 166 266 166 188ZM256 318V392M184 442H328M214 392H298" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round" stroke-linejoin="round"/><path d="M166 112H86V166C86 226 124 264 178 272M346 112H426V166C426 226 388 264 334 272" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linejoin="round"/>'
  },
  {
    id: 'gift', name: 'Presente', category: 'decorative',
    keywords: ['presente', 'gift', 'oferta', 'aniversario', 'aniversário'], usesStroke: true,
    body: '<rect x="72" y="190" width="368" height="254" rx="20" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><path d="M256 190V444M72 268H440M256 190C206 190 146 174 146 124C146 84 188 68 218 92C240 110 252 144 256 190ZM256 190C306 190 366 174 366 124C366 84 324 68 294 92C272 110 260 144 256 190Z" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linejoin="round"/>'
  },
  {
    id: 'flag', name: 'Bandeira', category: 'decorative',
    keywords: ['bandeira', 'flag', 'marcador', 'objetivo'], usesStroke: true,
    body: '<path d="M112 458V62M126 84H404L344 176L404 268H126" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round" stroke-linejoin="round"/>'
  },
  {
    id: 'rocket', name: 'Foguetão', category: 'technology',
    keywords: ['foguetao', 'foguetão', 'rocket', 'lancamento', 'lançamento', 'startup'], usesStroke: true,
    body: '<path d="M222 310C160 292 126 250 112 204C194 102 300 48 418 54C424 172 370 278 268 360C250 346 234 330 222 310Z" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linejoin="round"/><circle cx="314" cy="158" r="42" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><path d="M178 328L94 412L100 340L172 268M246 386L188 454L180 368" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linejoin="round"/>'
  },
  {
    id: 'globe', name: 'Mundo', category: 'education',
    keywords: ['mundo', 'globe', 'planeta', 'geografia', 'global'], usesStroke: true,
    body: '<circle cx="256" cy="256" r="202" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><path d="M54 256H458M256 54C316 108 344 174 344 256C344 338 316 404 256 458C196 404 168 338 168 256C168 174 196 108 256 54ZM88 148H424M88 364H424" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/>'
  },
  {
    id: 'clock', name: 'Relógio', category: 'interface',
    keywords: ['relogio', 'relógio', 'clock', 'tempo', 'hora'], usesStroke: true,
    body: '<circle cx="256" cy="256" r="202" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><path d="M256 126V264L350 326" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round" stroke-linejoin="round"/>'
  },
  {
    id: 'lock', name: 'Cadeado', category: 'interface',
    keywords: ['cadeado', 'lock', 'seguranca', 'segurança', 'privado'], usesStroke: true,
    body: '<rect x="98" y="222" width="316" height="232" rx="28" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/><path d="M166 222V158C166 108 204 68 256 68C308 68 346 108 346 158V222" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linecap="round"/><circle cx="256" cy="330" r="24" fill="{{color}}"/>'
  },
  {
    id: 'eye', name: 'Visualizar', category: 'interface',
    keywords: ['olho', 'eye', 'visualizar', 'ver', 'preview'], usesStroke: true,
    body: '<path d="M48 256C104 154 176 106 256 106C336 106 408 154 464 256C408 358 336 406 256 406C176 406 104 358 48 256Z" fill="none" stroke="{{color}}" stroke-width="{{stroke}}" stroke-linejoin="round"/><circle cx="256" cy="256" r="70" fill="none" stroke="{{color}}" stroke-width="{{stroke}}"/>'
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
