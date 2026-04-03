import { useState } from 'react'

export default function MACode() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    message: ''
  })
  const [isSending, setIsSending] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSending(true)
    setSuccessMessage('')
    setErrorMessage('')

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          message: form.message
        })
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Erro ao enviar pedido')
      }

      setSuccessMessage('Pedido enviado com sucesso. Entraremos em contacto em breve.')
      setForm({
        name: '',
        email: '',
        message: ''
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Não foi possível enviar o pedido. Tente novamente.'
      setErrorMessage(message)
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-brand-paper px-6 pb-24 pt-24 text-white">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-8rem] top-[-6rem] h-72 w-72 rounded-full bg-cyan-400/12 blur-3xl" />
        <div className="absolute right-[-6rem] top-20 h-80 w-80 rounded-full bg-indigo-500/14 blur-3xl" />
        <div className="absolute bottom-[-8rem] left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-sky-500/10 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)',
            backgroundSize: '40px 40px'
          }}
        />
      </div>

      <div className="relative mx-auto max-w-6xl">
        <section className="mx-auto max-w-4xl text-center">
          <div className="section-badge">
            Websites • Automação • Sistemas Digitais
          </div>

          <h1 className="mt-8 text-5xl font-semibold tracking-[-0.04em] text-white sm:text-6xl md:text-7xl">
            Construímos presença digital com estética, velocidade e resultado.
          </h1>

          <p className="mx-auto mt-8 max-w-3xl text-base leading-8 text-slate-300 sm:text-lg">
            Desenvolvemos websites e aplicações modernas para marcas e negócios que precisam de
            uma presença tecnológica credível, rápida e preparada para crescer.
            <span className="font-semibold text-cyan-200"> A partir de 19€/mês.</span>
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4 text-xs uppercase tracking-[0.24em] text-slate-400">
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2">
              Design premium
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2">
              Performance first
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2">
              Mobile optimized
            </span>
          </div>
        </section>

        <section className="mt-20 grid gap-6 md:grid-cols-3">
          <div className="tech-card">
            <div className="mb-5 h-12 w-12 rounded-2xl border border-cyan-400/20 bg-cyan-400/10" />
            <h3 className="text-xl font-semibold tracking-[-0.02em] text-white">
              Websites Profissionais
            </h3>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              Websites modernos, rápidos e pensados para converter melhor, transmitir confiança e
              elevar a imagem digital da marca.
            </p>
          </div>

          <div className="tech-card">
            <div className="mb-5 h-12 w-12 rounded-2xl border border-indigo-400/20 bg-indigo-400/10" />
            <h3 className="text-xl font-semibold tracking-[-0.02em] text-white">
              Sistemas de Marcação
            </h3>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              Fluxos de reserva online para salões, clínicas e serviços com uma experiência simples,
              profissional e preparada para o utilizador final.
            </p>
          </div>

          <div className="tech-card">
            <div className="mb-5 h-12 w-12 rounded-2xl border border-sky-400/20 bg-sky-400/10" />
            <h3 className="text-xl font-semibold tracking-[-0.02em] text-white">
              Aplicações Web
            </h3>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              Plataformas personalizadas para automatizar processos, organizar operações e criar
              soluções digitais alinhadas com o teu negócio.
            </p>
          </div>
        </section>

        <section className="mt-20">
          <div className="glass-panel mx-auto max-w-4xl p-8 sm:p-10 md:p-12">
            <div className="mb-10">
              <div className="section-badge">Pedido de orçamento</div>
              <h2 className="mt-6 text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl">
                Vamos falar sobre o teu projeto
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                Diz-nos o que pretendes criar e entramos em contacto com uma proposta ajustada ao
                teu objetivo, ao teu negócio e ao nível de personalização que precisas.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
              <div>
                <label className="input-label">
                  Nome
                </label>

                <input
                  className="input-field"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="input-label">
                  Email
                </label>

                <input
                  type="email"
                  className="input-field"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="input-label">
                  Descreve o projeto
                </label>

                <textarea
                  className="input-field h-36 resize-none"
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  required
                />
              </div>

              {successMessage ? (
                <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-4 text-sm text-emerald-200">
                  {successMessage}
                </div>
              ) : null}

              {errorMessage ? (
                <div className="rounded-2xl border border-red-400/30 bg-red-400/10 px-4 py-4 text-sm text-red-200">
                  {errorMessage}
                </div>
              ) : null}

              <button
                type="submit"
                className="btn-primary w-full"
                disabled={isSending}
              >
                {isSending ? 'A enviar...' : 'Pedir orçamento'}
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  )
}
