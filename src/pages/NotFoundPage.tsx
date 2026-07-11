import { useEffect } from 'react'

function updateRobotsMeta(content: string) {
  let meta =
    document.querySelector<HTMLMetaElement>(
      'meta[name="robots"]'
    )

  if (!meta) {
    meta =
      document.createElement(
        'meta'
      )

    meta.name = 'robots'
    document.head.appendChild(
      meta
    )
  }

  meta.content = content
}

function removeCanonical() {
  const canonical =
    document.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]'
    )

  canonical?.remove()
}

export default function NotFoundPage() {
  useEffect(() => {
    document.title =
      'Página não encontrada | MA-Code'

    updateRobotsMeta(
      'noindex, nofollow'
    )

    removeCanonical()
  }, [])

  return (
    <main className="relative flex min-h-screen items-center overflow-hidden px-5 py-12 sm:px-6 md:px-10">
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        aria-hidden="true"
      >
        <div className="absolute left-1/2 top-0 h-96 w-96 -translate-x-1/2 rounded-full bg-cyan-400/10 blur-3xl" />

        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-blue-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto w-full max-w-4xl">
        <header className="mb-10 flex items-center justify-between gap-4">
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

          <a
            href="/contacto"
            className="btn-ghost hidden text-sm sm:inline-flex sm:text-base"
          >
            Contacto
          </a>
        </header>

        <section className="overflow-hidden rounded-[2rem] border border-cyan-300/15 bg-slate-950/70 p-6 shadow-2xl shadow-cyan-950/20 backdrop-blur md:p-10 lg:p-14">
          <div className="grid gap-10 lg:grid-cols-[0.65fr_1.35fr] lg:items-center">
            <div>
              <span className="block text-7xl font-black tracking-tight text-cyan-200 md:text-8xl">
                404
              </span>

              <span className="mt-3 block text-xs font-bold uppercase tracking-[0.22em] text-cyan-200/65">
                Página não encontrada
              </span>
            </div>

            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-white md:text-5xl">
                Este endereço não existe.
              </h1>

              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300 md:text-lg">
                A página pode ter sido removida, alterada ou o endereço pode
                estar incompleto. Pode regressar à página inicial, consultar os
                produtos ou falar connosco sobre o que procura.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <a
                  href="/"
                  className="btn-primary hightech-button"
                >
                  <span className="btn-shine" />

                  <span className="relative z-10">
                    Voltar à página inicial
                  </span>
                </a>

                <a
                  href="/produtos"
                  className="btn-ghost"
                >
                  Ver produtos
                </a>

                <a
                  href="/contacto"
                  className="btn-ghost"
                >
                  Pedir proposta
                </a>
              </div>
            </div>
          </div>
        </section>

        <p className="mt-6 text-center text-xs leading-6 text-slate-500">
          MA-Code · Websites, aplicações, automação, inteligência artificial e
          produtos digitais.
        </p>
      </div>
    </main>
  )
}
