import { useEffect } from 'react'

const siteUrl =
  'https://ma-code.pt'

const privacyPath =
  '/privacidade/ma-professor'

const privacyContact =
  'acesso.prof@ma-code.pt'

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

function updateCanonical(
  href: string
) {
  let canonical =
    document.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]'
    )

  if (!canonical) {
    canonical =
      document.createElement(
        'link'
      )

    canonical.rel =
      'canonical'

    document.head.appendChild(
      canonical
    )
  }

  canonical.href =
    href
}

function Section({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-slate-950/65 p-5 shadow-xl shadow-black/10 sm:p-7">
      <h2 className="text-xl font-black text-white">
        {title}
      </h2>

      <div className="mt-4 space-y-3 text-sm leading-7 text-slate-300">
        {children}
      </div>
    </section>
  )
}

export default function MAProfessorPrivacyPage() {
  useEffect(
    () => {
      document.title =
        'Privacidade do MA-Professor | MA-CODE'

      updateMeta(
        'description',
        'Informação sobre o tratamento de dados pessoais, segurança, cópias cifradas e direitos dos utilizadores do MA-Professor.'
      )

      updateMeta(
        'robots',
        'noindex, nofollow, noarchive'
      )

      updateCanonical(
        `${siteUrl}${privacyPath}`
      )
    },
    []
  )

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <a
          href="/produtos/ma-professor"
          className="text-sm font-bold text-cyan-200 transition hover:text-cyan-100"
        >
          ← Voltar ao MA-Professor
        </a>

        <header className="mt-6 rounded-[2rem] border border-cyan-300/15 bg-slate-900/80 p-6 shadow-2xl shadow-cyan-950/20 sm:p-9">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">
            MA-Professor · Privacidade
          </p>

          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
            Informação de privacidade
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
            Esta informação descreve o tratamento de dados associado ao MA-Professor durante a fase piloto. Foi atualizada em 22 de setembro de 2026 e deve ser lida em conjunto com os avisos apresentados no próprio produto.
          </p>
        </header>

        <div className="mt-6 space-y-5">
          <Section title="1. Responsável e contacto">
            <p>
              Para os dados de conta, acesso, segurança, administração do piloto e funcionamento técnico do serviço, o responsável pelo tratamento é a <strong className="text-white">MA-CODE</strong>.
            </p>

            <p>
              Para questões de privacidade, exercício de direitos ou pedidos relativos à conta, contacte{' '}
              <a
                href={`mailto:${privacyContact}`}
                className="font-bold text-cyan-200 underline decoration-cyan-300/40 underline-offset-4"
              >
                {privacyContact}
              </a>.
            </p>

            <p className="text-slate-400">
              Os dados pedagógicos introduzidos pelo professor podem estar sujeitos às regras e responsabilidades da escola, agrupamento ou entidade em cujo contexto profissional são utilizados. A MA-CODE não determina as finalidades pedagógicas desses dados.
            </p>
          </Section>

          <Section title="2. Dados tratados">
            <p>
              <strong className="text-white">Dados de conta e acesso:</strong> email, estado do pedido de acesso, licença, ativações e renovações, identificador técnico do dispositivo, sessões e datas associadas ao acesso.
            </p>

            <p>
              <strong className="text-white">Estado operacional:</strong> o serviço pode registar se a configuração está operacional, se a configuração foi concluída e as respetivas datas. Este estado administrativo não inclui o conteúdo pedagógico das aulas.
            </p>

            <p>
              <strong className="text-white">Segurança:</strong> os mecanismos de proteção contra abuso podem ler o endereço de rede recebido pelo serviço para gerar identificadores derivados por hash, contadores de tentativas e períodos de bloqueio. A finalidade é limitar tentativas abusivas de login e ativação.
            </p>

            <p>
              <strong className="text-white">Dados escolares locais:</strong> turmas, alunos, números de aluno, sumários, faltas, avaliações, classificações, planificações e restante informação pedagógica ficam, por defeito, guardados no browser do professor.
            </p>
          </Section>

          <Section title="3. Cópias online e cifração">
            <p>
              A cópia online é opcional. Só são iniciados novos envios automáticos depois de o professor a ativar para a sua conta e dispositivo.
            </p>

            <p>
              Antes do envio, os dados escolares são cifrados no dispositivo. Nas cópias com <strong className="text-white">proteção v3</strong>, a password pessoal não é enviada à MA-CODE e o servidor não guarda material suficiente para decifrar a cópia.
            </p>

            <p>
              Contas antigas que ainda mantenham uma cópia com <strong className="text-white">proteção v2</strong> conservam temporariamente o modelo anterior, no qual existe material técnico no servidor que permite decifrar essa cópia, até ocorrer a migração explícita para v3.
            </p>

            <p>
              Se a password pessoal for esquecida, a MA-CODE não a consegue recuperar. Os dados que continuem guardados localmente no dispositivo não são apagados por esse motivo, mas uma cópia v3 deixa de poder ser restaurada quando a chave OPAQUE necessária já não estiver disponível.
            </p>
          </Section>

          <Section title="4. Finalidades e fundamento">
            <p>
              Os dados de conta e acesso são tratados para disponibilizar o serviço solicitado, gerir o piloto, autenticar o professor, manter sessões, aplicar o estado da licença e prestar suporte.
            </p>

            <p>
              Os dados técnicos de segurança são tratados para proteger contas e infraestrutura, prevenir abuso, limitar tentativas automatizadas e manter a integridade do serviço.
            </p>

            <p>
              A cópia online é tratada exclusivamente para criar, conservar e restaurar a cópia cifrada quando o professor escolhe utilizar essa funcionalidade.
            </p>

            <p className="text-slate-400">
              O tratamento necessário à disponibilização do serviço assenta na execução do acesso solicitado e nas medidas necessárias à sua prestação. As medidas de segurança e prevenção de abuso assentam no interesse legítimo de proteger o serviço e os seus utilizadores, sem prejuízo das obrigações legais aplicáveis.
            </p>
          </Section>

          <Section title="5. Conservação">
            <p>
              As sessões de acesso têm um limite absoluto de <strong className="text-white">180 dias</strong> desde a sua criação, mesmo que exista atividade posterior.
            </p>

            <p>
              Pedidos de acesso pendentes ou rejeitados sem atividade podem ser eliminados depois de <strong className="text-white">180 dias</strong>, desde que não estejam associados a licença, credencial, sessão, renovação ou autorização comercial.
            </p>

            <p>
              Os guardas temporários de login e ativação usam janelas de retenção técnicas curtas; os mecanismos atuais eliminam estados antigos de proteção contra tentativas de acordo com os limites implementados no serviço.
            </p>

            <p>
              A cópia online atual pode manter até duas gerações cifradas anteriores para recuperação técnica. A eliminação administrativa de uma conta remove também os dados cloud associados ao MA-Professor, salvo informação cuja conservação seja legalmente obrigatória.
            </p>
          </Section>

          <Section title="6. Prestadores e transferências">
            <p>
              O MA-Professor utiliza infraestrutura da <strong className="text-white">Cloudflare</strong> para disponibilização do serviço, autenticação, armazenamento técnico e, quando ativadas, cópias cifradas online.
            </p>

            <p>
              A Cloudflare é uma empresa global e pode processar dados fora do Espaço Económico Europeu. A sua documentação contratual prevê mecanismos de proteção para transferências internacionais, incluindo cláusulas contratuais-tipo quando aplicáveis.
            </p>

            <p>
              A MA-CODE não vende os dados escolares introduzidos no MA-Professor.
            </p>
          </Section>

          <Section title="7. Direitos">
            <p>
              Nos termos aplicáveis, pode pedir acesso aos seus dados pessoais, correção, apagamento, limitação do tratamento, oposição e portabilidade. Pode também pedir esclarecimentos sobre os dados associados à sua conta.
            </p>

            <p>
              Para exercer estes direitos, contacte{' '}
              <a
                href={`mailto:${privacyContact}`}
                className="font-bold text-cyan-200 underline decoration-cyan-300/40 underline-offset-4"
              >
                {privacyContact}
              </a>.
            </p>

            <p>
              Pode ainda apresentar reclamação à <strong className="text-white">Comissão Nacional de Proteção de Dados (CNPD)</strong>.
            </p>
          </Section>

          <Section title="8. Alterações a esta informação">
            <p>
              Esta página será atualizada quando existir uma alteração material ao tratamento de dados, aos prazos de conservação, aos prestadores utilizados ou às garantias técnicas da cópia online.
            </p>

            <p className="text-slate-400">
              Uma alteração de texto nunca deve prometer uma garantia de privacidade superior à que a arquitetura efetivamente fornece.
            </p>
          </Section>
        </div>
      </div>
    </main>
  )
}
