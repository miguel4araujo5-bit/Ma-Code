export type PortfolioImage = {
  src: string
  alt: string
  caption: string
}

export type PortfolioProject = {
  slug: string
  title: string
  subtitle: string
  teaser: string
  description: string
  href: string
  category: string
  clientNeed: string
  highlights: string[]
  deliverables: string[]
  businessValue: string[]
  technologies: string[]
  images: PortfolioImage[]
}

export const portfolioProjects: PortfolioProject[] = [
  {
    slug: 'rosa-maria',
    title: 'Rosa Maria Cabeleireiros',
    subtitle: 'Website profissional com marcações online e painel privado',
    teaser:
      'Website para salão de cabeleireiro com marcações online, agenda, área administrativa e experiência mobile.',
    category: 'Negócio Local • Marcações • Área Admin',
    href: 'https://rosa-maria.pt',
    description:
      'Website profissional criado para modernizar a presença digital do salão Rosa Maria Cabeleireiros, em São Mamede de Infesta.\n\nA solução junta apresentação dos serviços, marcações online, agenda, painel privado, notificações, localização com mapa e uma experiência pensada para telemóvel.',
    clientNeed:
      'O salão precisava de parecer mais profissional online e de receber pedidos de marcação de forma mais organizada, sem depender apenas de chamadas, mensagens soltas ou gestão manual.',
    highlights: [
      'Website profissional adaptado a telemóvel',
      'Sistema de marcações online simples e direto',
      'Agenda e painel privado para gestão interna',
      'Notificações de novas marcações',
      'Localização com mapa e base de SEO local',
    ],
    deliverables: [
      'Website institucional com apresentação dos serviços',
      'Formulário de marcação adaptado ao negócio',
      'Agenda administrativa para consulta de horários',
      'Painel privado para gestão de marcações',
      'PWA preparada para utilização no telemóvel',
    ],
    businessValue: [
      'Imagem online mais profissional',
      'Mais facilidade em receber pedidos de marcação',
      'Menos tempo perdido em gestão manual',
      'Melhor experiência para clientes locais',
      'Base pronta para evoluir com novas funcionalidades',
    ],
    technologies: ['React', 'TypeScript', 'Tailwind CSS', 'Cloudflare Workers', 'PWA'],
    images: [
      {
        src: '/projetos/rosa-home.PNG',
        alt: 'Página inicial do website Rosa Maria Cabeleireiros em São Mamede de Infesta',
        caption: 'Página inicial',
      },
      {
        src: '/projetos/rosa-marcacoes.PNG',
        alt: 'Sistema de marcações online do website Rosa Maria Cabeleireiros',
        caption: 'Marcações online',
      },
      {
        src: '/projetos/rosa-agenda.PNG',
        alt: 'Agenda de marcações do painel administrativo Rosa Maria Cabeleireiros',
        caption: 'Agenda de marcações',
      },
      {
        src: '/projetos/rosa-adminview.PNG',
        alt: 'Painel privado de administração do website Rosa Maria Cabeleireiros',
        caption: 'Painel administrativo',
      },
      {
        src: '/projetos/rosa-mapas.PNG',
        alt: 'Secção de localização e mapa do website Rosa Maria Cabeleireiros',
        caption: 'Localização e mapa',
      },
    ],
  },
  {
    slug: 'porto-exotico',
    title: 'Porto Exótico',
    subtitle: 'Loja online com catálogo, carrinho, checkout e gestão de encomendas',
    teaser:
      'E-commerce responsivo com catálogo, carrinho de compras, checkout, cookies, analytics e área administrativa.',
    category: 'E-commerce • Checkout • Área Admin',
    href: 'https://portoexotico.pt',
    description:
      'Reconstrução de uma presença digital antiga para uma loja online moderna, discreta, responsiva e preparada para venda direta.\n\nO projeto inclui catálogo de produtos, páginas individuais, carrinho de compras, checkout, páginas legais, consentimento de cookies, analytics, assistente digital e área administrativa para acompanhamento de encomendas.',
    clientNeed:
      'A marca precisava de uma loja online mais credível, organizada e preparada para vender, com apresentação profissional dos produtos, navegação clara, checkout e gestão interna das encomendas.',
    highlights: [
      'Loja online com categorias e páginas de produto',
      'Carrinho de compras e checkout estruturado',
      'Área administrativa para gestão de encomendas',
      'Consentimento de cookies e páginas legais',
      'SEO, analytics e preparação para pagamentos online',
    ],
    deliverables: [
      'Interface e-commerce moderna e responsiva',
      'Catálogo de produtos organizado por categorias',
      'Fluxo de compra com carrinho e checkout',
      'Páginas legais, cookies e consentimento',
      'Backoffice para acompanhamento de encomendas',
      'Base técnica preparada para crescimento da loja',
    ],
    businessValue: [
      'Presença digital mais profissional e credível',
      'Processo de compra mais claro para o cliente',
      'Gestão interna mais organizada',
      'Melhor experiência em mobile',
      'Base preparada para escalar produtos, pagamentos e encomendas',
    ],
    technologies: ['React', 'TypeScript', 'Tailwind CSS', 'Cloudflare Workers', 'D1 Database'],
    images: [
      {
        src: '/projetos/porto-home.PNG',
        alt: 'Página inicial da loja online Porto Exótico',
        caption: 'Página inicial',
      },
      {
        src: '/projetos/porto-loja.PNG',
        alt: 'Catálogo de produtos da loja online Porto Exótico',
        caption: 'Loja online',
      },
      {
        src: '/projetos/porto-carrinhocompras.PNG',
        alt: 'Carrinho de compras da loja online Porto Exótico',
        caption: 'Carrinho de compras',
      },
      {
        src: '/projetos/porto-pagamentos.PNG',
        alt: 'Secção de métodos de pagamento da loja online Porto Exótico',
        caption: 'Métodos de pagamento',
      },
      {
        src: '/projetos/porto-admin.PNG',
        alt: 'Área administrativa para gestão de encomendas da loja Porto Exótico',
        caption: 'Área administrativa',
      },
      {
        src: '/projetos/porto-cookies.PNG',
        alt: 'Banner de consentimento de cookies da loja online Porto Exótico',
        caption: 'Consentimento de cookies',
      },
      {
        src: '/projetos/porto-ia-assistente.PNG',
        alt: 'Assistente de inteligência artificial da loja online Porto Exótico',
        caption: 'Assistente IA',
      },
    ],
  },
  {
    slug: 'reo',
    title: 'REO – Rádio Escolar Online',
    subtitle: 'PWA para rádio escolar, programas e arquivo digital',
    teaser:
      'Plataforma PWA para rádio escolar com arquivo digital, programas, episódios e reprodução de áudio.',
    category: 'Educação • PWA • Arquivo Digital',
    href: 'https://reo.miguelaraujo.workers.dev',
    description:
      'Plataforma digital criada para organizar, preservar e tornar acessível o arquivo da rádio escolar do Agrupamento de Escolas de S. Bento de Vizela.\n\nA solução permite consultar programas, ouvir emissões, navegar por conteúdos e aproximar a rádio escolar da comunidade educativa através de uma experiência simples, moderna e acessível em computador e telemóvel.',
    clientNeed:
      'A rádio escolar precisava de uma presença digital organizada, onde a comunidade pudesse encontrar programas, consultar episódios e aceder ao arquivo sem depender de ficheiros dispersos ou publicações difíceis de encontrar.',
    highlights: [
      'Arquivo digital organizado por ano, programa e episódio',
      'Reprodução de áudio diretamente na plataforma',
      'Integração com Google Drive e Google Sheets',
      'Experiência PWA instalável no telemóvel',
      'Estrutura preparada para crescimento do arquivo',
    ],
    deliverables: [
      'Interface pública para consulta dos programas',
      'Sistema de arquivo preparado para novos conteúdos',
      'Organização visual adaptada ao contexto escolar',
      'Experiência mobile com comportamento de aplicação',
      'Publicação online com infraestrutura Cloudflare',
    ],
    businessValue: [
      'Arquivo mais fácil de consultar',
      'Maior visibilidade para a rádio escolar',
      'Experiência rápida em mobile',
      'Conteúdos mais organizados e acessíveis',
      'Base preparada para evolução futura',
    ],
    technologies: ['React', 'TypeScript', 'Vite', 'Tailwind CSS', 'Cloudflare', 'PWA'],
    images: [
      {
        src: '/projetos/reo-home.PNG',
        alt: 'Página inicial da REO Rádio Escolar Online',
        caption: 'Página inicial',
      },
      {
        src: '/projetos/reo-arquivo.PNG',
        alt: 'Arquivo digital da REO com programas e episódios',
        caption: 'Arquivo digital',
      },
      {
        src: '/projetos/reo-programas.PNG',
        alt: 'Página de programas da REO Rádio Escolar Online',
        caption: 'Programas da rádio',
      },
      {
        src: '/projetos/reo-instalmenu.PNG',
        alt: 'Menu de instalação da aplicação PWA da REO no telemóvel',
        caption: 'Instalação como PWA',
      },
    ],
  },
]
