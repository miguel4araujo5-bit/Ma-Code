import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  '..'
)

const distDir = join(
  projectRoot,
  'dist'
)

const indexPath = join(
  distDir,
  'index.html'
)

const siteUrl =
  'https://ma-code.pt'

const imageUrl =
  `${siteUrl}/ma-code.png`

const standardRobots =
  'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'

const routes = [
  {
    route: '/contacto',
    title:
      'Pedir Proposta Gratuita | Contacto | MA-Code',
    description:
      'Peça uma proposta gratuita para website, loja online, sistema de marcações, automação, IA ou aplicação web à medida. Conte à MA-Code o que precisa.',
    keywords:
      'contacto MA-Code, pedir proposta website, orçamento website, orçamento loja online, sistema de marcações, automação IA, desenvolvimento web Portugal',
    robots:
      standardRobots,
    ogTitle:
      'Pedir Proposta Gratuita | Contacto | MA-Code',
    ogDescription:
      'Explique o projeto em 1 minuto e receba uma proposta ajustada para website, loja online, marcações, automação ou sistema à medida.',
    ogImageAlt:
      'MA-Code - criação de websites profissionais, lojas online, automação e IA',
    twitterTitle:
      'Pedir Proposta Gratuita | Contacto | MA-Code',
    twitterDescription:
      'Explique o projeto em 1 minuto e receba uma proposta ajustada para website, loja online, marcações, automação ou sistema à medida.',
    twitterImageAlt:
      'MA-Code - criação de websites profissionais, lojas online, automação e IA'
  },
  {
    route:
      '/criacao-websites',
    title:
      'Criação de Websites desde 19€/mês | MA-Code',
    description:
      'Criação de websites profissionais desde 19€/mês, com domínio e alojamento, design mobile-first, SEO base e estrutura preparada para gerar contactos.',
    keywords:
      'criação de websites, criação de sites, websites profissionais, websites desde 19€/mês, site com domínio e alojamento, websites para empresas, websites para pequenos negócios, desenvolvimento web Portugal, sites responsivos, site profissional para negócio, MA-Code',
    robots:
      standardRobots,
    ogTitle:
      'Criação de Websites Profissionais desde 19€/mês | MA-Code',
    ogDescription:
      'Websites profissionais para negócios que querem começar simples, transmitir confiança, receber contactos e crescer online por fases.',
    ogImageAlt:
      'Criação de Websites Profissionais - MA-Code',
    twitterTitle:
      'Criação de Websites Profissionais desde 19€/mês | MA-Code',
    twitterDescription:
      'Websites profissionais para negócios que querem começar simples, transmitir confiança, receber contactos e crescer online por fases.',
    twitterImageAlt:
      'Criação de Websites Profissionais - MA-Code'
  },
  {
    route:
      '/lojas-online',
    title:
      'Criação de Lojas Online em Portugal | E-commerce | MA-Code',
    description:
      'Criação de lojas online modernas com catálogo, carrinho de compras, checkout, estrutura de produtos e base preparada para encomendas, pagamentos e gestão.',
    keywords:
      'criação de lojas online, loja online Portugal, e-commerce Portugal, criação ecommerce, loja virtual, catálogo online, carrinho de compras, checkout online, loja online para pequenos negócios, MA-Code',
    robots:
      standardRobots,
    ogTitle:
      'Criação de Lojas Online | MA-Code',
    ogDescription:
      'Lojas online modernas, responsivas e preparadas para apresentar produtos, vender melhor e organizar encomendas.',
    ogImageAlt:
      'Criação de Lojas Online - MA-Code',
    twitterTitle:
      'Criação de Lojas Online | MA-Code',
    twitterDescription:
      'Lojas online modernas, responsivas e preparadas para apresentar produtos, vender melhor e organizar encomendas.',
    twitterImageAlt:
      'Criação de Lojas Online - MA-Code'
  },
  {
    route:
      '/sistemas-marcacao',
    title:
      'Sistema de Marcações Online para Empresas | MA-Code',
    description:
      'Criação de sistemas de marcação online para salões, clínicas, serviços locais e negócios que precisam de organizar horários, pedidos, agenda e disponibilidade.',
    keywords:
      'sistema de marcações online, agenda online, marcações online, reservas online, sistema de reservas, marcações para salão, marcações para clínica, gestão de agenda online, painel de marcações, MA-Code',
    robots:
      standardRobots,
    ogTitle:
      'Sistemas de Marcação Online | MA-Code',
    ogDescription:
      'Sistemas de marcação online para receber pedidos, organizar agenda e reduzir trabalho manual em negócios com horários.',
    ogImageAlt:
      'Sistemas de Marcação Online - MA-Code',
    twitterTitle:
      'Sistemas de Marcação Online | MA-Code',
    twitterDescription:
      'Sistemas de marcação online para receber pedidos, organizar agenda e reduzir trabalho manual em negócios com horários.',
    twitterImageAlt:
      'Sistemas de Marcação Online - MA-Code'
  },
  {
    route:
      '/automacao-ia',
    title:
      'Automação com IA para Empresas em Portugal | MA-Code',
    description:
      'Automação com IA, integrações API, assistentes digitais, formulários inteligentes e sistemas internos para reduzir tarefas repetitivas e organizar processos.',
    keywords:
      'automação com IA, inteligência artificial para empresas, automação de processos, assistente IA, integrações API, automação empresarial, formulários inteligentes, sistemas internos, dashboards para empresas, MA-Code',
    robots:
      standardRobots,
    ogTitle:
      'Automação e IA para Empresas | MA-Code',
    ogDescription:
      'Soluções de automação, IA e integrações para reduzir tarefas repetitivas, organizar processos e tornar o negócio mais eficiente.',
    ogImageAlt:
      'Automação e Inteligência Artificial para Empresas - MA-Code',
    twitterTitle:
      'Automação e IA para Empresas | MA-Code',
    twitterDescription:
      'Soluções de automação, IA e integrações para reduzir tarefas repetitivas, organizar processos e tornar o negócio mais eficiente.',
    twitterImageAlt:
      'Automação e Inteligência Artificial para Empresas - MA-Code'
  },
  {
    route:
      '/projetos',
    title:
      'Portefólio de Websites, Lojas Online e Sistemas Digitais | MA-Code',
    description:
      'Conheça projetos publicados pela MA-Code: websites profissionais, lojas online, sistemas de marcação, aplicações PWA, áreas administrativas, automação, IA e soluções digitais à medida.',
    keywords:
      'projetos MA-Code, portefólio websites, criação de websites Portugal, lojas online, sistemas de marcação, aplicações web, PWA, área administrativa, automação, IA, desenvolvimento web',
    robots:
      standardRobots,
    ogTitle:
      'Portefólio de Websites, Lojas Online e Sistemas Digitais | MA-Code',
    ogDescription:
      'Projetos publicados da MA-Code com websites profissionais, lojas online, sistemas de marcação, PWA, áreas administrativas, automação, IA e soluções digitais em funcionamento.',
    ogImageAlt:
      'Projetos MA-Code - websites, lojas online, sistemas de marcação e aplicações web',
    twitterTitle:
      'Portefólio de Websites, Lojas Online e Sistemas Digitais | MA-Code',
    twitterDescription:
      'Veja projetos publicados da MA-Code: websites profissionais, lojas online, sistemas de marcação, PWA, áreas administrativas, automação, IA e aplicações web.',
    twitterImageAlt:
      'Projetos MA-Code - websites, lojas online e aplicações web'
  },
  {
    route:
      '/produtos',
    title:
      'Produtos MA-Code | Apps e ferramentas digitais',
    description:
      'Conheça os produtos próprios da MA-Code: MA PDF, MA Carteira, MA-BTC ALERTAS, MA-Recortes, MA-Quadro e o futuro MA-Professor para gestão pedagógica.',
    keywords:
      'produtos MA-Code, MA PDF, ferramentas PDF, MA Carteira, MA-BTC ALERTAS, alertas bitcoin, MA-Recortes, criar stickers WhatsApp, MA-Quadro, editor de design, criar post Instagram, MA-Professor, gestão de sumários, UFCD, apps web, ferramentas digitais',
    robots:
      standardRobots,
    ogTitle:
      'Produtos MA-Code | Apps e ferramentas digitais',
    ogDescription:
      'Produtos próprios da MA-Code: ferramentas PDF, carteira digital, alertas Bitcoin, criação de stickers, edição de design local e soluções de gestão pedagógica.',
    ogImageAlt:
      'Produtos MA-Code',
    twitterTitle:
      'Produtos MA-Code | Apps e ferramentas digitais',
    twitterDescription:
      'Produtos próprios da MA-Code: MA PDF, MA Carteira, MA-BTC ALERTAS, MA-Recortes, MA-Quadro e MA-Professor.',
    twitterImageAlt:
      'Produtos MA-Code'
  },
  {
    route:
      '/produtos/mapdf',
    title:
      'MA PDF | Juntar, dividir, comprimir e converter PDF e JPG',
    description:
      'Junte, divida e comprima PDF, converta PDF para JPG e imagens JPG para PDF gratuitamente no navegador. Os ficheiros permanecem no seu dispositivo.',
    keywords:
      'MA PDF, juntar PDF, dividir PDF, comprimir PDF, PDF para JPG, JPG para PDF, converter imagens para PDF, ferramentas PDF grátis, PDF privado, MA-Code',
    robots:
      standardRobots,
    ogTitle:
      'MA PDF | Juntar, dividir, comprimir e converter PDF e JPG',
    ogDescription:
      'Ferramentas gratuitas e privadas para juntar, dividir, otimizar e converter ficheiros PDF e JPG diretamente no navegador.',
    ogImageAlt:
      'MA PDF - ferramentas PDF da MA-Code',
    twitterTitle:
      'MA PDF | Juntar, dividir, comprimir e converter PDF e JPG',
    twitterDescription:
      'Ferramentas gratuitas para juntar, dividir, otimizar e converter PDF para JPG ou JPG para PDF no navegador.',
    twitterImageAlt:
      'MA PDF - ferramentas PDF da MA-Code'
  },
  {
    route:
      '/produtos/ma-pdf',
    canonical:
      `${siteUrl}/produtos/mapdf`,
    title:
      'MA PDF | Juntar, dividir, comprimir e converter PDF e JPG',
    description:
      'Junte, divida e comprima PDF, converta PDF para JPG e imagens JPG para PDF gratuitamente no navegador. Os ficheiros permanecem no seu dispositivo.',
    keywords:
      'MA PDF, juntar PDF, dividir PDF, comprimir PDF, PDF para JPG, JPG para PDF, converter imagens para PDF, ferramentas PDF grátis, PDF privado, MA-Code',
    robots:
      standardRobots,
    ogTitle:
      'MA PDF | Juntar, dividir, comprimir e converter PDF e JPG',
    ogDescription:
      'Ferramentas gratuitas e privadas para juntar, dividir, otimizar e converter ficheiros PDF e JPG diretamente no navegador.',
    ogImageAlt:
      'MA PDF - ferramentas PDF da MA-Code',
    twitterTitle:
      'MA PDF | Juntar, dividir, comprimir e converter PDF e JPG',
    twitterDescription:
      'Ferramentas gratuitas para juntar, dividir, otimizar e converter PDF para JPG ou JPG para PDF no navegador.',
    twitterImageAlt:
      'MA PDF - ferramentas PDF da MA-Code'
  },
  {
    route:
      '/produtos/ma-carteira',
    title:
      'MA-Carteira | Portefólios Multichain | MA-Code',
    description:
      'Organize endereços públicos de várias redes num só portefólio e consulte saldos, tokens, transações e gráficos disponíveis, sem ligar a carteira nem introduzir seed phrases.',
    keywords:
      'MA-Carteira, portefólio multichain, PulseChain, Ethereum, Solana, Bitcoin, TRON, BNB Chain, Base, Arbitrum, Polygon, endereços públicos, gráficos de preço, MA-Code',
    robots:
      'index, follow, max-image-preview:large, max-snippet:-1',
    ogTitle:
      'MA-Carteira | Portefólios Multichain',
    ogDescription:
      'Organize endereços públicos de várias redes num só portefólio e consulte saldos, tokens, transações e gráficos disponíveis, sem ligar a carteira nem introduzir seed phrases.',
    twitterTitle:
      'MA-Carteira | Portefólios Multichain',
    twitterDescription:
      'Organize endereços públicos de várias redes num só portefólio e consulte saldos, tokens, transações e gráficos disponíveis, sem ligar a carteira nem introduzir seed phrases.'
  },
  {
    route:
      '/produtos/ma-btc-alertas',
    title:
      'MA-BTC ALERTAS | Alertas Bitcoin em USD',
    description:
      'Receba alertas do preço do Bitcoin em dólares quando o BTC/USD acumular uma subida ou descida de pelo menos 1%, com consultas horárias e snooze de 8 horas.',
    keywords:
      'MA-BTC ALERTAS, alertas Bitcoin, BTC USD, notificações Bitcoin, preço Bitcoin, alerta BTC, MA-Code',
    robots:
      'index, follow, max-image-preview:large',
    themeColor:
      '#f7931a',
    ogTitle:
      'MA-BTC ALERTAS | Alertas Bitcoin em USD',
    ogDescription:
      'Notificações BTC/USD quando o Bitcoin sobe ou desce pelo menos 1%. Consultas horárias entre as 07:00 e as 23:00, com snooze de 8 horas.',
    twitterTitle:
      'MA-BTC ALERTAS | Alertas Bitcoin em USD',
    twitterDescription:
      'Alertas BTC/USD de variações acumuladas de pelo menos 1%.'
  },
  {
    route:
      '/produtos/ma-recortes',
    title:
      'MA-Recortes | Criar stickers para WhatsApp',
    description:
      'Crie imagens preparadas para stickers do WhatsApp: selecione uma fotografia por pontos, corrija o recorte e copie o sticker diretamente.',
    keywords:
      'criar sticker WhatsApp, recortar imagem, copiar sticker, remover fundo, PNG transparente, MA-Recortes, MA-Code',
    robots:
      'index, follow, max-image-preview:large',
    ogTitle:
      'MA-Recortes | Criar stickers para WhatsApp',
    ogDescription:
      'Selecione fotografias por pontos, ajuste as margens e copie o recorte diretamente para o WhatsApp.',
    twitterTitle:
      'MA-Recortes | Criar stickers para WhatsApp',
    twitterDescription:
      'Selecione, corrija e copie imagens transparentes preparadas para stickers.'
  },
  {
    route:
      '/produtos/ma-professor',
    title:
      'MA-Professor | Fase piloto para docentes',
    description:
      'MA-Professor é um ambiente digital para organização do trabalho docente. A fase piloto tem acesso gratuito e vagas limitadas, mediante pedido de acesso.',
    keywords:
      'MA-Professor, gestão de sumários, UFCD, cursos profissionais, planificação de aulas, avaliações de alunos, faltas, recuperação de aprendizagens',
    robots:
      'noindex, nofollow, noarchive, nosnippet, noimageindex',
    ogTitle:
      'MA-Professor | Fase piloto',
    ogDescription:
      'Ambiente digital para organização do trabalho docente, atualmente em fase piloto com acesso gratuito e vagas limitadas.',
    twitterTitle:
      'MA-Professor | Fase piloto',
    twitterDescription:
      'MA-Professor em fase piloto: organização de aulas, sumários, turmas, assiduidade e avaliação para docentes.'
  },
  {
    route:
      '/produtos/ma-quadro',
    title:
      'MA-Quadro | Editor de design local da MA-Code',
    description:
      'Crie publicações, stories, cabeçalhos e cartazes com texto, imagens, formas, camadas, modelos e exportação local. Sem conta e sem telemetria.',
    keywords:
      'MA-Quadro, editor de design online, alternativa Canva, criar post Instagram, criar story, cartaz A4, editor local, Fabric.js',
    robots:
      standardRobots,
    ogTitle:
      'MA-Quadro | Editor de design local',
    ogDescription:
      'Editor visual para criar designs com imagens, texto, formas, modelos e exportação local.',
    ogImageAlt:
      'MA-Quadro da MA-Code',
    twitterTitle:
      'MA-Quadro | Editor de design local',
    twitterDescription:
      'Crie e guarde designs no próprio dispositivo, sem conta e sem telemetria.'
  }
]

