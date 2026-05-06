export type PortfolioImage = {
  src: string
  alt: string
  caption: string
}

export type PortfolioFeatureGroup = {
  title: string
  items: string[]
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
  proofPoints: string[]
  featureGroups: PortfolioFeatureGroup[]
  highlights: string[]
  deliverables: string[]
  businessValue: string[]
  technologies: string[]
  images: PortfolioImage[]
}

export const portfolioProjects: PortfolioProject[] = [
  {
    slug: 'reo',
    title: 'REO – Rádio Escolar Online',
    subtitle: 'Aplicação web/PWA para rádio escolar, arquivo digital e reprodução áudio',
    teaser:
      'PWA para rádio escolar com arquivo digital, reprodução áudio e ligação aos dados já organizados no Google Drive da escola.',
    category: 'Educação • PWA • Arquivo Digital',
    href: 'https://reo.miguelaraujo.workers.dev',
    description:
      'A REO foi desenvolvida para dar à Rádio Escolar Online uma plataforma pública mais moderna, acessível e organizada.\n\nO projeto criou uma ponte entre conteúdos já arquivados no Google Drive/Google Sheets da escola e uma interface web/PWA preparada para consulta pública, permitindo valorizar o arquivo existente sem obrigar a escola a recomeçar do zero.',
    clientNeed:
      'A escola precisava de disponibilizar programas, episódios e conteúdos áudio de forma mais simples e profissional, aproveitando ficheiros e dados que já existiam no Google Drive, mas apresentando tudo numa plataforma pública, clara e fácil de consultar por alunos, professores e comunidade educativa.',
    proofPoints: [
      'Arquivo existente reaproveitado',
      'Ligação a Google Drive/Sheets',
      'Reprodução de áudio',
      'PWA instalável'
    ],
    featureGroups: [
      {
        title: 'Arquivo digital',
        items: [
          'Organização de conteúdos por programas, episódios e estrutura editorial',
          'Consulta pública dos conteúdos da rádio escolar',
          'Acesso mais simples a um arquivo que já existia, mas estava pouco visível',
          'Base preparada para receber novos conteúdos ao longo do tempo'
        ]
      },
      {
        title: 'Ligação aos dados da escola',
        items: [
          'Integração com Google Drive e Google Sheets',
          'Aproveitamento de dados e ficheiros já arquivados pela escola',
          'Redução do trabalho manual na manutenção do arquivo',
          'Ligação entre dados internos e apresentação pública'
        ]
      },
      {
        title: 'Experiência web/PWA',
        items: [
          'Aplicação instalável no telemóvel',
          'Interface adaptada a computador, tablet e smartphone',
          'Navegação simples para alunos, professores e comunidade educativa',
          'Publicação online com infraestrutura leve e rápida'
        ]
      }
    ],
    highlights: [
      'Arquivo digital organizado por ano, programa e episódio',
      'Reprodução de áudio diretamente na plataforma',
      'Integração com Google Drive e Google Sheets',
      'Experiência PWA instalável no telemóvel'
    ],
    deliverables: [
      'Interface pública para consulta dos programas',
      'Ligação técnica aos dados e ficheiros arquivados',
      'Estrutura de arquivo preparada para crescimento',
      'Publicação online com infraestrutura Cloudflare'
    ],
    businessValue: [
      'Arquivo escolar mais acessível e fácil de consultar',
      'Preservação e valorização de conteúdos já existentes',
      'Maior visibilidade para a rádio escolar',
      'Experiência rápida e simples em telemóvel'
    ],
    technologies: [
      'React',
      'TypeScript',
      'Vite',
      'Tailwind CSS',
      'Cloudflare',
      'PWA',
      'Google Drive',
      'Google Sheets'
    ],
    images: [
      {
        src: '/projetos/reo-home.PNG',
        alt: 'Página inicial da REO – Rádio Escolar Online',
        caption: 'Página inicial'
      },
      {
        src: '/projetos/reo-arquivo.PNG',
        alt: 'Arquivo digital da REO com programas e episódios',
        caption: 'Arquivo digital'
      },
      {
        src: '/projetos/reo-programas.PNG',
        alt: 'Página de programas da REO – Rádio Escolar Online',
        caption: 'Programas da rádio'
      },
      {
        src: '/projetos/reo-instalmenu.PNG',
        alt: 'Menu de instalação da aplicação PWA da REO',
        caption: 'Instalação como PWA'
      }
    ]
  },
  {
    slug: 'rosa-maria',
    title: 'Rosa Maria Cabeleireiros',
    subtitle: 'Website com marcações online, painel privado e gestão diária do salão',
    teaser:
      'Website profissional com sistema de marcações, agenda privada, gestão de serviços, cálculo diário e contacto rápido com clientes.',
    category: 'Negócio Local • Marcações • Administração',
    href: 'https://rosa-maria.pt',
    description:
      'Website profissional desenvolvido para modernizar a presença digital do salão Rosa Maria Cabeleireiros, em São Mamede de Infesta.\n\nO projeto combina apresentação dos serviços, marcação online, painel privado de administração, notificações, mapa/localização e uma experiência mobile-first para clientes e gestão interna.',
    clientNeed:
      'O salão precisava de uma presença online mais profissional e de uma forma mais organizada de receber pedidos de marcação, consultar a agenda, gerir horários, calcular os serviços do dia e contactar clientes sem depender apenas de chamadas ou mensagens soltas no telemóvel.',
    proofPoints: [
      'Marcações online',
      'Painel privado',
      'Gestão de agenda',
      'Contacto rápido'
    ],
    featureGroups: [
      {
        title: 'Marcações para clientes',
        items: [
          'Formulário de marcação online simples e adaptado ao funcionamento do salão',
          'Seleção de serviços e horários disponíveis',
          'Campo para observações do cliente',
          'Experiência otimizada para telemóvel'
        ]
      },
      {
        title: 'Painel administrativo',
        items: [
          'Área privada para consultar e gerir marcações',
          'Vista de agenda por dias e horários',
          'Gestão de estados das marcações',
          'Bloqueio de horários quando necessário'
        ]
      },
      {
        title: 'Gestão diária do salão',
        items: [
          'Resumo dos serviços marcados para cada dia',
          'Cálculo dos valores associados aos serviços do dia',
          'Contacto rápido com clientes através do telemóvel/WhatsApp',
          'Notificações para novas marcações'
        ]
      }
    ],
    highlights: [
      'Sistema de marcação online simples e direto',
      'Painel privado para gerir marcações e horários',
      'Resumo diário com serviços e valores',
      'Contacto rápido com clientes e notificações'
    ],
    deliverables: [
      'Website institucional com apresentação dos serviços',
      'Formulário de marcação adaptado ao salão',
      'Agenda administrativa com gestão de disponibilidade',
      'PWA preparada para utilização no telemóvel'
    ],
    businessValue: [
      'Menos gestão manual por chamadas e mensagens',
      'Agenda mais organizada e fácil de consultar',
      'Maior controlo dos serviços e valores do dia',
      'Imagem online mais profissional para o salão'
    ],
    technologies: [
      'React',
      'TypeScript',
      'Tailwind CSS',
      'Cloudflare Workers',
      'PWA',
      'Notificações Push'
    ],
    images: [
      {
        src: '/projetos/rosa-home.PNG',
        alt: 'Página inicial do website Rosa Maria Cabeleireiros',
        caption: 'Página inicial'
      },
      {
        src: '/projetos/rosa-marcacoes.PNG',
        alt: 'Sistema de marcações online Rosa Maria Cabeleireiros',
        caption: 'Marcações online'
      },
      {
        src: '/projetos/rosa-agenda.PNG',
        alt: 'Agenda de marcações do website Rosa Maria Cabeleireiros',
        caption: 'Agenda de marcações'
      },
      {
        src: '/projetos/rosa-adminview.PNG',
        alt: 'Painel privado de administração do website Rosa Maria Cabeleireiros',
        caption: 'Painel administrativo'
      },
      {
        src: '/projetos/rosa-mapas.PNG',
        alt: 'Secção de localização e mapa do website Rosa Maria Cabeleireiros',
        caption: 'Localização e mapa'
      }
    ]
  },
  {
    slug: 'porto-exotico',
    title: 'Porto Exótico',
    subtitle: 'Loja online com e-commerce, consentimento, analytics, IA e backoffice',
    teaser:
      'Loja online com catálogo, carrinho, checkout, consentimento de cookies, analytics, assistente IA e gestão de encomendas.',
    category: 'E-commerce • IA • Analytics • Área Admin',
    href: 'https://portoexotico.pt',
    description:
      'Reconstrução completa de uma presença digital antiga para uma loja online moderna, discreta e preparada para venda direta.\n\nO projeto inclui catálogo de produtos, carrinho, checkout, páginas legais, consentimento de cookies, analytics, assistente de IA treinado para explicar produtos e área administrativa para acompanhamento de encomendas.',
    clientNeed:
      'A marca precisava de uma loja online mais credível, organizada e preparada para vender, com navegação clara, experiência discreta, carrinho de compras, checkout estruturado, cumprimento de consentimento de cookies e ferramentas internas para acompanhar encomendas.',
    proofPoints: [
      'E-commerce completo',
      'Cookies e analytics',
      'Assistente IA',
      'Backoffice de encomendas'
    ],
    featureGroups: [
      {
        title: 'Loja online',
        items: [
          'Catálogo com categorias e páginas de produto',
          'Carrinho de compras e fluxo de checkout',
          'Estrutura preparada para métodos de pagamento',
          'Experiência discreta, responsiva e orientada para venda'
        ]
      },
      {
        title: 'SEO, dados e consentimento',
        items: [
          'Páginas legais e estrutura de confiança',
          'Banner de cookies com gestão de consentimento',
          'Analytics preparado para leitura de comportamento',
          'Base SEO para produtos, categorias e páginas institucionais'
        ]
      },
      {
        title: 'IA e gestão interna',
        items: [
          'Assistente de IA automatizado e treinado para explicar os produtos',
          'Apoio à decisão do cliente durante a navegação',
          'Área administrativa para gestão e acompanhamento de encomendas',
          'Base de dados preparada para evolução da loja'
        ]
      }
    ],
    highlights: [
      'Loja online com categorias e páginas de produto',
      'Carrinho de compras e checkout estruturado',
      'Cookies, analytics e páginas legais',
      'Assistente IA e área administrativa'
    ],
    deliverables: [
      'Interface e-commerce moderna e responsiva',
      'Fluxo de compra com carrinho e checkout',
      'Consentimento de cookies, analytics e páginas legais',
      'Backoffice para acompanhamento de encomendas'
    ],
    businessValue: [
      'Presença digital mais profissional e credível',
      'Processo de compra mais claro para o cliente',
      'Mais confiança através de páginas legais e consentimento',
      'Base preparada para crescimento, dados e automação'
    ],
    technologies: [
      'React',
      'TypeScript',
      'Tailwind CSS',
      'Cloudflare Workers',
      'D1 Database',
      'Analytics',
      'IA'
    ],
    images: [
      {
        src: '/projetos/porto-home.PNG',
        alt: 'Página inicial da loja online Porto Exótico',
        caption: 'Página inicial'
      },
      {
        src: '/projetos/porto-loja.PNG',
        alt: 'Catálogo da loja online Porto Exótico',
        caption: 'Loja online'
      },
      {
        src: '/projetos/porto-carrinhocompras.PNG',
        alt: 'Carrinho de compras da loja online Porto Exótico',
        caption: 'Carrinho de compras'
      },
      {
        src: '/projetos/porto-pagamentos.PNG',
        alt: 'Área de métodos de pagamento da loja online Porto Exótico',
        caption: 'Métodos de pagamento'
      },
      {
        src: '/projetos/porto-admin.PNG',
        alt: 'Área administrativa da loja online Porto Exótico',
        caption: 'Área administrativa'
      },
      {
        src: '/projetos/porto-cookies.PNG',
        alt: 'Banner de consentimento de cookies da loja online Porto Exótico',
        caption: 'Consentimento de cookies'
      },
      {
        src: '/projetos/porto-ia-assistente.PNG',
        alt: 'Assistente de inteligência artificial da loja online Porto Exótico',
        caption: 'Assistente IA'
      }
    ]
  }
]
