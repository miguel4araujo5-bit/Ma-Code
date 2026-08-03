import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent
} from 'react'

const siteUrl = 'https://ma-code.pt'
const accessKeyStorageKey = 'ma-seo-access-key'

type TermStat = {
  term: string
  key: string
  score: number
  documents: number
}

type TopicStat = {
  label: string
  key: string
  level: 2 | 3
  occurrences: number
  documents: number
}

type BriefSource = {
  position: number
  title: string
  url: string
  cached: boolean
  status: 'analisada' | 'falhou'
  wordCount: number | null
  error: string | null
}

type BriefResponse = {
  success: true
  cached: boolean
  keyword: string
  generatedAt: string
  filename: string
  markdown: string
  analysis: {
    medianWordCount: number
    targetWordCount: {
      minimum: number
      maximum: number
    }
    terms: TermStat[]
    topics: TopicStat[]
  }
  sources: BriefSource[]
}

type ScoreResponse = {
  success: true
  keyword: string
  briefGeneratedAt: string
  coverage: number
  termCoverage: number
  outlineCoverage: number
  wordCount: number
  targetWordCount: {
    minimum: number
    maximum: number
  }
  coveredTerms: number
  totalTerms: number
  coveredTopics: number
  totalTopics: number
  missingTerms: Array<{
    term: string
    documents: number
    priority:
      | 'Alta'
      | 'Média'
      | 'Baixa'
  }>
  missingTopics: Array<{
    label: string
    level: 2 | 3
    documents: number
  }>
}

type Mode =
  | 'brief'
  | 'score'

type Feedback = {
  type:
    | 'success'
    | 'error'
  message: string
} | null

function setMeta(
  name: string,
  content: string
) {
  let element =
    document.querySelector<HTMLMetaElement>(
      `meta[name="${name}"]`
    )

  if (!element) {
    element =
      document.createElement(
        'meta'
      )

    element.name = name

    document.head.appendChild(
      element
    )
  }

  element.content = content
}

function setPropertyMeta(
  property: string,
  content: string
) {
  let element =
    document.querySelector<HTMLMetaElement>(
      `meta[property="${property}"]`
    )

  if (!element) {
    element =
      document.createElement(
        'meta'
      )

    element.setAttribute(
      'property',
      property
    )

    document.head.appendChild(
      element
    )
  }

  element.content = content
}

function setCanonical(
  href: string
) {
  let element =
    document.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]'
    )

  if (!element) {
    element =
      document.createElement(
        'link'
      )

    element.rel =
      'canonical'

    document.head.appendChild(
      element
    )
  }

  element.href = href
}

function setStructuredData(
  id: string,
  data: unknown
) {
  let element =
    document.querySelector<HTMLScriptElement>(
      `script[data-schema-id="${id}"]`
    )

  if (!element) {
    element =
      document.createElement(
        'script'
      )

    element.type =
      'application/ld+json'

    element.dataset.schemaId =
      id

    document.head.appendChild(
      element
    )
  }

  element.textContent =
    JSON.stringify(data)
}

const number = (
  value: number
) =>
  new Intl.NumberFormat(
    'pt-PT'
  ).format(value)

const date = (
  value: string
) =>
  new Intl.DateTimeFormat(
    'pt-PT',
    {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }
  ).format(new Date(value))

const request = async <
  ResponseType extends object
>(
  path: string,
  accessKey: string,
  body: Record<
    string,
    string
  >
): Promise<ResponseType> => {
  const response =
    await fetch(path, {
      method: 'POST',
      headers: {
        'Content-Type':
          'application/json',
        'X-MA-SEO-Key':
          accessKey
      },
      body:
        JSON.stringify(body)
    })

  const data =
    (
      await response
        .json()
        .catch(() => ({}))
    ) as
      | ResponseType
      | {
          message?: string
        }

  if (!response.ok) {
    throw new Error(
      'message' in data &&
      typeof data.message ===
        'string'
        ? data.message
        : 'Não foi possível concluir o pedido.'
    )
  }

  return data as ResponseType
}

function Metric({
  label,
  value,
  detail
}: {
  label: string
  value: string
  detail: string
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <span className="text-[0.66rem] font-semibold uppercase tracking-[0.17em] text-slate-500">
        {label}
      </span>

      <strong className="mt-2 block text-xl font-semibold text-white">
        {value}
      </strong>

      <p className="mt-1 text-xs leading-5 text-slate-500">
        {detail}
      </p>
    </div>
  )
}

