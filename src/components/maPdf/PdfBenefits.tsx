export default function PdfBenefits() {
  return (
    <section className="relative z-10 px-5 pb-20 sm:px-6 md:px-10 md:pb-24">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-6 md:grid-cols-3">
          <article className="service-card">
            <div className="service-card__line" />

            <div className="relative z-10">
              <span className="service-card__index">01</span>

              <h2 className="service-card__title">
                Os ficheiros ficam no dispositivo
              </h2>

              <p className="service-card__description">
                O documento é processado localmente no navegador. Não fazemos
                upload, armazenamento ou análise dos seus ficheiros.
              </p>
            </div>
          </article>

          <article className="service-card">
            <div className="service-card__line" />

            <div className="relative z-10">
              <span className="service-card__index">02</span>

              <h2 className="service-card__title">
                Sem conta obrigatória
              </h2>

              <p className="service-card__description">
                Pode utilizar as ferramentas disponíveis sem criar conta,
                fornecer email ou subscrever qualquer plano.
              </p>
            </div>
          </article>

          <article className="service-card">
            <div className="service-card__line" />

            <div className="relative z-10">
              <span className="service-card__index">03</span>

              <h2 className="service-card__title">
                Apoio voluntário
              </h2>

              <p className="service-card__description">
                O acesso é gratuito. Quem considerar a ferramenta útil pode
                apoiar voluntariamente o desenvolvimento de novas funções.
              </p>
            </div>
          </article>
        </div>
      </div>
    </section>
  )
}
