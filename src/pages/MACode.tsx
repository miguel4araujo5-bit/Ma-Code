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
    <main className="relative min-h-screen overflow-hidden bg-brand-paper px-6 pb-24 pt-16 text-white sm:px-8 sm:pt-20">
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
        <section className="mx-auto max-w-5xl text-center" aria-labelledby="hero-title">
          <div className="hero-logo-shell mx-auto w-fit">
            <img
              src="/logo.svg"
              alt="Logótipo da MA-Code"
              className="hero-logo-svg mx-auto h-auto w-[220px] sm:w-[270px] md:w-[320px]"
            />
          </div>

          <div className="section-badge mt-8">
            Websites • Lojas Online • IA • Automação • Blockchain
          </div>

          <h1
            id="hero-title"
            className="text-glow mt-8 text-5xl font-semibold tracking-[-0.05em] text-white sm:text-6xl md:text-7xl"
          >
            Criação de websites, lojas online e soluções digitais em Portugal
          </h1>

          <p className="mx-auto mt-8 max-w-3xl text-base leading-8 text-slate-300 sm:text-lg">
            Na MA-Code desenvolvemos websites profissionais, lojas online, aplicações web,
            integrações de IA, automações, sistemas de marcações, CRM, bases de dados e soluções
            blockchain para empresas, negócios locais e projetos digitais.
          </p>

          <div className="mx-auto mt-8 w-fit">
            <div className="price-pill">
              <span className="price-pill-label">Planos desde</span>
              <span className="price-pill-value">19€/mês</span>
            </div>
          </div>

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
            <span className="tech-pill">Websites profissionais</span>
            <span className="tech-pill">Lojas online</span>
            <span className="tech-pill">Integrações avançadas</span>
            <span className="tech-pill">Automação real</span>
            <span className="tech-pill">Escalável</span>
          </div>
        </section>

        <section className="mt-16 grid gap-4 sm:grid-cols-3" aria-label="Vantagens principais">
          <div className="glass-panel panel-highlight p-6 text-center">
            <h2 className="text-3xl font-semibold tracking-[-0.04em] text-white">Impacto</h2>
            <p className="mt-2 text-sm leading-7 text-slate-300">
              Visual premium para elevar a imagem da marca, melhorar a confiança e criar uma
              primeira impressão forte.
            </p>
          </div>

          <div className="glass-panel panel-highlight p-6 text-center">
            <h2 className="text-3xl font-semibold tracking-[-0.04em] text-white">Tecnologia</h2>
            <p className="mt-2 text-sm leading-7 text-slate-300">
              Soluções modernas com funcionalidades úteis, automação e estrutura preparada para
              crescer com o negócio.
            </p>
          </div>

          <div className="glass-panel panel-highlight p-6 text-center">
            <h2 className="text-3xl font-semibold tracking-[-0.04em] text-white">Manutenção</h2>
            <p className="mt-2 text-sm leading-7 text-slate-300">
              Gestão contínua da plataforma para manter tudo atualizado, estável, rápido e
              profissional.
            </p>
          </div>
        </section>

        <section id="servicos" className="mt-24" aria-labelledby="servicos-title">
          <div className="mx-auto max-w-3xl text-center">
            <div className="section-badge">Serviços</div>
            <h2
              id="servicos-title"
              className="text-glow mt-6 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl"
            >
              Serviços de desenvolvimento web e soluções digitais
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
              A MA-Code cria, integra e mantém soluções digitais com foco em performance,
              experiência do utilizador, conversão e funcionalidade prática.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <article className="tech-card">
              <div className="icon-glow mb-5 h-12 w-12 rounded-2xl border border-cyan-400/20 bg-cyan-400/10" />
              <h3 className="text-xl font-semibold tracking-[-0.02em] text-white">
                Criação de websites e web apps
              </h3>
              <p className="mt-4 text-sm leading-7 text-slate-300">
                Websites profissionais, landing pages e aplicações web modernas para captar
                clientes, apresentar serviços e suportar operações digitais.
              </p>
            </article>

            <article className="tech-card">
              <div className="icon-glow-indigo mb-5 h-12 w-12 rounded-2xl border border-indigo-400/20 bg-indigo-400/10" />
              <h3 className="text-xl font-semibold tracking-[-0.02em] text-white">
                Gestão, manutenção e evolução
              </h3>
              <p className="mt-4 text-sm leading-7 text-slate-300">
                Atualizações, manutenção técnica, melhoria contínua, gestão de conteúdo e suporte
                para manter a plataforma segura e preparada para crescer.
              </p>
            </article>

            <article className="tech-card">
              <div className="icon-glow-sky mb-5 h-12 w-12 rounded-2xl border border-sky-400/20 bg-sky-400/10" />
              <h3 className="text-xl font-semibold tracking-[-0.02em] text-white">
                IA, automação e integrações
              </h3>
              <p className="mt-4 text-sm leading-7 text-slate-300">
                Integração de IA, automação de fluxos, chatbots, processos internos e ligação entre
                ferramentas para reduzir trabalho manual e ganhar eficiência.
              </p>
            </article>

            <article className="tech-card">
              <div className="icon-glow mb-5 h-12 w-12 rounded-2xl border border-emerald-400/20 bg-emerald-400/10" />
              <h3 className="text-xl font-semibold tracking-[-0.02em] text-white">
                Lojas online e carrinho de compras
              </h3>
              <p className="mt-4 text-sm leading-7 text-slate-300">
                Desenvolvimento de e-commerce com catálogo, checkout, carrinho de compras,
                pagamentos e experiência orientada à conversão.
              </p>
            </article>

            <article className="tech-card">
              <div className="icon-glow-indigo mb-5 h-12 w-12 rounded-2xl border border-violet-400/20 bg-violet-400/10" />
              <h3 className="text-xl font-semibold tracking-[-0.02em] text-white">
                Marcações, bases de dados e CRM
              </h3>
              <p className="mt-4 text-sm leading-7 text-slate-300">
                Sistemas de agendamento, gestão de clientes, bases de dados, dashboards e
                ferramentas operacionais adaptadas ao negócio.
              </p>
            </article>

            <article className="tech-card">
              <div className="icon-glow-sky mb-5 h-12 w-12 rounded-2xl border border-fuchsia-400/20 bg-fuchsia-400/10" />
              <h3 className="text-xl font-semibold tracking-[-0.02em] text-white">
                Blockchain, tokens e NFTs
              </h3>
              <p className="mt-4 text-sm leading-7 text-slate-300">
                Integrações blockchain EVM e outras, criação de tokens simples ou com lógica
                específica, NFTs e componentes on-chain para projetos digitais mais avançados.
              </p>
            </article>
          </div>
        </section>

        <section className="mt-24" aria-labelledby="porque-escolher-title">
          <div className="glass-panel panel-highlight p-8 sm:p-10 md:p-12">
            <div className="grid gap-10 md:grid-cols-2 md:items-center">
              <div>
                <div className="section-badge">Porque escolher a MA-Code</div>
                <h2
                  id="porque-escolher-title"
                  className="text-glow mt-6 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl"
                >
                  Desenvolvimento moderno com visão técnica mais ampla
                </h2>
                <p className="mt-4 text-sm leading-7 text-slate-300 sm:text-base">
                  O projeto pode começar num website, mas evoluir para automações, integrações,
                  dados, e-commerce ou blockchain sem precisar de mudar de parceiro técnico.
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
                    limitadas.
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

        <section className="mt-24" aria-labelledby="processo-title">
          <div className="mx-auto max-w-3xl text-center">
            <div className="section-badge">Como funciona</div>
            <h2
              id="processo-title"
              className="text-glow mt-6 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl"
            >
              Um processo simples, rápido e direto
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-300 sm:text-base">
              O objetivo é perceber a necessidade, construir a solução certa e garantir que a
              plataforma continua útil depois da entrega.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <article className="tech-card">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-200">01</p>
              <h3 className="mt-4 text-xl font-semibold tracking-[-0.02em] text-white">
                Análise do projeto
              </h3>
              <p className="mt-4 text-sm leading-7 text-slate-300">
                Definimos os objetivos, funcionalidades, prazo e o tipo de tecnologia mais adequado.
              </p>
            </article>

            <article className="tech-card">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-200">02</p>
              <h3 className="mt-4 text-xl font-semibold tracking-[-0.02em] text-white">
                Desenvolvimento da solução
              </h3>
              <p className="mt-4 text-sm leading-7 text-slate-300">
                Construímos uma plataforma visualmente forte, rápida, moderna e preparada para uso
                real.
              </p>
            </article>

            <article className="tech-card">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-200">03</p>
              <h3 className="mt-4 text-xl font-semibold tracking-[-0.02em] text-white">
                Manutenção e crescimento
              </h3>
              <p className="mt-4 text-sm leading-7 text-slate-300">
                Continuamos a gerir, otimizar e expandir o projeto depois do lançamento, quando
                necessário.
              </p>
            </article>
          </div>
        </section>

        <section className="mt-24" aria-labelledby="faq-title">
          <div className="mx-auto max-w-4xl">
            <div className="text-center">
              <div className="section-badge">FAQ</div>
              <h2
                id="faq-title"
                className="text-glow mt-6 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl"
              >
                Perguntas frequentes
              </h2>
            </div>

            <div className="mt-10 grid gap-6">
              <article className="glass-panel panel-highlight p-6">
                <h3 className="text-lg font-semibold text-white">
                  A MA-Code cria apenas websites?
                </h3>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  Não. Para além da criação de websites, desenvolvemos lojas online, aplicações web,
                  integrações de IA, automações, sistemas de marcações, CRM, bases de dados e
                  soluções blockchain.
                </p>
              </article>

              <article className="glass-panel panel-highlight p-6">
                <h3 className="text-lg font-semibold text-white">
                  Fazem manutenção e gestão depois do lançamento?
                </h3>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  Sim. Podemos tratar da manutenção técnica, atualizações, gestão da plataforma,
                  otimização e evolução contínua do projeto.
                </p>
              </article>

              <article className="glass-panel panel-highlight p-6">
                <h3 className="text-lg font-semibold text-white">
                  Criam lojas online com pagamentos e carrinho de compras?
                </h3>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  Sim. Desenvolvemos e-commerce com catálogo, carrinho, checkout, pagamentos,
                  automações e estrutura orientada à conversão.
                </p>
              </article>

              <article className="glass-panel panel-highlight p-6">
                <h3 className="text-lg font-semibold text-white">
                  Trabalham com empresas em Portugal?
                </h3>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  Sim. A MA-Code trabalha com negócios e projetos em Portugal e pode adaptar a
                  solução ao tipo de empresa, serviço ou produto.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section id="orcamento" className="mt-24" aria-labelledby="orcamento-title">
          <div className="glass-panel panel-highlight mx-auto max-w-4xl p-8 sm:p-10 md:p-12">
            <div className="mb-10 text-center sm:text-left">
              <div className="section-badge">Pedido de orçamento</div>
              <h2
                id="orcamento-title"
                className="text-glow mt-6 text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl"
              >
                Peça um orçamento para o seu projeto
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                Seja para criação de um website, loja online, plataforma, integração de IA, sistema
                de marcações, CRM, base de dados ou projeto blockchain, podemos desenhar uma
                solução ajustada ao seu objetivo.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
              <div>
                <label className="input-label" htmlFor="name">
                  Nome
                </label>
                <input
                  id="name"
                  className="input-field"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  autoComplete="name"
                />
              </div>

              <div>
                <label className="input-label" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  className="input-field"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                  autoComplete="email"
                />
              </div>

              <div>
                <label className="input-label" htmlFor="message">
                  Descreva o projeto
                </label>
                <textarea
                  id="message"
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
    </main>
  )
}
