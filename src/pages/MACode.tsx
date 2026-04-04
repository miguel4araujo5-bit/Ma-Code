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
            Websites • Lojas Online • Marcações • Automação • Suporte
          </div>

          <h1
            id="hero-title"
            className="text-glow mt-8 text-5xl font-semibold tracking-[-0.05em] text-white sm:text-6xl md:text-7xl"
          >
            Criamos websites e lojas online para o seu negócio parecer mais profissional e vender
            melhor
          </h1>

          <p className="mx-auto mt-8 max-w-3xl text-base leading-8 text-slate-300 sm:text-lg">
            Tratamos do desenvolvimento, da implementação e da manutenção. Se precisa de um website
            profissional, de uma loja online ou de uma solução simples para organizar melhor o seu
            negócio, a MA-Code ajuda-o a avançar sem complicações.
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
            <span className="tech-pill">Mais confiança</span>
            <span className="tech-pill">Mais contactos</span>
            <span className="tech-pill">Mais organização</span>
            <span className="tech-pill">Menos complicação</span>
          </div>
        </section>

        <section className="mt-16 grid gap-4 sm:grid-cols-3" aria-label="Vantagens principais">
          <div className="glass-panel panel-highlight p-6 text-center">
            <h2 className="text-3xl font-semibold tracking-[-0.04em] text-white">Credibilidade</h2>
            <p className="mt-2 text-sm leading-7 text-slate-300">
              Um website profissional melhora a imagem da sua marca e transmite mais confiança logo
              no primeiro contacto.
            </p>
          </div>

          <div className="glass-panel panel-highlight p-6 text-center">
            <h2 className="text-3xl font-semibold tracking-[-0.04em] text-white">Resultados</h2>
            <p className="mt-2 text-sm leading-7 text-slate-300">
              Criamos soluções pensadas para captar contactos, facilitar pedidos e ajudar o negócio
              a vender melhor.
            </p>
          </div>

          <div className="glass-panel panel-highlight p-6 text-center">
            <h2 className="text-3xl font-semibold tracking-[-0.04em] text-white">Acompanhamento</h2>
            <p className="mt-2 text-sm leading-7 text-slate-300">
              Depois do lançamento, podemos continuar com manutenção, melhorias e suporte sempre
              que precisar.
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
              Soluções claras para negócios que querem crescer online
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
              A MA-Code desenvolve soluções à medida, desde websites simples e eficazes até
              sistemas mais completos para vendas, marcações, organização e automatização.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <article className="tech-card">
              <div className="icon-glow mb-5 h-12 w-12 rounded-2xl border border-cyan-400/20 bg-cyan-400/10" />
              <h3 className="text-xl font-semibold tracking-[-0.02em] text-white">
                Websites profissionais
              </h3>
              <p className="mt-4 text-sm leading-7 text-slate-300">
                Criamos websites modernos, rápidos e profissionais para apresentar a sua empresa,
                transmitir confiança e transformar visitas em contactos.
              </p>
            </article>

            <article className="tech-card">
              <div className="icon-glow-indigo mb-5 h-12 w-12 rounded-2xl border border-indigo-400/20 bg-indigo-400/10" />
              <h3 className="text-xl font-semibold tracking-[-0.02em] text-white">
                Lojas online
              </h3>
              <p className="mt-4 text-sm leading-7 text-slate-300">
                Desenvolvemos lojas online com catálogo, carrinho de compras e checkout para vender
                os seus produtos de forma simples, profissional e organizada.
              </p>
            </article>

            <article className="tech-card">
              <div className="icon-glow-sky mb-5 h-12 w-12 rounded-2xl border border-sky-400/20 bg-sky-400/10" />
              <h3 className="text-xl font-semibold tracking-[-0.02em] text-white">
                Sistemas de marcações
              </h3>
              <p className="mt-4 text-sm leading-7 text-slate-300">
                Ideal para clínicas, consultórios, salões, barbearias, oficinas e outros negócios
                que precisam de agendamentos mais organizados e automáticos.
              </p>
            </article>

            <article className="tech-card">
              <div className="icon-glow mb-5 h-12 w-12 rounded-2xl border border-emerald-400/20 bg-emerald-400/10" />
              <h3 className="text-xl font-semibold tracking-[-0.02em] text-white">
                IA, automação e chatbots
              </h3>
              <p className="mt-4 text-sm leading-7 text-slate-300">
                Automatizamos tarefas, melhoramos processos e integramos IA para poupar tempo,
                responder mais depressa e reduzir trabalho manual.
              </p>
            </article>

            <article className="tech-card">
              <div className="icon-glow-indigo mb-5 h-12 w-12 rounded-2xl border border-violet-400/20 bg-violet-400/10" />
              <h3 className="text-xl font-semibold tracking-[-0.02em] text-white">
                Gestão de clientes e operações
              </h3>
              <p className="mt-4 text-sm leading-7 text-slate-300">
                Criamos soluções para organizar clientes, pedidos, dados e processos internos de
                forma mais prática, limpa e profissional.
              </p>
            </article>

            <article className="tech-card">
              <div className="icon-glow-sky mb-5 h-12 w-12 rounded-2xl border border-fuchsia-400/20 bg-fuchsia-400/10" />
              <h3 className="text-xl font-semibold tracking-[-0.02em] text-white">
                Desenvolvimento à medida
              </h3>
              <p className="mt-4 text-sm leading-7 text-slate-300">
                Para projetos mais específicos, também desenvolvemos plataformas personalizadas,
                integrações avançadas e outras funcionalidades adaptadas ao que o seu negócio
                precisa.
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
                  Uma solução simples para quem quer crescer online sem perder tempo
                </h2>
                <p className="mt-4 text-sm leading-7 text-slate-300 sm:text-base">
                  Há negócios que só precisam de um bom website. Outros precisam de loja online,
                  marcações, automatização ou ferramentas internas. A vantagem da MA-Code é começar
                  com o que faz sentido hoje e permitir evoluir depois, sem ter de recomeçar tudo
                  do zero.
                </p>
              </div>

              <div className="grid gap-4">
                <div className="mini-panel">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200">
                    Mais confiança
                  </p>
                  <p className="mt-2 text-sm leading-7 text-slate-300">
                    Um projeto profissional ajuda a causar uma boa primeira impressão e a aumentar a
                    credibilidade.
                  </p>
                </div>

                <div className="mini-panel">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200">
                    Mais simplicidade
                  </p>
                  <p className="mt-2 text-sm leading-7 text-slate-300">
                    Explicamos o processo de forma clara e ajudamos a escolher a solução certa sem
                    linguagem técnica desnecessária.
                  </p>
                </div>

                <div className="mini-panel">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200">
                    Mais margem para crescer
                  </p>
                  <p className="mt-2 text-sm leading-7 text-slate-300">
                    O seu projeto pode começar simples e evoluir depois para novas funcionalidades,
                    sem ter de mudar de parceiro técnico.
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
              Um processo simples do início ao fim
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-300 sm:text-base">
              O objetivo é perceber o que precisa, propor a solução certa e garantir que tudo fica
              pronto a funcionar de forma clara e profissional.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <article className="tech-card">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-200">01</p>
              <h3 className="mt-4 text-xl font-semibold tracking-[-0.02em] text-white">
                Percebemos o que precisa
              </h3>
              <p className="mt-4 text-sm leading-7 text-slate-300">
                Analisamos o seu negócio, o objetivo do projeto e o tipo de solução que faz mais
                sentido para o seu caso.
              </p>
            </article>

            <article className="tech-card">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-200">02</p>
              <h3 className="mt-4 text-xl font-semibold tracking-[-0.02em] text-white">
                Desenvolvemos a solução
              </h3>
              <p className="mt-4 text-sm leading-7 text-slate-300">
                Criamos uma solução profissional, funcional e preparada para ser usada no dia a
                dia.
              </p>
            </article>

            <article className="tech-card">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-200">03</p>
              <h3 className="mt-4 text-xl font-semibold tracking-[-0.02em] text-white">
                Acompanhamos depois do lançamento
              </h3>
              <p className="mt-4 text-sm leading-7 text-slate-300">
                Se precisar, continuamos a dar suporte, manutenção e melhorias para acompanhar o
                crescimento do projeto.
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
                  A MA-Code faz apenas websites?
                </h3>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  Não. Para além de websites, também criamos lojas online, sistemas de marcações,
                  automações, integrações e outras soluções adaptadas ao negócio.
                </p>
              </article>

              <article className="glass-panel panel-highlight p-6">
                <h3 className="text-lg font-semibold text-white">
                  Posso pedir algo simples?
                </h3>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  Sim. Nem todos os projetos precisam de algo complexo. Podemos criar desde um
                  website simples e profissional até uma solução mais completa.
                </p>
              </article>

              <article className="glass-panel panel-highlight p-6">
                <h3 className="text-lg font-semibold text-white">
                  Também tratam da manutenção?
                </h3>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  Sim. Podemos tratar de atualizações, melhorias, suporte e manutenção para garantir
                  que o projeto continua estável e atual.
                </p>
              </article>

              <article className="glass-panel panel-highlight p-6">
                <h3 className="text-lg font-semibold text-white">
                  Trabalham com clientes que não percebem da parte técnica?
                </h3>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  Sim. Explicamos tudo de forma simples e ajudamos a escolher a melhor opção sem
                  complicar com linguagem técnica.
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
                Fale-nos do seu projeto
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                Diga-nos o que precisa. Seja um website, uma loja online, um sistema de marcações
                ou outra solução para o seu negócio, analisamos o projeto e apresentamos a melhor
                opção para o seu caso.
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
