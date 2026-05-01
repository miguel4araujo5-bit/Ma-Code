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
      'Plataforma digital criada para organizar, preservar e tornar acessível o arquivo da rádio escolar do Agrupamento de Escolas de S. Bento de Vizela. A solução permite consultar programas, ouvir emissões, navegar por conteúdos e aproximar a rádio escolar da comunidade educativa.',
    highlights: [
      'Arquivo digital por ano, programa e episódio',
      'Reprodução de áudio diretamente na plataforma',
      'Integração com Google Drive e Google Sheets',
      'Experiência PWA instalável no telemóvel'
    ],
    technologies: ['React', 'TypeScript', 'Vite', 'Tailwind CSS', 'Cloudflare', 'PWA'],
    images: [
      {
        src: '/projetos/reo-home.webp',
        alt: 'Página inicial da REO – Rádio Escolar Online',
        caption: 'Página inicial'
      },
      {
        src: '/projetos/reo-arquivo.webp',
        alt: 'Arquivo digital da REO com programas e episódios',
        caption: 'Arquivo digital'
      }
    ]
  },
  {
    slug: 'rosa-maria',
    title: 'Rosa Maria Cabeleireiros',
    subtitle: 'Website com sistema de marcações online',
    teaser: 'Website profissional com marcações online, painel privado e notificações.',
    category: 'Negócio Local • Marcações • Administração',
    href: 'https://rosa-maria.pt',
    description:
      'Website profissional desenvolvido para modernizar a presença digital do salão Rosa Maria Cabeleireiros, em São Mamede de Infesta. O projeto combina apresentação dos serviços, marcação online, painel privado de administração e otimização para telemóvel.',
    highlights: [
      'Sistema de marcação online simples e direto',
      'Painel privado para gerir marcações e horários',
      'Notificações de novas marcações',
      'SEO local e experiência mobile-first'
    ],
    technologies: ['React', 'TypeScript', 'Tailwind CSS', 'Cloudflare Workers', 'PWA'],
    images: [
      {
        src: '/projetos/rosa-home.webp',
        alt: 'Página inicial do website Rosa Maria Cabeleireiros',
        caption: 'Página inicial'
      },
      {
        src: '/projetos/rosa-marcacoes.webp',
        alt: 'Sistema de marcações online Rosa Maria Cabeleireiros',
        caption: 'Marcações online'
      }
    ]
  },
  {
    slug: 'porto-exotico',
    title: 'Porto Exótico',
    subtitle: 'Loja online moderna e responsiva',
    teaser: 'Loja online com catálogo, carrinho, checkout e área administrativa.',
    category: 'E-commerce • Checkout • Área Admin',
    href: 'https://portoexotico.pt',
    description:
      'Reconstrução completa de uma presença digital antiga para uma loja online moderna, discreta e preparada para venda direta. O projeto inclui catálogo de produtos, carrinho, checkout, páginas legais, analytics, consentimento de cookies e área administrativa para gestão de encomendas.',
    highlights: [
      'Loja online com categorias e páginas de produto',
      'Carrinho de compras e checkout estruturado',
      'Área administrativa para gestão de encomendas',
      'SEO, analytics e preparação para pagamentos online'
    ],
    technologies: ['React', 'TypeScript', 'Tailwind CSS', 'Cloudflare Workers', 'D1 Database'],
    images: [
      {
        src: '/projetos/porto-home.webp',
        alt: 'Página inicial da loja online Porto Exótico',
        caption: 'Página inicial'
      },
      {
        src: '/projetos/porto-loja.webp',
        alt: 'Catálogo da loja online Porto Exótico',
        caption: 'Loja online'
      }
    ]
  }
]
