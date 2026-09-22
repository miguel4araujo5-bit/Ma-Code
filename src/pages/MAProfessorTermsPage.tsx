import { useEffect, type ReactNode } from 'react'

const siteUrl =
  'https://ma-code.pt'

const legalPath =
  '/termos/ma-professor'

const legalContact =
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
    meta.name = name
    document.head.appendChild(meta)
  }

  meta.content = content
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

  canonical.href = href
}

function Section({
  title,
  children
}: {
  title: string
  children: ReactNode
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

export default function MAProfessorTermsPage() {
  useEffect(
    () => {
      document.title =
        'Termos do MA-Professor | MA-CODE'

      updateMeta(
        'description',
        'Termos de utilização e condições de tratamento de dados do MA-Professor.'
      )

      updateMeta(
        'robots',
        'noindex, nofollow, noarchive'
      )

      updateCanonical(
        `${siteUrl}${legalPath}`
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

        <header className="mt-6 rounded-[2rem] border border-violet-300/15 bg-slate-900/80 p-6 shadow-2xl shadow-violet-950/20 sm:p-9">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-200">
            MA-Professor · Fase piloto
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
            Termos de utilização e tratamento de dados
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
            Estes termos regulam a utilização do MA-Professor durante a fase piloto e incluem as condições aplicáveis quando uma escola, agrupamento ou outra entidade responsável autoriza o tratamento de dados escolares através do serviço. Última atualização: 22 de setembro de 2026.
          </p>
        </header>

        <div className="mt-6 space-y-5">
          <Section title="1. Fornecedor e contacto">
            <p>
              O MA-Professor é disponibilizado pela <strong className="text-white">MA-CODE</strong>, atividade exercida em nome individual, através de ma-code.pt.
            </p>
            <p>
              Contacto para assuntos do serviço, privacidade ou tratamento de dados:{' '}
              <a
                href={`mailto:${legalContact}`}
                className="font-bold text-cyan-200 underline decoration-cyan-300/40 underline-offset-4"
              >
                {legalContact}
              </a>.
            </p>
            <p>
              A informação sobre dados de conta, segurança e cópias online consta da{' '}
              <a
                href="/privacidade/ma-professor"
                className="font-bold text-cyan-200 underline decoration-cyan-300/40 underline-offset-4"
              >
                informação de privacidade do MA-Professor
              </a>.
            </p>
          </Section>

          <Section title="2. Âmbito da fase piloto">
            <p>
              O MA-Professor é disponibilizado a docentes para testar e utilizar funcionalidades de organização pedagógica, incluindo horários, planificações, sumários, assiduidade, avaliações e recuperação de aprendizagens.
            </p>
            <p>
              A fase piloto pode conter alterações de interface ou funcionamento. A MA-CODE deve preservar os dados e os fluxos existentes sempre que tecnicamente possível, mas o professor deve manter cópias de segurança adequadas aos dados que considere essenciais.
            </p>
          </Section>

          <Section title="3. Conta, password e segurança">
            <p>
              Cada professor é responsável por proteger o acesso ao seu dispositivo, ao seu email e à sua password pessoal. A password pessoal não é enviada nem guardada pela MA-CODE.
            </p>
            <p>
              Nas cópias online, os dados pedagógicos são cifrados no dispositivo antes do envio e o servidor não conserva material suficiente para os decifrar sem a chave derivada do processo OPAQUE no dispositivo do utilizador.
            </p>
          </Section>

          <Section title="4. Utilização de dados reais de alunos">
            <p>
              <strong className="text-white">Um professor só deve introduzir dados reais de alunos quando estiver autorizado pela escola, agrupamento ou outra entidade que determine as finalidades e os meios essenciais desse tratamento.</strong>
            </p>
            <p>
              Se o professor não tiver essa autorização, deve utilizar apenas dados fictícios, anonimizados ou informação que não permita identificar alunos.
            </p>
            <p>
              O MA-Professor não transforma uma autorização individual do professor numa autorização da escola. A decisão de adotar uma ferramenta externa para tratamento de dados escolares continua a pertencer à entidade responsável no contexto profissional aplicável.
            </p>
          </Section>

          <Section title="5. Minimização de dados">
            <p>
              Devem ser introduzidos apenas os dados necessários às finalidades pedagógicas autorizadas. O professor não deve registar informação de saúde, religião, origem étnica, orientação sexual ou outras categorias especiais de dados salvo quando exista uma necessidade pedagógica ou legal clara e autorização adequada da entidade responsável.
            </p>
            <p>
              Observações livres sobre alunos devem ser objetivas, pertinentes e limitadas ao estritamente necessário.
            </p>
          </Section>

          <Section title="6. Dados locais e cópia online">
            <p>
              Os dados pedagógicos ficam, por defeito, no armazenamento local do browser. A MA-CODE não recebe o conteúdo pedagógico apenas porque o professor utiliza a aplicação.
            </p>
            <p>
              A cópia online é opcional. Quando é ativada, o serviço recebe e conserva a cópia cifrada e os metadados técnicos estritamente necessários ao funcionamento, verificação, versionamento e restauro.
            </p>
          </Section>

          <Section title="7. Condições de tratamento de dados — artigo 28.º do RGPD">
            <p>
              Quando uma escola, agrupamento ou outra entidade responsável autoriza o MA-Professor para tratamento de dados escolares e a MA-CODE trata dados pessoais por conta dessa entidade, as cláusulas seguintes aplicam-se como condições de subcontratação.
            </p>
            <p>
              <strong className="text-white">Objeto e duração:</strong> disponibilização do MA-Professor durante o período em que o acesso estiver ativo e enquanto subsistirem dados necessários ao serviço ou cópias cuja conservação tenha sido solicitada.
            </p>
            <p>
              <strong className="text-white">Natureza e finalidade:</strong> armazenamento local assistido pela aplicação; criação, receção, conservação, sincronização e restauro de cópias cifradas quando ativadas; autenticação, segurança, suporte e operações técnicas necessárias à prestação do serviço.
            </p>
            <p>
              <strong className="text-white">Titulares dos dados:</strong> professores e, quando autorizado pela entidade responsável, alunos ou formandos abrangidos pela atividade pedagógica do utilizador.
            </p>
            <p>
              <strong className="text-white">Categorias de dados:</strong> identificação escolar básica, turma, número, assiduidade, sumários, classificações, avaliações, planificações e observações pedagógicas introduzidas pelo utilizador, além dos dados técnicos e de conta descritos na informação de privacidade.
            </p>
          </Section>

          <Section title="8. Instruções e deveres da MA-CODE">
            <p>
              A MA-CODE trata os dados escolares apenas de acordo com as funcionalidades escolhidas por utilizadores autorizados e com instruções documentadas da entidade responsável, salvo obrigação legal em contrário.
            </p>
            <p>
              A MA-CODE aplica medidas técnicas e organizativas adequadas, limita o acesso ao necessário, mantém confidencialidade sobre os dados a que possa legitimamente ter acesso e presta assistência razoável à entidade responsável no cumprimento de pedidos de titulares, incidentes de segurança e demais obrigações previstas no RGPD.
            </p>
            <p>
              Uma violação de dados pessoais que afete dados tratados por conta de uma entidade responsável será comunicada a essa entidade sem demora injustificada após a MA-CODE dela tomar conhecimento, com a informação disponível necessária à avaliação do incidente.
            </p>
          </Section>

          <Section title="9. Subcontratantes ulteriores">
            <p>
              A infraestrutura do MA-Professor utiliza <strong className="text-white">Cloudflare</strong> para disponibilização da aplicação, autenticação, proteção, armazenamento técnico e cópias cifradas online. A Cloudflare disponibiliza um DPA próprio e mecanismos de transferência internacional, incluindo cláusulas contratuais-tipo quando aplicáveis.
            </p>
            <p>
              O serviço utiliza <strong className="text-white">Resend</strong> para envio de emails operacionais de acesso e decisões do piloto. Esses emails podem incluir o endereço do professor, conteúdo da mensagem e informação técnica de entrega. A Resend disponibiliza DPA próprio, cláusulas contratuais-tipo e informação sobre retenção e subcontratantes.
            </p>
            <p>
              A entidade responsável concede autorização geral para estes subcontratantes necessários à prestação do serviço. Alterações materiais a esta lista serão comunicadas através da aplicação, email de serviço ou atualização destacada destes termos antes de produzirem efeitos, quando a alteração depender de decisão da MA-CODE.
            </p>
          </Section>

          <Section title="10. Eliminação, devolução e fim do serviço">
            <p>
              A entidade responsável ou o utilizador autorizado pode solicitar a eliminação da conta e dos dados cloud associados. A aplicação também permite criar cópias locais para conservação pelo utilizador.
            </p>
            <p>
              No termo do serviço, os dados tratados por conta da entidade responsável serão eliminados ou devolvidos, conforme a opção tecnicamente disponível e as instruções aplicáveis, salvo quando a conservação seja exigida por lei.
            </p>
          </Section>

          <Section title="11. Informação e auditoria">
            <p>
              A MA-CODE disponibilizará informação razoavelmente necessária para demonstrar o cumprimento destas condições e cooperará com pedidos de verificação proporcionais ao risco e à natureza do serviço, protegendo simultaneamente segredos de segurança, dados de outros utilizadores e credenciais.
            </p>
          </Section>

          <Section title="12. Aceitação institucional">
            <p>
              Estas condições só vinculam uma escola, agrupamento ou outra entidade responsável quando forem aceites por pessoa com poderes para a representar ou quando a utilização do MA-Professor tiver sido formalmente autorizada segundo os procedimentos internos dessa entidade.
            </p>
            <p>
              Um professor que não tenha poderes para representar a entidade não deve declarar que estes termos foram aceites em nome dela. Nessa situação, pode testar o produto apenas com dados fictícios ou anonimizados até existir autorização.
            </p>
          </Section>
        </div>
      </div>
    </main>
  )
}
