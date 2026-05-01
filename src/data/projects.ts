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
  highlights: string[]
  technologies: string[]
  images: PortfolioImage[]
}

export const portfolioProjects: PortfolioProject[] = [
  {
    slug: 'reo',
    title: 'REO – Rádio Escolar Online',
    subtitle: 'Aplicação web/PWA para rádio escolar',
    teaser: 'Arquivo digital e plataforma PWA para uma rádio escolar online.',
    category: 'Educação • PWA • Arquivo Digital',
    href: 'https://reo.miguelaraujo.workers.dev',
    description:
      'Plataforma digital criada para organizar, preservar e tornar acessível o arquivo da rádio escolar do Agrupamento de Escolas de S. Bento de Vizela.\n\nA solução permite consultar programas, ouvir emissões, navegar por conteúdos e aproximar a rádio escolar da comunidade educativa.',
    highlights: [
      'Arquivo digital por ano, programa e episódio',
      'Reprodução de áudio diretamente na plataforma',
      'Integração com Google Drive e Google Sheets',
      'Experiência PWA instalável no telemóvel',
    ],
    technologies: ['React', 'TypeScript', 'Vite', 'Tailwind CSS', 'Cloudflare', 'PWA'],
    images: [
      {
        src: '/projetos/reo-home.png',
        alt: 'Página inicial da REO – Rádio Escolar Online',
        caption: 'Página inicial',
      },
      {
        src: '/projetos/reo-arquivo.png',
        alt: 'Arquivo digital da REO com programas e episódios',
        caption: 'Arquivo digital',
      },
      {
        src: '/projetos/reo-programas.png',
        alt: 'Página de programas da REO – Rádio Escolar Online',
        caption: 'Programas da rádio',
      },
      {
        src: '/projetos/reo-instalmenu.png',
        alt: 'Menu de instalação da aplicação PWA da REO',
        caption: 'Instalação como PWA',
      },
    ],
  },
  {
    slug: 'rosa-maria',
    title: 'Rosa Maria Cabeleireiros',
    subtitle: 'Website com sistema de marcações online',
    teaser: 'Website profissional com marcações online, painel privado e notificações.',
    category: 'Negócio Local • Marcações • Administração',
    href: 'https://rosa-maria.pt',
    description:
      'Website profissional desenvolvido para modernizar a presença digital do salão Rosa Maria Cabeleireiros, em São Mamede de Infesta.\n\nO projeto combina apresentação dos serviços, marcação online, painel privado de administração e otimização para telemóvel.',
    highlights: [
      'Sistema de marcação online simples e direto',
      'Painel privado para gerir marcações e horários',
      'Notificações de novas marcações',
      'SEO local e experiência mobile-first',
    ],
    technologies: ['React', 'TypeScript', 'Tailwind CSS', 'Cloudflare Workers', 'PWA'],
    images: [
      {
        src: '/projetos/rosa-home.png',
        alt: 'Página inicial do website Rosa Maria Cabeleireiros',
        caption: 'Página inicial',
      },
      {
        src: '/projetos/rosa-marcacoes.png',
        alt: 'Sistema de marcações online Rosa Maria Cabeleireiros',
        caption: 'Marcações online',
      },
      {
        src: '/projetos/rosa-agenda.png',
        alt: 'Agenda de marcações do website Rosa Maria Cabeleireiros',
        caption: 'Agenda de marcações',
      },
      {
        src: '/projetos/rosa-adminview.png',
        alt: 'Painel privado de administração do website Rosa Maria Cabeleireiros',
        caption: 'Painel administrativo',
      },
      {
        src: '/projetos/rosa-mapas.png',
        alt: 'Secção de localização e mapas do website Rosa Maria Cabeleireiros',
        caption: 'Localização e mapas',
      },
    ],
  },
  {
    slug: 'porto-exotico',
    title: 'Porto Exótico',
    subtitle: 'Loja online moderna e responsiva',
    teaser: 'Loja online com catálogo, carrinho, checkout e área administrativa.',
    category: 'E-commerce • Checkout • Área Admin',
    href: 'https://portoexotico.pt',
    description:
      'Reconstrução completa de uma presença digital antiga para uma loja online moderna, discreta e preparada para venda direta.\n\nO projeto inclui catálogo de produtos, carrinho, checkout, páginas legais, analytics, consentimento de cookies e área administrativa para gestão de encomendas.',
    highlights: [
      'Loja online com categorias e páginas de produto',
      'Carrinho de compras e checkout estruturado',
      'Área administrativa para gestão de encomendas',
      'SEO, analytics e preparação para pagamentos online',
    ],
    technologies: ['React', 'TypeScript', 'Tailwind CSS', 'Cloudflare Workers', 'D1 Database'],
    images: [
      {
        src: '/projetos/porto-home.png',
        alt: 'Página inicial da loja online Porto Exótico',
        caption: 'Página inicial',
      },
      {
        src: '/projetos/porto-loja.png',
        alt: 'Catálogo da loja online Porto Exótico',
        caption: 'Loja online',
      },
      {
        src: '/projetos/porto-carrinhocompras.png',
        alt: 'Carrinho de compras da loja online Porto Exótico',
        caption: 'Carrinho de compras',
      },
      {
        src: '/projetos/porto-admin.png',
        alt: 'Área administrativa da loja online Porto Exótico',
        caption: 'Área administrativa',
      },
      {
        src: '/projetos/porto-cookies.png',
        alt: 'Banner de consentimento de cookies da loja online Porto Exótico',
        caption: 'Consentimento de cookies',
      },
      {
        src: '/projetos/porto-ia-assistente.png',
        alt: 'Assistente de inteligência artificial da loja online Porto Exótico',
        caption: 'Assistente IA',
      },
    ],
  },
]
