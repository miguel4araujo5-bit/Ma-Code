import {
  useEffect
} from 'react'

function updateMeta(
  name: string,
  content: string
) {
  let meta =
    document.querySelector<HTMLMetaElement>(
      `meta[name="${name}"]`
    )

  if (!meta) {
    meta =
      document.createElement(
        'meta'
      )

    meta.name =
      name

    document.head.appendChild(
      meta
    )
  }

  meta.content =
    content
}

export default function AdminPage() {
  useEffect(() => {
    document.title =
      'Administração | MA-CODE'

    updateMeta(
      'description',
      'Área administrativa reservada da MA-CODE.'
    )

    updateMeta(
      'robots',
      'noindex, nofollow, noarchive, nosnippet, noimageindex'
    )
  }, [])

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
      >
        <div className="absolute left-[-10rem] top-[-10rem] h-96 w-96 rounded-full bg-cyan-400/10 blur-3xl" />

        <div className="absolute bottom-[-12rem] right-[-10rem] h-[28rem] w-[28rem] rounded-full bg-violet-500/10 blur-3xl" />
      </div>

      <section className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-8 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between gap-4 border-b border-white/10 pb-6">
          <a
            href="/"
            className="inline-flex items-center gap-3"
            aria-label="MA-CODE"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-300/10 text-sm font-black text-cyan-200 shadow-lg shadow-cyan-950/30">
              MA
            </div>

            <div>
              <p className="text-sm font-black tracking-[0.18em] text-white">
                MA-CODE
              </p>

              <p className="text-xs font-semibold text-slate-500">
                Administração
              </p>
            </div>
          </a>

          <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1.5 text-[0.68rem] font-black uppercase tracking-[0.16em] text-amber-200">
            Área reservada
          </span>
        </header>

        <div className="flex flex-1 items-center py-12 lg:py-16">
          <div className="grid w-full gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">
                Painel interno
              </p>

              <h1 className="mt-4 max-w-3xl text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
                Administração
                MA-CODE
              </h1>

              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
                Área central para gestão
                dos produtos e serviços
                MA-CODE que necessitem de
                administração privada.
              </p>

              <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.035] p-5 backdrop-blur-sm">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
                    🔒
                  </div>

                  <div>
                    <h2 className="font-black text-white">
                      Acesso administrativo
                    </h2>

                    <p className="mt-1 text-sm leading-6 text-slate-400">
                      Esta rota não está
                      ligada à navegação
                      pública. As operações
                      administrativas serão
                      disponibilizadas apenas
                      depois de existir
                      autenticação protegida
                      no backend.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <section
              aria-labelledby="admin-modules-title"
              className="rounded-[2rem] border border-white/10 bg-slate-900/75 p-5 shadow-2xl shadow-black/30 backdrop-blur sm:p-7"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                    Módulos
                  </p>

                  <h2
                    id="admin-modules-title"
                    className="mt-1 text-2xl font-black text-white"
                  >
                    Gestão MA-CODE
                  </h2>
                </div>

                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-300/20 bg-violet-300/10 text-lg font-black text-violet-200">
                  A
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <article className="rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.06] p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-300/20 bg-emerald-300/10 text-xs font-black text-emerald-200">
                          MP
                        </span>

                        <h3 className="font-black text-white">
                          MA-Professor
                        </h3>
                      </div>

                      <p className="mt-3 text-sm leading-6 text-slate-400">
                        Pedidos de acesso,
                        aprovação, senhas,
                        licenças, pagamentos,
                        renovações e
                        histórico.
                      </p>
                    </div>
                  </div>

                  <div
                    className="mt-4 inline-flex items-center rounded-full border border-white/10 bg-slate-950/60 px-3 py-1.5 text-xs font-bold text-slate-400"
                    aria-disabled="true"
                  >
                    Próximo módulo a ativar
                  </div>
                </article>

                <article className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="font-bold text-slate-300">
                        Outros produtos
                      </h3>

                      <p className="mt-1 text-sm leading-6 text-slate-500">
                        Novos módulos
                        administrativos podem
                        ser acrescentados aqui
                        quando forem
                        necessários.
                      </p>
                    </div>

                    <span className="text-2xl text-slate-700">
                      +
                    </span>
                  </div>
                </article>
              </div>
            </section>
          </div>
        </div>

        <footer className="border-t border-white/10 pt-6 text-center text-xs text-slate-600">
          MA-CODE · Área administrativa
          reservada
        </footer>
      </section>
    </main>
  )
}
