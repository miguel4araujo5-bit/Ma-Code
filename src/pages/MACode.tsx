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
    <div className="relative min-h-screen overflow-hidden bg-brand-paper px-6 pb-24 pt-16 text-white sm:px-8 sm:pt-20">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="orb left-[-8rem] top-[-6rem] h-72 w-72 bg-cyan-400/15" />
        <div className="orb right-[-7rem] top-24 h-80 w-80 bg-indigo-500/16 [animation-delay:1.2s]" />
        <div className="orb bottom-[-8rem] left-1/2 h-96 w-96 -translate-x-1/2 bg-sky-500/10 [animation-delay:2s]" />
        <div className="orb left-[10%] top-[40%] h-40 w-40 bg-cyan-300/10 [animation-delay:0.8s]" />
        <div className="orb right-[12%] bottom-[18%] h-48 w-48 bg-fuchsia-400/10 [animation-delay:1.7s]" />
        <div className="scanline" />
        <div className="cyber-ring absolute left-1/2 top-[10%] h-[28rem] w-[28rem] -translate-x-1/2 opacity-40" />
      </div>

      <div className="relative mx-auto max-w-6xl">
        <section className="mx-auto max-w-5xl text-center">
          <div className="hero-logo-shell mx-auto w-fit">
            <img
              src="/logo.svg"
              alt="MA-Code"
              className="hero-logo-svg mx-auto h-auto w-[220px] sm:w-[270px] md:w-[320px]"
            />
          </div>

          <div className="section-badge mt-8">
            Websites • Web Apps • IA • Blockchain • Automação
          </div>

          <h1 className="text-glow mt-8 text-5xl font-semibold tracking-[-0.05em] text-white sm:text-6xl md:text-7xl">
            Construímos produtos digitais com aparência high-tech e utilidade real.
          </h1>

          <p className="mx-auto mt-8 max-w-3xl text-base leading-8 text-slate-300 sm:text-lg">
            Criamos websites, plataformas e integrações avançadas para negócios e projetos que
            precisam de presença digital forte, performance séria e funcionalidades modernas.
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
              className="btn-secondary inline-flex min-w-[220px] items-center justify-center"
            >
              Ver serviços
            </a>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4 text-xs uppercase tracking-[0.24em] text-slate-400">
            <span className="tech-pill">Design premium</span>
            <span className="tech-pill">Integrações avançadas</span>
            <span className="tech-pill">Automação real</span>
            <span className="tech-pill">Escalável</span>
          </div>
        </section>

        <section className="mt-16 grid gap-4 sm:grid-cols-3">
          <div className="glass-panel panel-highlight p-6 text-center">
            <p className="text-3xl font-semibold tracking-[-0.04em] text-white">Impacto</p>
            <p className="mt-2 text-sm leading-7 text-slate-300">
              Visual premium para elevar a imagem da marca e criar uma primeira impressão forte.
            </p>
          </div>

          <div className="glass-panel panel-highlight p-6 text-center">
            <p className="text-3xl font-semibold tracking-[-0.04em] text-white">Tecnologia</p>
            <p className="mt-2 text-sm leading-7 text-slate-300">
              Soluções modernas com integrações úteis, automação e estrutura preparada para crescer.
            </p>
          </div>

          <div className="glass-panel panel-highlight p-6 text-center">
            <p className="text-3xl font-semibold tracking-[-0.04em] text-white">Manutenção</p>
            <p className="mt-2 text-sm leading-7 text-slate-300">
              Gestão contínua da plataforma para manter tudo atualizado, estável e profissional.
            </p>
          </div>
        </section>

        <section id="servicos" className="mt-24">
          <div className="mx-auto max-w-3xl text-center">
            <div className="section-badge">Serviços</div>
            <h2 className="text-glow mt-6 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
              Muito mais do que criação de sites
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
              A MA-Code desenvolve, integra e mantém soluções digitais com foco em performance,
              experiência e funcionalidade prática.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <div className="tech-card">
              <div className="icon-glow mb-5 h-12 w-12 rounded-2xl border border-cyan-400/20 bg-cyan-400/10" />
              <h3 className="text-xl font-semibold tracking-[-0.02em] text-white">
                Websites e web apps
              </h3>
              <p className="mt-4 text-sm leading-7 text-slate-300">
                Websites profissionais, landing pages e aplicações web modernas feitas para captar
                clientes, apresentar serviços e suportar operações digitais.
              </p>
            </div>

            <div className="tech-card">
              <div className="icon-glow-indigo mb-5 h-12 w-12 rounded-2xl border border-indigo-400/20 bg-indigo-400/10" />
              <h3 className="text-xl font-semibold tracking-[-0.02em] text-white">
                Gestão, manutenção e evolução
              </h3>
              <p className="mt-4 text-sm leading-7 text-slate-300">
                Atualizações, manutenção técnica, melhoria contínua, gestão de conteúdo e suporte
                para manter a plataforma viva, segura e preparada para crescer.
              </p>
            </div>

            <div className="tech-card">
              <div className="icon-glow-sky mb-5 h-12 w-12 rounded-2xl border border-sky-400/20 bg-sky-400/10" />
              <h3 className="text-xl font-semibold tracking-[-0.02em] text-white">
                IA, automação e integrações
              </h3>
              <p className="mt-4 text-sm leading-7 text-slate-300">
                Integração de IA, automação de fluxos, chatbots, processos internos e ligação entre
                ferramentas para reduzir trabalho manual e ganhar eficiência.
              </p>
            </div>

            <div className="tech-card">
              <div className="icon-glow mb-5 h-12 w-12 rounded-2xl border border-emerald-400/20 bg-emerald-400/10" />
              <h3 className="text-xl font-semibold tracking-[-0.02em] text-white">
                E-commerce e carrinho de compras
              </h3>
              <p className="mt-4 text-sm leading-7 text-slate-300">
                Lojas online, checkout, carrinho de compras, gestão de catálogo, pagamentos e
                experiências orientadas à conversão.
              </p>
            </div>

            <div className="tech-card">
              <div className="icon-glow-indigo mb-5 h-12 w-12 rounded-2xl border border-violet-400/20 bg-violet-400/10" />
              <h3 className="text-xl font-semibold tracking-[-0.02em] text-white">
                Marcações, bases de dados e CRM
              </h3>
              <p className="mt-4 text-sm leading-7 text-slate-300">
                Sistemas de agendamento, gestão de clientes, bases de dados, dashboards e
                ferramentas operacionais adaptadas ao negócio.
              </p>
            </div>

            <div className="tech-card">
              <div className="icon-glow-sky mb-5 h-12 w-12 rounded-2xl border border-fuchsia-400/20 bg-fuchsia-400/10" />
              <h3 className="text-xl font-semibold tracking-[-0.02em] text-white">
                Blockchain, tokens e NFTs
              </h3>
              <p className="mt-4 text-sm leading-7 text-slate-300">
                Integrações blockchain EVM e outras, criação de tokens simples ou com lógica
                específica, NFTs e componentes on-chain para projetos digitais mais avançados.
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
                  Desenvolvimento moderno com visão técnica mais ampla
                </h2>
                <p className="mt-4 text-sm leading-7 text-slate-300 sm:text-base">
                  A diferença está em não ficar limitado ao visual. O projeto pode começar num site,
                  mas evoluir para automações, integrações, dados, e-commerce ou blockchain sem
                  precisar de mudar de parceiro técnico.
                </p>
              </div>

              <div className="grid gap-4">
                <div className="mini-panel">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200">
                    Mais alcance
                  </p>
                  <p className="mt-2 text-sm leading-7 text-slate-300">
                    Uma solução pensada para comunicar melhor, vender melhor e suportar mais
                    funcionalidades no futuro.
                  </p>
                </div>

                <div className="mini-panel">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200">
                    Mais controlo
                  </p>
                  <p className="mt-2 text-sm leading-7 text-slate-300">
                    Gestão técnica, manutenção e evolução contínua para não depender de soluções
                    limitadas ou fechadas.
                  </p>
                </div>

                <div className="mini-panel">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200">
                    Mais inovação
                  </p>
                  <p className="mt-2 text-sm leading-7 text-slate-300">
                    IA, automação, blockchain e integrações úteis quando o projeto precisa de ir
                    além do básico.
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
              O foco é perceber a necessidade, construir a solução certa e garantir que a plataforma
              continua útil depois da entrega.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <div className="tech-card">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-200">01</p>
              <h3 className="mt-4 text-xl font-semibold tracking-[-0.02em] text-white">
                Analisamos o projeto
              </h3>
              <p className="mt-4 text-sm leading-7 text-slate-300">
                Definimos o objetivo, as funcionalidades e o tipo de tecnologia mais adequado.
              </p>
            </div>

            <div className="tech-card">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-200">02</p>
              <h3 className="mt-4 text-xl font-semibold tracking-[-0.02em] text-white">
                Construímos a solução
              </h3>
              <p className="mt-4 text-sm leading-7 text-slate-300">
                Desenvolvemos uma plataforma visualmente forte, rápida e preparada para uso real.
              </p>
            </div>

            <div className="tech-card">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-200">03</p>
              <h3 className="mt-4 text-xl font-semibold tracking-[-0.02em] text-white">
                Mantemos e evoluímos
              </h3>
              <p className="mt-4 text-sm leading-7 text-slate-300">
                Se necessário, continuamos a gerir, otimizar e expandir o projeto depois do
                lançamento.
              </p>
            </div>
          </div>
        </section>

        <section id="orcamento" className="mt-24">
          <div className="glass-panel panel-highlight mx-auto max-w-4xl p-8 sm:p-10 md:p-12">
            <div className="mb-10 text-center sm:text-left">
              <div className="section-badge">Pedido de orçamento</div>
              <h2 className="text-glow mt-6 text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl">
                Vamos falar sobre o seu projeto
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                Seja um site, uma plataforma, uma loja online, uma integração de IA, um sistema de
                marcações ou um projeto blockchain, podemos desenhar uma solução ajustada ao seu
                objetivo.
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
