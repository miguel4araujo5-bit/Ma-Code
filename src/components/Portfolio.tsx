type PortfolioImage = {
  src: string
  alt: string
  caption: string
}

type PortfolioProject = {
  title: string
  subtitle: string
  description: string
  href: string
  category: string
  highlights: string[]
  technologies: string[]
  images: PortfolioImage[]
}

type PortfolioProps = {
  mounted: boolean
}

const portfolioProjects: PortfolioProject[] = [
  {
    title: 'REO – Rádio Escolar Online',
    subtitle: 'Aplicação web/PWA para rádio escolar',
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
    title: 'Rosa Maria Cabeleireiros',
    subtitle: 'Website com sistema de marcações online',
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
    title: 'Porto Exótico',
    subtitle: 'Loja online moderna e responsiva',
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

export default function Portfolio({ mounted }: PortfolioProps) {
  return (
    <section id="projetos" className="px-5 pb-8 sm:px-6 md:px-10 md:pb-14">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 section-label-wrap">
          <span className="section-label">Projetos realizados</span>
        </div>

        <div className="mb-8 max-w-3xl">
          <h2 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">
            Exemplos reais de websites, lojas online, aplicações web e sistemas digitais
            desenvolvidos pela MA-Code
          </h2>
          <p className="mt-3 text-sm leading-7 text-slate-300 md:text-base">
            Projetos criados com foco em imagem profissional, experiência mobile, organização,
            performance e funcionalidades adaptadas às necessidades reais de cada negócio ou
            instituição.
          </p>
        </div>

        <div className="grid gap-6">
          {portfolioProjects.map((project, index) => (
            <article
              key={project.title}
              className={`service-card overflow-hidden ${
                mounted ? 'animate-fade-in-up' : 'opacity-0'
              }`}
              style={{ animationDelay: `${index * 120}ms` }}
            >
              <div className="service-card__line" />

              <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
                <div>
                  <div className="mb-4 flex flex-wrap items-center gap-3">
                    <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-sky-200">
                      {project.category}
                    </span>
                  </div>

                  <h3 className="service-card__title text-2xl md:text-3xl">{project.title}</h3>
                  <p className="mt-2 text-sm font-medium text-sky-100/90 md:text-base">
                    {project.subtitle}
                  </p>

                  <p className="mt-4 text-sm leading-7 text-slate-300 md:text-base">
                    {project.description}
                  </p>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {project.highlights.map((highlight) => (
                      <div
                        key={highlight}
                        className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm leading-6 text-slate-200"
                      >
                        {highlight}
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {project.technologies.map((technology) => (
                      <span
                        key={technology}
                        className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium text-slate-300"
                      >
                        {technology}
                      </span>
                    ))}
                  </div>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <a
                      href={project.href}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-primary hightech-button"
                    >
                      <span className="btn-shine" />
                      <span className="relative z-10">Ver projeto online</span>
                    </a>

                    <a href="#orcamento" className="btn-secondary hightech-button-secondary">
                      Quero algo semelhante
                    </a>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {project.images.map((image) => (
                    <figure
                      key={image.src}
                      className="group relative overflow-hidden rounded-[1.6rem] border border-white/10 bg-gradient-to-br from-sky-500/10 via-slate-950 to-violet-500/10 p-2 shadow-2xl shadow-sky-950/20"
                    >
                      <div className="relative aspect-[4/3] overflow-hidden rounded-[1.2rem] border border-white/10 bg-black/20">
                        <img
                          src={image.src}
                          alt={image.alt}
                          className="h-full w-full object-cover object-top transition duration-500 group-hover:scale-[1.04]"
                          loading="lazy"
                          decoding="async"
                          onError={(event) => {
                            event.currentTarget.style.display = 'none'
                          }}
                        />

                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

                        <div className="absolute bottom-3 left-3 right-3">
                          <figcaption className="rounded-full border border-white/10 bg-black/45 px-3 py-2 text-xs font-medium text-white backdrop-blur-md">
                            {image.caption}
                          </figcaption>
                        </div>
                      </div>
                    </figure>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