function escapeRegExp(
  value
) {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&'
  )
}

function escapeAttribute(
  value
) {
  return value
    .replaceAll(
      '&',
      '&amp;'
    )
    .replaceAll(
      '"',
      '&quot;'
    )
    .replaceAll(
      '<',
      '&lt;'
    )
    .replaceAll(
      '>',
      '&gt;'
    )
}

function escapeText(
  value
) {
  return value
    .replaceAll(
      '&',
      '&amp;'
    )
    .replaceAll(
      '<',
      '&lt;'
    )
    .replaceAll(
      '>',
      '&gt;'
    )
}

function replaceRequired(
  html,
  pattern,
  replacement,
  label
) {
  if (
    !pattern.test(html)
  ) {
    throw new Error(
      `Não foi possível encontrar ${label} em dist/index.html.`
    )
  }

  return html.replace(
    pattern,
    replacement
  )
}

function replaceNamedMeta(
  html,
  name,
  content
) {
  const pattern =
    new RegExp(
      `<meta\\b(?=[^>]*\\bname=["']${escapeRegExp(name)}["'])[^>]*>`,
      'i'
    )

  return replaceRequired(
    html,
    pattern,
    `<meta name="${name}" content="${escapeAttribute(content)}" />`,
    `<meta name="${name}">`
  )
}

