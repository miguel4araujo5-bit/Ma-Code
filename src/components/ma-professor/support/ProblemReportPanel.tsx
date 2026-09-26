import {
  useMemo,
  useState
} from 'react'

import {
  helpCategories,
  searchHelpArticles,
  type HelpCategoryId
} from './helpKnowledgeBase'

import {
  ProblemReportDialog
} from './ProblemReportDialog'

import {
  SupportTicketPanel
} from './SupportTicketPanel'

import type {
  SupportTicketCategory
} from './supportTicketClient'

type CategoryFilter =
  HelpCategoryId | 'all'

export function ProblemReportPanel() {
  const [
    reportOpen,
    setReportOpen
  ] =
    useState(false)

  const [
    query,
    setQuery
  ] =
    useState('')

  const [
    category,
    setCategory
  ] =
    useState<CategoryFilter>('all')

  const articles =
    useMemo(
      () =>
        searchHelpArticles(
          query,
          category
        ),
      [
        category,
        query
      ]
    )

  const suggestedTicketCategory:
    SupportTicketCategory =
      category === 'all'
        ? 'technical'
        : category

  return (
    <section
      className="rounded-3xl border border-white/10 bg-slate-900/70 p-5 sm:p-6"
      data-ma-professor-help-support
    >
      <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
        Ajuda e suporte
      </p>

      <h2 className="mt-2 text-2xl font-black text-white">
        Como podemos ajudar?
      </h2>

      <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
        Procure primeiro uma solução na base de ajuda. Nada é enviado automaticamente ao pesquisar ou abrir um artigo.
      </p>

      <label className="mt-5 block">
        <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-400">
          Procurar uma solução
        </span>

        <input
          type="search"
          value={query}
          onChange={event =>
            setQuery(
              event.target.value
            )
          }
          placeholder="Ex.: conclusão da UFCD, faltas, password…"
          className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm font-semibold text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/40"
        />
      </label>

      <div
        className="mt-4 flex flex-wrap gap-2"
        aria-label="Categorias da base de ajuda"
      >
        <button
          type="button"
          onClick={() =>
            setCategory('all')
          }
          aria-pressed={category === 'all'}
          className={`rounded-full border px-3 py-2 text-xs font-black transition ${
            category === 'all'
              ? 'border-cyan-300/30 bg-cyan-300/10 text-cyan-100'
              : 'border-white/10 bg-white/[0.03] text-slate-400 hover:text-white'
          }`}
        >
          Todas
        </button>

        {helpCategories.map(item => (
          <button
            key={item.id}
            type="button"
            onClick={() =>
              setCategory(
                item.id
              )
            }
            aria-pressed={category === item.id}
            className={`rounded-full border px-3 py-2 text-xs font-black transition ${
              category === item.id
                ? 'border-cyan-300/30 bg-cyan-300/10 text-cyan-100'
                : 'border-white/10 bg-white/[0.03] text-slate-400 hover:text-white'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-3">
        {articles.length > 0 ? (
          articles.map(article => {
            const articleCategory =
              helpCategories.find(
                item =>
                  item.id ===
                  article.categoryId
              )

            return (
              <details
                key={article.id}
                className="group rounded-2xl border border-white/10 bg-slate-950/55 p-4 open:border-cyan-300/20 open:bg-slate-950/80"
              >
                <summary className="cursor-pointer list-none pr-2">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-[0.65rem] font-black uppercase tracking-[0.14em] text-cyan-300">
                        {articleCategory?.label ?? 'Ajuda'}
                      </p>

                      <h3 className="mt-1 text-base font-black text-white">
                        {article.title}
                      </h3>

                      <p className="mt-2 text-sm leading-6 text-slate-400">
                        {article.summary}
                      </p>
                    </div>

                    <span
                      aria-hidden="true"
                      className="mt-1 shrink-0 text-lg font-black text-slate-500 transition group-open:rotate-45 group-open:text-cyan-200"
                    >
                      +
                    </span>
                  </div>
                </summary>

                <div className="mt-4 border-t border-white/10 pt-4">
                  <ol className="space-y-3">
                    {article.steps.map((step, index) => (
                      <li
                        key={`${article.id}-${index}`}
                        className="flex gap-3 text-sm leading-6 text-slate-300"
                      >
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-cyan-300/20 bg-cyan-300/10 text-[0.7rem] font-black text-cyan-200">
                          {index + 1}
                        </span>

                        <span>
                          {step}
                        </span>
                      </li>
                    ))}
                  </ol>

                  {article.note ? (
                    <p className="mt-4 rounded-xl border border-amber-300/15 bg-amber-300/[0.05] px-3 py-2.5 text-sm leading-6 text-amber-100">
                      {article.note}
                    </p>
                  ) : null}
                </div>
              </details>
            )
          })
        ) : (
          <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-5 text-center">
            <p className="text-sm font-black text-white">
              Não encontrámos uma solução correspondente.
            </p>

            <p className="mt-2 text-sm leading-6 text-slate-400">
              Tente outras palavras ou envie um pedido de apoio abaixo se o problema continuar.
            </p>
          </div>
        )}
      </div>

      <SupportTicketPanel
        suggestedCategory={
          suggestedTicketCategory
        }
      />

      <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/60 p-4 sm:p-5">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
          Diagnóstico técnico
        </p>

        <h3 className="mt-2 text-lg font-black text-white">
          Reportar um erro da aplicação
        </h3>

        <p className="mt-2 text-sm leading-6 text-slate-400">
          Este relatório técnico continua separado dos pedidos de apoio. Use-o para erros ou falhas da aplicação. Apenas inclui um resumo técnico, a versão da aplicação, o ecrã atual, o navegador e a data. Não são recolhidos automaticamente dados escolares, ficheiros, conteúdos do IndexedDB ou passwords.
        </p>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          Antes de enviar, não inclua nomes de alunos, classificações, emails, números de identificação, passwords ou outros dados pessoais na mensagem opcional.
        </p>

        <button
          type="button"
          onClick={() => {
            setReportOpen(
              true
            )
          }}
          className="mt-4 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-black text-slate-300 transition hover:bg-white/5 hover:text-white"
        >
          Reportar problema técnico
        </button>
      </div>

      <ProblemReportDialog
        open={
          reportOpen
        }
        errorSummary="Problema reportado manualmente."
        onClose={() => {
          setReportOpen(
            false
          )
        }}
      />
    </section>
  )
}