export default function MASeoPage() {
  const [
    mounted,
    setMounted
  ] = useState(false)

  const [
    mode,
    setMode
  ] = useState<Mode>(
    'brief'
  )

  const [
    accessKey,
    setAccessKey
  ] = useState('')

  const [
    keyword,
    setKeyword
  ] = useState('')

  const [
    draft,
    setDraft
  ] = useState('')

  const [
    draftFilename,
    setDraftFilename
  ] = useState('')

  const [
    brief,
    setBrief
  ] =
    useState<BriefResponse | null>(
      null
    )

  const [
    score,
    setScore
  ] =
    useState<ScoreResponse | null>(
      null
    )

  const [
    loading,
    setLoading
  ] = useState(false)

  const [
    feedback,
    setFeedback
  ] =
    useState<Feedback>(
      null
    )

  const [
    copied,
    setCopied
  ] = useState(false)

  const fileInput =
    useRef<HTMLInputElement>(
      null
    )

  const usableSources =
    useMemo(
      () =>
        brief?.sources.filter(
          (source) =>
            source.status ===
            'analisada'
        ).length || 0,
      [brief]
    )

  useEffect(() => {
    setMounted(true)

    setAccessKey(
      sessionStorage.getItem(
        accessKeyStorageKey
      ) || ''
    )

    document.title =
      'MA-SEO | Briefs e pontuação de conteúdo'

    setMeta(
      'description',
      'Crie briefs SEO a partir dos resultados mais relevantes e verifique a cobertura editorial do seu rascunho com a MA-SEO.'
    )

    setMeta(
      'keywords',
      'MA-SEO, brief SEO, análise de conteúdo, pontuação SEO, TF-IDF, MA-Code'
    )

    setMeta(
      'robots',
      'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
    )

    setPropertyMeta(
      'og:type',
      'website'
    )

    setPropertyMeta(
      'og:locale',
      'pt_PT'
    )

    setPropertyMeta(
      'og:site_name',
      'MA-Code'
    )

    setPropertyMeta(
      'og:url',
      `${siteUrl}/produtos/ma-seo`
    )

    setPropertyMeta(
      'og:title',
      'MA-SEO | Briefs e pontuação de conteúdo'
    )

    setPropertyMeta(
      'og:description',
      'Analise resultados, gere briefs em Markdown e encontre lacunas no seu conteúdo.'
    )

    setPropertyMeta(
      'og:image',
      `${siteUrl}/ma-code.png`
    )

    setMeta(
      'twitter:card',
      'summary_large_image'
    )

    setMeta(
      'twitter:title',
      'MA-SEO | Briefs e pontuação de conteúdo'
    )

    setMeta(
      'twitter:description',
      'Briefs SEO e pontuação editorial numa ferramenta simples da MA-Code.'
    )

    setMeta(
      'twitter:image',
      `${siteUrl}/ma-code.png`
    )

    setCanonical(
      `${siteUrl}/produtos/ma-seo`
    )

    setStructuredData(
      'ma-seo-software',
      {
        '@context':
          'https://schema.org',
        '@type':
          'SoftwareApplication',
        name: 'MA-SEO',
        applicationCategory:
          'BusinessApplication',
        operatingSystem:
          'Web',
        url:
          `${siteUrl}/produtos/ma-seo`,
        description:
          'Ferramenta para gerar briefs SEO e pontuar a cobertura editorial de rascunhos.',
        creator: {
          '@type':
            'Organization',
          name:
            'MA-Code',
          url:
            siteUrl
        }
      }
    )
  }, [])

  const saveAccessKey = (
    value: string
  ) => {
    setAccessKey(value)

    if (value.trim()) {
      sessionStorage.setItem(
        accessKeyStorageKey,
        value
      )
    } else {
      sessionStorage.removeItem(
        accessKeyStorageKey
      )
    }
  }

  const validate = () => {
    if (
      !accessKey.trim()
    ) {
      setFeedback({
        type: 'error',
        message:
          'Introduza o código de acesso.'
      })

      return false
    }

    if (
      keyword.trim().length <
      2
    ) {
      setFeedback({
        type: 'error',
        message:
          'Introduza uma palavra-chave válida.'
      })

      return false
    }

    return true
  }

  const generateBrief =
    async () => {
      if (!validate()) {
        return
      }

      setLoading(true)
      setFeedback(null)

      try {
        const result =
          await request<BriefResponse>(
            '/api/ma-seo/brief',
            accessKey.trim(),
            {
              keyword:
                keyword.trim()
            }
          )

        setBrief(result)
        setKeyword(
          result.keyword
        )

        setFeedback({
          type: 'success',
          message:
            result.cached
              ? 'Brief recuperado da cache sem novos custos de API.'
              : 'Brief criado e guardado na cache.'
        })
      } catch (error) {
        setFeedback({
          type: 'error',
          message:
            error instanceof
            Error
              ? error.message
              : 'Não foi possível gerar o brief.'
        })
      } finally {
        setLoading(false)
      }
    }

  const scoreDraft =
    async () => {
      if (!validate()) {
        return
      }

      if (
        draft.trim().length <
        80
      ) {
        setFeedback({
          type: 'error',
          message:
            'Cole ou carregue um rascunho com pelo menos 80 caracteres.'
        })

        return
      }

      setLoading(true)
      setFeedback(null)

      try {
        const result =
          await request<ScoreResponse>(
            '/api/ma-seo/score',
            accessKey.trim(),
            {
              keyword:
                keyword.trim(),
              draft
            }
          )

        setScore(result)
        setKeyword(
          result.keyword
        )

        setFeedback({
          type: 'success',
          message:
            'Rascunho comparado com o brief.'
        })
      } catch (error) {
        setFeedback({
          type: 'error',
          message:
            error instanceof
            Error
              ? error.message
              : 'Não foi possível pontuar.'
        })
      } finally {
        setLoading(false)
      }
    }

  const loadDraft =
    async (
      event:
        ChangeEvent<HTMLInputElement>
    ) => {
      const file =
        event.target.files?.[0]

      if (!file) {
        return
      }

      const extension =
        file.name
          .split('.')
          .pop()
          ?.toLowerCase()

      if (
        ![
          'md',
          'markdown',
          'txt'
        ].includes(
          extension || ''
        ) ||
        file.size >
          350_000
      ) {
        setFeedback({
          type: 'error',
          message:
            'Use um ficheiro .md, .markdown ou .txt até 350 KB.'
        })

        event.target.value =
          ''

        return
      }

      try {
        setDraft(
          await file.text()
        )

        setDraftFilename(
          file.name
        )

        setScore(null)

        setFeedback({
          type: 'success',
          message:
            `Ficheiro ${file.name} carregado.`
        })
      } catch {
        setFeedback({
          type: 'error',
          message:
            'Não foi possível ler o ficheiro.'
        })
      }

      event.target.value =
        ''
    }

  const copyBrief =
    async () => {
      if (!brief) {
        return
      }

      try {
        await navigator.clipboard.writeText(
          brief.markdown
        )

        setCopied(true)

        window.setTimeout(
          () =>
            setCopied(
              false
            ),
          1600
        )
      } catch {
        setFeedback({
          type: 'error',
          message:
            'O navegador não permitiu copiar.'
        })
      }
    }

  const downloadBrief =
    () => {
      if (!brief) {
        return
      }

      const url =
        URL.createObjectURL(
          new Blob(
            [
              brief.markdown
            ],
            {
              type:
                'text/markdown;charset=utf-8'
            }
          )
        )

      const anchor =
        document.createElement(
          'a'
        )

      anchor.href = url
      anchor.download =
        brief.filename

      document.body.appendChild(
        anchor
      )

      anchor.click()
      anchor.remove()

      URL.revokeObjectURL(
        url
      )
    }

  return (
    <main className="site-shell min-h-screen">
      <div className="site-bg-orb site-bg-orb-one" />
      <div className="site-bg-orb site-bg-orb-two" />
      <div className="site-bg-orb site-bg-orb-three" />
      <div className="site-grid" />
      <div className="site-noise" />

      <section className="relative z-10 px-5 pb-10 pt-6 sm:px-6 md:px-10 md:pt-8">
        <div className="mx-auto max-w-7xl">
          <header className="mb-10 flex items-center justify-between gap-4">
            <a
              href="/"
              className="brand-mark"
              aria-label="MA-Code.pt - Página inicial"
            >
              <img
                src="/ma-code.png"
                alt="MA-Code.pt"
                className="shrink-0 object-contain"
                loading="eager"
                decoding="async"
              />

              <span>
                MA-Code.pt
              </span>
            </a>

            <div className="flex items-center gap-4">
              <a
                href="/produtos"
                className="hidden text-sm font-semibold text-slate-300 transition hover:text-white sm:inline"
              >
                Produtos
              </a>

              <a
                href="/contacto?tipo=ma-seo"
                className="btn-ghost text-sm"
              >
                Contacto
              </a>
            </div>
          </header>

          <div
            className={
              mounted
                ? 'animate-fade-in-up'
                : 'opacity-0'
            }
          >
            <div className="hero-topline">
              <span className="hero-topline__dot" />

              <span>
                Briefs e pontuação de conteúdo
              </span>
            </div>

            <h1 className="mt-6 max-w-5xl text-4xl font-semibold tracking-tight text-white md:text-6xl">
              MA-SEO: conteúdo mais completo,

              <span className="bg-gradient-to-r from-cyan-200 via-sky-300 to-violet-200 bg-clip-text text-transparent">
                {' '}
                sem complicar
              </span>
              .
            </h1>

            <p className="mt-5 max-w-3xl text-base leading-8 text-slate-300 md:text-lg">
              Analise os dez resultados mais relevantes, gere um brief editorial em
              Markdown e compare o seu rascunho com os termos e tópicos recorrentes.
            </p>
          </div>
        </div>
      </section>

      <section className="relative z-10 px-5 pb-20 sm:px-6 md:px-10 md:pb-24">
        <div className="mx-auto grid max-w-7xl gap-6 xl:grid-cols-[290px_minmax(0,1fr)]">
          <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
            <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 backdrop-blur">
              <span className="section-label">
                Ação
              </span>

              <div className="mt-4 grid gap-3">
                {(
                  [
                    [
                      'brief',
                      '1. Gerar brief',
                      'Pesquisa, análise e Markdown.'
                    ],
                    [
                      'score',
                      '2. Pontuar rascunho',
                      'Cobertura e termos em falta.'
                    ]
                  ] as const
                ).map(
                  ([
                    value,
                    title,
                    description
                  ]) => (
                    <button
                      key={
                        value
                      }
                      type="button"
                      onClick={() => {
                        setMode(
                          value
                        )

                        setFeedback(
                          null
                        )
                      }}
                      className={`rounded-2xl border p-4 text-left transition ${
                        mode ===
                        value
                          ? 'border-cyan-300/40 bg-cyan-300/10'
                          : 'border-white/10 bg-white/[0.025] hover:bg-white/[0.05]'
                      }`}
                    >
                      <strong className="block text-sm text-white">
                        {title}
                      </strong>

                      <span className="mt-1 block text-xs leading-5 text-slate-500">
                        {description}
                      </span>
                    </button>
                  )
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 backdrop-blur">
              <label
                htmlFor="ma-seo-access"
                className="text-[0.68rem] font-semibold uppercase tracking-[0.17em] text-slate-500"
              >
                Código de acesso
              </label>

              <input
                id="ma-seo-access"
                type="password"
                value={
                  accessKey
                }
                onChange={(
                  event
                ) =>
                  saveAccessKey(
                    event.target
                      .value
                  )
                }
                autoComplete="off"
                placeholder="Código do Worker"
                className="mt-4 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/40"
              />

              <p className="mt-3 text-xs leading-5 text-slate-500">
                Fica apenas nesta sessão e protege os créditos das APIs.
              </p>
            </div>

            <div className="rounded-3xl border border-amber-300/15 bg-amber-300/[0.06] p-5 text-xs leading-6 text-amber-50/70">
              Alguns sites bloqueiam extração automática ou carregam o conteúdo por
              JavaScript. A ferramenta continua quando existirem pelo menos três páginas úteis.
            </div>
          </aside>

          <div className="min-w-0 space-y-6">
            <section className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 shadow-2xl shadow-slate-950/30 backdrop-blur md:p-7">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
                <div className="flex-1">
                  <label
                    htmlFor="ma-seo-keyword"
                    className="text-sm font-semibold text-white"
                  >
                    Palavra-chave principal
                  </label>

                  <input
                    id="ma-seo-keyword"
                    value={
                      keyword
                    }
                    onChange={(
                      event
                    ) =>
                      setKeyword(
                        event
                          .target
                          .value
                      )
                    }
                    maxLength={
                      160
                    }
                    placeholder="Ex.: criação de sites profissionais"
                    className="mt-3 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3.5 text-base text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/40"
                  />
                </div>

                <button
                  type="button"
                  disabled={
                    loading
                  }
                  onClick={() =>
                    void (
                      mode ===
                      'brief'
                        ? generateBrief()
                        : scoreDraft()
                    )
                  }
                  className="btn-primary hightech-button min-h-12 justify-center disabled:cursor-wait disabled:opacity-60 lg:min-w-48"
                >
                  <span className="btn-shine" />

                  <span className="relative z-10">
                    {loading
                      ? 'A processar…'
                      : mode ===
                          'brief'
                        ? 'Gerar brief SEO'
                        : 'Pontuar rascunho'}
                  </span>
                </button>
              </div>

              {feedback ? (
                <div
                  className={`mt-5 rounded-2xl border px-4 py-3 text-sm ${
                    feedback.type ===
                    'success'
                      ? 'border-emerald-300/20 bg-emerald-300/[0.07] text-emerald-100'
                      : 'border-rose-300/20 bg-rose-300/[0.07] text-rose-100'
                  }`}
                >
                  {feedback.message}
                </div>
              ) : null}
            </section>

            {mode === 'brief' ? (
              brief ? (
                <>
                  <section className="rounded-3xl border border-cyan-300/15 bg-slate-950/70 p-5 md:p-7">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.15em] text-cyan-100">
                          {brief.cached
                            ? 'Resultado em cache'
                            : 'Novo brief'}
                        </span>

                        <h2 className="mt-4 text-2xl font-semibold text-white md:text-3xl">
                          {brief.keyword}
                        </h2>

                        <p className="mt-2 text-xs text-slate-500">
                          {date(
                            brief.generatedAt
                          )}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            void copyBrief()
                          }
                          className="btn-secondary hightech-button-secondary text-sm"
                        >
                          {copied
                            ? 'Copiado'
                            : 'Copiar Markdown'}
                        </button>

                        <button
                          type="button"
                          onClick={
                            downloadBrief
                          }
                          className="btn-primary hightech-button text-sm"
                        >
                          <span className="btn-shine" />

                          <span className="relative z-10">
                            Descarregar .md
                          </span>
                        </button>
                      </div>
                    </div>

                    <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <Metric
                        label="Mediana"
                        value={`${number(
                          brief.analysis
                            .medianWordCount
                        )} palavras`}
                        detail="Extensão das páginas analisadas."
                      />

                      <Metric
                        label="Alvo"
                        value={`${number(
                          brief.analysis
                            .targetWordCount
                            .minimum
                        )}–${number(
                          brief.analysis
                            .targetWordCount
                            .maximum
                        )}`}
                        detail="Intervalo recomendado."
                      />

                      <Metric
                        label="Termos"
                        value={String(
                          brief.analysis
                            .terms.length
                        )}
                        detail="Selecionados por TF-IDF."
                      />

                      <Metric
                        label="Fontes úteis"
                        value={`${usableSources}/${brief.sources.length}`}
                        detail="Páginas com texto suficiente."
                      />
                    </div>
                  </section>

                  <section className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 md:p-7">
                    <span className="section-label">
                      Brief Markdown
                    </span>

                    <pre className="mt-5 max-h-[760px] overflow-auto whitespace-pre-wrap rounded-2xl border border-white/10 bg-black/25 p-5 font-mono text-[0.82rem] leading-7 text-slate-200">
                      {brief.markdown}
                    </pre>
                  </section>

                  <section className="grid gap-6 lg:grid-cols-2">
                    <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 md:p-7">
                      <span className="section-label">
                        Termos prioritários
                      </span>

                      <div className="mt-5 flex flex-wrap gap-2">
                        {brief.analysis.terms.map(
                          (term) => (
                            <span
                              key={
                                term.key
                              }
                              className="rounded-full border border-cyan-300/15 bg-cyan-300/[0.07] px-3 py-2 text-xs text-cyan-50"
                            >
                              {term.term}
                            </span>
                          )
                        )}
                      </div>
                    </div>

                    <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 md:p-7">
                      <span className="section-label">
                        Tópicos recorrentes
                      </span>

                      <div className="mt-5 space-y-3">
                        {brief.analysis.topics.length ? (
                          brief.analysis.topics.map(
                            (
                              topic
                            ) => (
                              <div
                                key={`${topic.level}-${topic.key}`}
                                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                              >
                                <strong className="text-sm text-white">
                                  {topic.label}
                                </strong>

                                <span className="mt-1 block text-xs text-slate-500">
                                  H{topic.level} · {topic.documents} páginas
                                </span>
                              </div>
                            )
                          )
                        ) : (
                          <p className="text-sm text-slate-500">
                            Sem títulos suficientemente recorrentes.
                          </p>
                        )}
                      </div>
                    </div>
                  </section>

                  <section className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 md:p-7">
                    <span className="section-label">
                      Fontes
                    </span>

                    <div className="mt-5 space-y-3">
                      {brief.sources.map(
                        (
                          source
                        ) => (
                          <div
                            key={`${source.position}-${source.url}`}
                            className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:flex-row sm:items-start sm:justify-between"
                          >
                            <div className="min-w-0">
                              <a
                                href={
                                  source.url
                                }
                                target="_blank"
                                rel="noreferrer"
                                className="font-medium text-white transition hover:text-cyan-200"
                              >
                                {source.position}. {source.title}
                              </a>

                              {source.error ? (
                                <span className="mt-1 block text-xs text-rose-200/70">
                                  {source.error}
                                </span>
                              ) : null}
                            </div>

                            <span
                              className={`shrink-0 rounded-full border px-3 py-1 text-xs ${
                                source.status ===
                                'analisada'
                                  ? 'border-emerald-300/15 bg-emerald-300/[0.07] text-emerald-100'
                                  : 'border-rose-300/15 bg-rose-300/[0.07] text-rose-100'
                              }`}
                            >
                              {source.status ===
                                'analisada' &&
                              source.wordCount
                                ? `${number(
                                    source.wordCount
                                  )} palavras`
                                : 'Falhou'}
                            </span>
                          </div>
                        )
                      )}
                    </div>
                  </section>
                </>
              ) : (
                <section className="rounded-3xl border border-dashed border-white/15 bg-white/[0.02] p-10 text-center">
                  <h2 className="text-xl font-semibold text-white">
                    O brief aparecerá aqui.
                  </h2>

                  <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate-500">
                    A primeira execução usa Serper e IA. Repetições exatas usam a cache.
                  </p>
                </section>
              )
            ) : (
              <>
                <section className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 md:p-7">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <span className="section-label">
                        Rascunho
                      </span>

                      <h2 className="mt-4 text-xl font-semibold text-white">
                        Cole texto ou carregue Markdown
                      </h2>
                    </div>

                    <div>
                      <input
                        ref={
                          fileInput
                        }
                        type="file"
                        accept=".md,.markdown,.txt,text/markdown,text/plain"
                        className="hidden"
                        onChange={(
                          event
                        ) =>
                          void loadDraft(
                            event
                          )
                        }
                      />

                      <button
                        type="button"
                        onClick={() =>
                          fileInput.current?.click()
                        }
                        className="btn-secondary hightech-button-secondary text-sm"
                      >
                        Carregar ficheiro
                      </button>
                    </div>
                  </div>

                  {draftFilename ? (
                    <p className="mt-4 text-xs text-cyan-100">
                      Ficheiro: {draftFilename}
                    </p>
                  ) : null}

                  <textarea
                    value={
                      draft
                    }
                    onChange={(
                      event
                    ) => {
                      setDraft(
                        event
                          .target
                          .value
                      )

                      setDraftFilename(
                        ''
                      )

                      setScore(
                        null
                      )
                    }}
                    maxLength={
                      350000
                    }
                    placeholder="# Título do artigo&#10;&#10;Cole aqui o rascunho completo..."
                    className="mt-5 min-h-[420px] w-full resize-y rounded-2xl border border-white/10 bg-black/20 p-5 font-mono text-sm leading-7 text-slate-200 outline-none placeholder:text-slate-600 focus:border-cyan-300/40"
                  />

                  <p className="mt-2 text-right text-xs text-slate-600">
                    {number(
                      draft.length
                    )} caracteres
                  </p>
                </section>

                {score ? (
                  <>
                    <section className="rounded-3xl border border-cyan-300/15 bg-slate-950/70 p-5 md:p-7">
                      <div className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)] lg:items-center">
                        <div className="rounded-3xl border border-cyan-300/20 bg-cyan-300/[0.07] p-6 text-center">
                          <span className="text-[0.66rem] font-semibold uppercase tracking-[0.17em] text-cyan-100">
                            Cobertura
                          </span>

                          <strong className="mt-2 block text-6xl font-semibold text-white">
                            {score.coverage}%
                          </strong>
                        </div>

                        <div>
                          <h2 className="text-2xl font-semibold text-white">
                            {score.keyword}
                          </h2>

                          <p className="mt-2 text-xs text-slate-500">
                            Brief de {date(score.briefGeneratedAt)}
                          </p>

                          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            <Metric
                              label="Termos"
                              value={`${score.termCoverage}%`}
                              detail={`${score.coveredTerms}/${score.totalTerms} cobertos.`}
                            />

                            <Metric
                              label="Estrutura"
                              value={`${score.outlineCoverage}%`}
                              detail={`${score.coveredTopics}/${score.totalTopics} tópicos.`}
                            />

                            <Metric
                              label="Rascunho"
                              value={number(
                                score.wordCount
                              )}
                              detail="Palavras atuais."
                            />

                            <Metric
                              label="Alvo"
                              value={`${number(
                                score.targetWordCount.minimum
                              )}–${number(
                                score.targetWordCount.maximum
                              )}`}
                              detail="Palavras recomendadas."
                            />
                          </div>
                        </div>
                      </div>
                    </section>

                    <section className="grid gap-6 lg:grid-cols-2">
                      <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 md:p-7">
                        <span className="section-label">
                          Termos em falta
                        </span>

                        {score.missingTerms.length ? (
                          <div className="mt-5 overflow-x-auto">
                            <table className="w-full text-left text-sm">
                              <thead className="text-[0.66rem] uppercase tracking-[0.14em] text-slate-500">
                                <tr>
                                  <th className="pb-3 pr-3">
                                    Termo
                                  </th>

                                  <th className="pb-3 pr-3">
                                    Páginas
                                  </th>

                                  <th className="pb-3">
                                    Prioridade
                                  </th>
                                </tr>
                              </thead>

                              <tbody className="divide-y divide-white/[0.06]">
                                {score.missingTerms.map(
                                  (
                                    term
                                  ) => (
                                    <tr
                                      key={
                                        term.term
                                      }
                                    >
                                      <td className="py-3 pr-3 font-medium text-white">
                                        {term.term}
                                      </td>

                                      <td className="py-3 pr-3 text-slate-500">
                                        {term.documents}
                                      </td>

                                      <td className="py-3 text-slate-500">
                                        {term.priority}
                                      </td>
                                    </tr>
                                  )
                                )}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="mt-5 text-sm text-emerald-100">
                            Todos os termos prioritários estão cobertos.
                          </p>
                        )}
                      </div>

                      <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 md:p-7">
                        <span className="section-label">
                          Tópicos em falta
                        </span>

                        <div className="mt-5 space-y-3">
                          {score.missingTopics.length ? (
                            score.missingTopics.map(
                              (
                                topic
                              ) => (
                                <div
                                  key={`${topic.level}-${topic.label}`}
                                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                                >
                                  <strong className="text-sm text-white">
                                    {topic.label}
                                  </strong>

                                  <span className="mt-1 block text-xs text-slate-500">
                                    H{topic.level} · {topic.documents} páginas
                                  </span>
                                </div>
                              )
                            )
                          ) : (
                            <p className="text-sm text-emerald-100">
                              Todos os tópicos recorrentes estão cobertos.
                            </p>
                          )}
                        </div>
                      </div>
                    </section>
                  </>
                ) : (
                  <section className="rounded-3xl border border-dashed border-white/15 bg-white/[0.02] p-10 text-center">
                    <h2 className="text-xl font-semibold text-white">
                      A pontuação aparecerá aqui.
                    </h2>

                    <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate-500">
                      Use a mesma palavra-chave do brief já guardado.
                    </p>
                  </section>
                )}
              </>
            )}

            <section className="rounded-3xl border border-white/10 bg-slate-950/65 p-5 text-sm leading-7 text-slate-400 md:p-7">
              A pontuação combina 75% de cobertura dos termos TF-IDF com 25% de
              cobertura dos tópicos H2/H3. É uma orientação editorial e não uma
              garantia de posicionamento nos motores de pesquisa.
            </section>
          </div>
        </div>
      </section>
    </main>
  )
}