function replacePropertyMeta(
  html,
  property,
  content
) {
  const pattern =
    new RegExp(
      `<meta\\b(?=[^>]*\\bproperty=["']${escapeRegExp(property)}["'])[^>]*>`,
      'i'
    )

  return replaceRequired(
    html,
    pattern,
    `<meta property="${property}" content="${escapeAttribute(content)}" />`,
    `<meta property="${property}">`
  )
}

function replaceCanonical(
  html,
  href
) {
  const pattern =
    /<link\b(?=[^>]*\brel=["']canonical["'])[^>]*>/i

  return replaceRequired(
    html,
    pattern,
    `<link rel="canonical" href="${escapeAttribute(href)}" />`,
    '<link rel="canonical">'
  )
}

function stripHomepageStructuredData(
  html
) {
  return html.replace(
    /\s*<script\b(?=[^>]*\btype=["']application\/ld\+json["'])[^>]*>[\s\S]*?<\/script>\s*/gi,
    '\n'
  )
}

function renderRouteHtml(
  baseHtml,
  route
) {
  const canonical =
    route.canonical ??
    `${siteUrl}${route.route}`

  let html =
    stripHomepageStructuredData(
      baseHtml
    )

  html =
    replaceRequired(
      html,
      /<title>[\s\S]*?<\/title>/i,
      `<title>${escapeText(route.title)}</title>`,
      '<title>'
    )

  html =
    replaceNamedMeta(
      html,
      'description',
      route.description
    )

  html =
    replaceNamedMeta(
      html,
      'keywords',
      route.keywords
    )

  html =
    replaceNamedMeta(
      html,
      'robots',
      route.robots
    )

  html =
    replaceCanonical(
      html,
      canonical
    )

  html =
    replacePropertyMeta(
      html,
      'og:url',
      canonical
    )

  html =
    replacePropertyMeta(
      html,
      'og:title',
      route.ogTitle
    )

  html =
    replacePropertyMeta(
      html,
      'og:description',
      route.ogDescription
    )

  html =
    replacePropertyMeta(
      html,
      'og:image',
      imageUrl
    )

  html =
    replaceNamedMeta(
      html,
      'twitter:url',
      canonical
    )

  html =
    replaceNamedMeta(
      html,
      'twitter:title',
      route.twitterTitle
    )

  html =
    replaceNamedMeta(
      html,
      'twitter:description',
      route.twitterDescription
    )

  html =
    replaceNamedMeta(
      html,
      'twitter:image',
      imageUrl
    )

  if (
    route.ogImageAlt
  ) {
    html =
      replacePropertyMeta(
        html,
        'og:image:alt',
        route.ogImageAlt
      )
  }

  if (
    route.twitterImageAlt
  ) {
    html =
      replaceNamedMeta(
        html,
        'twitter:image:alt',
        route.twitterImageAlt
      )
  }

  if (
    route.themeColor
  ) {
    html =
      replaceNamedMeta(
        html,
        'theme-color',
        route.themeColor
      )
  }

  return html
}

function outputPathForRoute(
  route
) {
  const relativeRoute =
    route.replace(
      /^\/+|\/+$/g,
      ''
    )

  if (
    !relativeRoute ||
    relativeRoute.includes(
      '..'
    )
  ) {
    throw new Error(
      `Rota inválida para geração estática: ${route}`
    )
  }

  return join(
    distDir,
    `${relativeRoute}.html`
  )
}

const baseHtml =
  await readFile(
    indexPath,
    'utf8'
  )

for (
  const route of routes
) {
  const outputPath =
    outputPathForRoute(
      route.route
    )

  await mkdir(
    dirname(outputPath),
    {
      recursive: true
    }
  )

  await writeFile(
    outputPath,
    renderRouteHtml(
      baseHtml,
      route
    ),
    'utf8'
  )
}

console.log(
  `[route-html] ${routes.length} rotas com metadata estática geradas.`
)
