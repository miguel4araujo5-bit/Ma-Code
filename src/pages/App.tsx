import { useEffect, useState } from 'react'
import MACode from './MACode'

export default function App() {
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 12)
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className="relative">
      <header className="pointer-events-none fixed inset-x-0 top-0 z-50 px-4 pt-4 sm:px-6">
        <div
          className={`pointer-events-auto mx-auto flex max-w-6xl items-center justify-between rounded-full border px-4 py-3 transition duration-300 sm:px-6 ${
            isScrolled
              ? 'border-cyan-400/20 bg-slate-950/75 shadow-[0_10px_40px_rgba(2,8,23,0.45)] backdrop-blur-xl'
              : 'border-white/10 bg-slate-950/45 backdrop-blur-lg'
          }`}
        >
          <a
            href="#top"
            className="group inline-flex items-center gap-3 text-white transition hover:text-cyan-200"
            aria-label="Ir para o topo"
          >
            <span className="relative inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl border border-cyan-400/20 bg-cyan-400/10 shadow-[0_0_24px_rgba(34,211,238,0.12)]">
              <span className="absolute inset-0 bg-gradient-to-br from-cyan-300/20 via-transparent to-indigo-400/20" />
              <span className="relative text-sm font-semibold tracking-[0.24em]">MA</span>
            </span>

            <span className="hidden sm:block">
              <span className="block text-sm font-semibold tracking-[0.22em] text-white">
                MA-CODE
              </span>
              <span className="block text-[10px] uppercase tracking-[0.28em] text-slate-400">
                Digital Systems
              </span>
            </span>
          </a>

          <nav className="hidden items-center gap-2 md:flex">
            <a
              href="#servicos"
              className="rounded-full px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/[0.05] hover:text-white"
            >
              Serviços
            </a>
            <a
              href="#orcamento"
              className="rounded-full px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/[0.05] hover:text-white"
            >
              Orçamento
            </a>
          </nav>

          <a
            href="#orcamento"
            className="inline-flex items-center justify-center rounded-full border border-cyan-300/35 bg-cyan-400/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-white transition duration-300 hover:-translate-y-0.5 hover:border-cyan-200/60 hover:bg-cyan-300/20 hover:shadow-[0_0_24px_rgba(34,211,238,0.18)] sm:px-5"
          >
            Pedir orçamento
          </a>
        </div>
      </header>

      <main id="top">
        <MACode />
      </main>
    </div>
  )
}
