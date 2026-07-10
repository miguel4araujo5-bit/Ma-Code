type PdfHeroProps = {
  mounted: boolean
}

function PdfHeroIcon() {
  return (
    <div
      className="relative mx-auto hidden max-w-[17rem] lg:block"
      aria-hidden="true"
    >
      <div className="absolute inset-x-8 bottom-0 h-12 rounded-full bg-cyan-300/20 blur-2xl" />

      <div className="relative rounded-[2rem] border border-cyan-300/20 bg-slate-950/70 p-5 shadow-2xl shadow-cyan-950/40 backdrop-blur">
        <div className="absolute inset-0 rounded-[2rem] bg-[radial-gradient(circle_at_50%_0%,rgba(103,232,249,0.16),transparent_50%)]" />

        <div className="relative aspect-[4/5] rounded-[1.55rem] border border-cyan-200/35 bg-cyan-300/[0.06] p-5 shadow-inner shadow-cyan-200/10">
          <div className="absolute right-5 top-5 h-12 w-12 rounded-bl-3xl border-b border-l border-cyan-200/30 bg-cyan-200/10" />

          <div className="flex h-full items-end justify-center gap-3 text-center">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.28em] text-cyan-100/70">
              MA
            </span>

            <span className="text-5xl font-black tracking-tight text-cyan-200 drop-shadow-[0_0_18px_rgba(103,232,249,0.35)]">
              PDF
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PdfHero({ mounted }: PdfHeroProps) {
  return (
    <section className="relative z-10 overflow-hidden px-5 pb-10 pt-6 sm:px-6 md:px-10 md:pb-12 md:pt-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex items-center justify-between gap-4 md:mb-12">
          <a
            href="/"
            className="brand-mark"
            aria-label="MA-Code.pt - Página inicial"
          >
            <img
              src="/ma-code.png"
              alt="MA-Code.pt"
              className="shrink-0 object-contain"
              loading="eager"
              decoding="async"
            />

            <span>MA-Code.pt</span>
          </a>

          <div className="hidden items-center gap-3 sm:flex">
            <a
              href="/produtos"
              className="text-sm font-semibold text-slate-300 transition hover:text-white"
            >
              Produtos
            </a>

            <a
              href="/produtos/mapdf"
              className="rounded-2xl border border-cyan-300/15 bg-cyan-300/10 px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-cyan-100"
            >
              MA PDF
            </a>
          </div>
        </header>

        <div className="grid gap-8 lg:grid-cols-[250px_minmax(0,1fr)] lg:items-center">
          <PdfHeroIcon />

          <div className={mounted ? 'animate-fade-in-up' : 'opacity-0'}>
            <div className="hero-topline">
              <span className="hero-topline__dot" />
              <span>Produto MA-Code · MA PDF</span>
            </div>

            <h1 className="mt-6 max-w-5xl text-4xl font-semibold tracking-tight text-white md:text-6xl">
              Ferramentas PDF{' '}
              <span className="bg-gradient-to-r from-cyan-200 via-sky-300 to-violet-200 bg-clip-text text-transparent">
                gratuitas, privadas e rápidas
              </span>
              .
            </h1>

            <p className="mt-5 max-w-3xl text-base leading-8 text-slate-300 md:text-lg">
              Junte, divida, otimize e converta documentos PDF para JPG
              diretamente no navegador. Os seus ficheiros permanecem no seu
              dispositivo e nunca são enviados para os nossos servidores.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <span className="rounded-full border border-cyan-300/15 bg-cyan-300/10 px-4 py-2 text-sm font-semibold text-cyan-100">
                Utilização gratuita
              </span>

              <span className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-200">
                Sem registo
              </span>

              <span className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-200">
                Processamento local
              </span>
            </div>

            <div className="hero-actions">
              <a
                href="#ferramentas"
                className="btn-primary hightech-button"
              >
                <span className="btn-shine" />
                <span className="relative z-10">Escolher ferramenta</span>
              </a>

              <a
                href="#utilizar-ferramenta"
                className="btn-secondary hightech-button-secondary"
              >
                Utilizar agora
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
