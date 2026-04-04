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
      const response = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({
          access_key: '18547eb2-4deb-4420-b33d-64813f8918e5',
          subject: 'Pedido de orçamento - MA-Code',
          from_name: 'MA-Code Website',
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
        <div className="orb left-[-8rem] top-[-6rem] h-72 w-72 bg-cyan-400/12" />
        <div className="orb right-[-6rem] top-20 h-80 w-80 bg-indigo-500/14 [animation-delay:1.2s]" />
        <div className="orb bottom-[-8rem] left-1/2 h-96 w-96 -translate-x-1/2 bg-sky-500/10 [animation-delay:2.1s]" />
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
        <section className="mx-auto max-w-5xl text-center">
          <div className="section-badge">Websites • Aplicações Web • Automação Digital</div>

          <h1 className="text-glow mt-8 text-5xl font-semibold tracking-[-0.05em] text-white sm:text-6xl md:text-7xl">
            Criamos websites e plataformas que ajudam o seu negócio a vender mais.
          </h1>

          <p className="mx-auto mt-8 max-w-3xl text-base leading-8 text-slate-300 sm:text-lg">
            Desenvolvemos soluções digitais modernas, rápidas e pensadas para gerar confiança,
            captar clientes e elevar a presença online da sua marca.
            <span className="font-semibold text-cyan-200"> A partir de 19€/mês.</span>
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href="#orcamento"
              className="btn-primary inline-flex min-w-[220px] items-center justify-center"
            >
              Pedir orçamento
            </a>

            <a
              href="#servicos"
              className="inline-flex min-w-[220px] items-center justify-center rounded-full border border-white/15 bg-white/[0.03] px-6 py-4 text-sm font-medium uppercase tracking-[0.18em] text-white transition duration-300 hover:-translate-y-0.5 hover:border-cyan-300/40 hover:bg-white/[0.06]"
            >
              Ver serviços
            </a>
          </div>

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
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2">
              Foco em conversão
            </span>
          </div>
        </section>

        <section className="mt-16 grid gap-4 sm:grid-cols-3">
          <div className="glass-panel panel-highlight p-6 text-center">
            <p className="text-3xl font-semibold tracking-[-0.04em] text-white">Rápido</p>
            <p className="mt-2 text-sm leading-7 text-slate-300">
              Soluções leves, modernas e preparadas para uma experiência fluida.
            </p>
          </div>

          <div className="glass-panel panel-highlight p-6 text-center">
            <p className="text-3xl font-semibold tracking-[-0.04em] text-white">Credível</p>
            <p className="mt-2 text-sm leading-7 text-slate-300">
              Uma imagem digital mais profissional para transmitir confiança ao cliente.
            </p>
          </div>

          <div className="glass-panel panel-highlight p-6 text-center">
            <p className="text-3xl font-semibold tracking-[-0.04em] text-white">Escalável</p>
            <p className="mt-2 text-sm leading-7 text-slate-300">
              Estrutura preparada para crescer com o seu negócio e com os seus objetivos.
            </p>
          </div>
        </section>

        <section id="servicos" className="mt-24">
          <div className="mx-auto max-w-3xl text-center">
            <div className="section-badge">Serviços</div>
            <h2 className="text-glow mt-6 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
              Soluções pensadas para gerar resultado
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
              Não criamos apenas páginas bonitas. Desenvolvemos presença digital com estratégia,
              clareza e foco no crescimento do negócio.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <div className="tech-card">
              <div className="mb-5 h-12 w-12 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 shadow-[0_0_24px_rgba(34,211,238,0.12)]" />
              <h3 className="text-xl font-semibold tracking-[-0.02em] text-white">
                Websites para gerar contactos
              </h3>
              <p className="mt-4 text-sm leading-7 text-slate-300">
                Websites profissionais pensados para apresentar a sua marca com clareza,
                transmitir confiança e transformar visitas em oportunidades reais.
              </p>
            </div>

            <div className="tech-card">
              <div className="mb-5 h-12 w-12 rounded-2xl border border-indigo-400/20 bg-indigo-400/10 shadow-[0_0_24px_rgba(99,102,241,0.12)]" />
              <h3 className="text-xl font-semibold tracking-[-0.02em] text-white">
                Sistemas de marcação online
              </h3>
              <p className="mt-4 text-sm leading-7 text-slate-300">
                Ideal para clínicas, salões e serviços que precisam de simplificar reservas,
                reduzir fricção e melhorar a experiência do cliente.
              </p>
            </div>

            <div className="tech-card">
              <div className="mb-5 h-12 w-12 rounded-2xl border border-sky-400/20 bg-sky-400/10 shadow-[0_0_24px_rgba(14,165,233,0.12)]" />
              <h3 className="text-xl font-semibold tracking-[-0.02em] text-white">
                Aplicações web e automação
              </h3>
              <p className="mt-4 text-sm leading-7 text-slate-300">
                Plataformas personalizadas para organizar processos, automatizar tarefas e criar
                soluções ajustadas à operação do seu negócio.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-24">
          <div className="glass-panel panel-highlight p-8 sm:p-10 md:p-12">
            <div className="grid gap-10 md:grid-cols-2 md:items-center">
              <div>
                <div className="section-badge">Porque escolher a MA-Code</div>
                <h2 className="text-glow mt-6 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
                  Tecnologia com boa aparência e objetivo comercial
                </h2>
                <p className="mt-4 text-sm leading-7 text-slate-300 sm:text-base">
                  O objetivo não é apenas “ter um site”. O objetivo é ter uma presença digital que
                  represente bem a marca, carregue rápido, funcione em qualquer dispositivo e ajude
                  o negócio a crescer.
                </p>
              </div>

              <div className="grid gap-4">
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200">
                    Mais confiança
                  </p>
                  <p className="mt-2 text-sm leading-7 text-slate-300">
                    Um site profissional melhora a perceção da marca e aumenta a credibilidade.
                  </p>
                </div>

                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200">
                    Mais clareza
                  </p>
                  <p className="mt-2 text-sm leading-7 text-slate-300">
                    Estrutura organizada para que o visitante perceba rapidamente o que oferece.
                  </p>
                </div>

                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200">
                    Mais conversão
                  </p>
                  <p className="mt-2 text-sm leading-7 text-slate-300">
                    Chamadas para ação mais fortes e uma experiência mais preparada para vender.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-24">
          <div className="mx-auto max-w-3xl text-center">
            <div className="section-badge">Como funciona</div>
            <h2 className="text-glow mt-6 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
              Um processo simples e direto
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-300 sm:text-base">
              Sem complicação desnecessária. O foco é perceber o objetivo, desenvolver a solução e
              entregar algo pronto a usar.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <div className="tech-card">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-200">
                01
              </p>
              <h3 className="mt-4 text-xl font-semibold tracking-[-0.02em] text-white">
                Diz-nos o que precisa
              </h3>
              <p className="mt-4 text-sm leading-7 text-slate-300">
                Partilhe a ideia, o objetivo do projeto e o tipo de solução que pretende.
              </p>
            </div>

            <div className="tech-card">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-200">
                02
              </p>
              <h3 className="mt-4 text-xl font-semibold tracking-[-0.02em] text-white">
                Criamos a estrutura
              </h3>
              <p className="mt-4 text-sm leading-7 text-slate-300">
                Desenvolvemos um design moderno e uma base técnica sólida para o projeto.
              </p>
            </div>

            <div className="tech-card">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-200">
                03
              </p>
              <h3 className="mt-4 text-xl font-semibold tracking-[-0.02em] text-white">
                Entregamos pronto a usar
              </h3>
              <p className="mt-4 text-sm leading-7 text-slate-300">
                Recebe uma solução funcional, profissional e preparada para o seu negócio avançar.
              </p>
            </div>
          </div>
        </section>

        <section id="orcamento" className="mt-24">
          <div className="glass-panel panel-highlight mx-auto max-w-4xl p-8 sm:p-10 md:p-12">
            <div className="mb-10">
              <div className="section-badge">Pedido de orçamento</div>
              <h2 className="text-glow mt-6 text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl">
                Vamos falar sobre o seu projeto
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                Diga-nos o que pretende criar e entraremos em contacto com uma proposta ajustada ao
                seu objetivo, ao seu negócio e ao nível de personalização que precisa.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
              <div>
                <label className="input-label">Nome</label>

                <input
                  className="input-field"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="input-label">Email</label>

                <input
                  type="email"
                  className="input-field"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="input-label">Descreva o projeto</label>

                <textarea
                  className="input-field h-36 resize-none"
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  required
                />
              </div>

              {successMessage ? (
                <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-4 text-sm text-emerald-200 backdrop-blur-xl">
                  {successMessage}
                </div>
              ) : null}

              {errorMessage ? (
                <div className="rounded-2xl border border-red-400/30 bg-red-400/10 px-4 py-4 text-sm text-red-200 backdrop-blur-xl">
                  {errorMessage}
                </div>
              ) : null}

              <button type="submit" className="btn-primary w-full" disabled={isSending}>
                {isSending ? 'A enviar...' : 'Pedir orçamento'}
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  )
}
