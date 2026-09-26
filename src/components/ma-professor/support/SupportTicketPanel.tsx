import {
  useCallback,
  useEffect,
  useState
} from 'react'

import {
  createSupportTicket,
  getSupportTicket,
  listSupportTickets,
  replySupportTicket,
  type SupportTicket,
  type SupportTicketCategory,
  type SupportTicketMessage,
  type SupportTicketStatus
} from './supportTicketClient'

const CATEGORY_OPTIONS:
  Array<{
    value: SupportTicketCategory
    label: string
  }> = [
    {
      value: 'getting-started',
      label: 'Começar e configurar'
    },
    {
      value: 'daily-work',
      label: 'Sumários e trabalho diário'
    },
    {
      value: 'planning',
      label: 'Planificações e UFCDs'
    },
    {
      value: 'attendance',
      label: 'Faltas e recuperações'
    },
    {
      value: 'security',
      label: 'Segurança e cópias'
    },
    {
      value: 'technical',
      label: 'Problema técnico'
    },
    {
      value: 'other',
      label: 'Outro assunto'
    }
  ]

const STATUS_LABELS:
  Record<
    SupportTicketStatus,
    string
  > = {
    new: 'Recebido',
    in_review: 'Em análise',
    waiting_professor:
      'Aguarda a sua resposta',
    resolved: 'Resolvido',
    closed: 'Fechado'
  }

function formatDate(
  value: string
) {
  const date = new Date(value)

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return ''
  }

  return new Intl.DateTimeFormat(
    'pt-PT',
    {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }
  ).format(date)
}

function getErrorMessage(
  error: unknown
) {
  return error instanceof Error &&
    error.message
    ? error.message
    : 'Não foi possível concluir a operação.'
}

interface SupportTicketPanelProps {
  suggestedCategory?:
    SupportTicketCategory
}

export function SupportTicketPanel({
  suggestedCategory = 'technical'
}: SupportTicketPanelProps) {
  const [
    tickets,
    setTickets
  ] =
    useState<SupportTicket[]>([])
  const [
    loading,
    setLoading
  ] = useState(true)
  const [
    error,
    setError
  ] = useState('')
  const [
    createOpen,
    setCreateOpen
  ] = useState(false)
  const [
    category,
    setCategory
  ] =
    useState<SupportTicketCategory>(
      suggestedCategory
    )
  const [
    subject,
    setSubject
  ] = useState('')
  const [
    message,
    setMessage
  ] = useState('')
  const [
    submitting,
    setSubmitting
  ] = useState(false)
  const [
    selectedId,
    setSelectedId
  ] = useState<string | null>(null)
  const [
    selectedTicket,
    setSelectedTicket
  ] =
    useState<SupportTicket | null>(
      null
    )
  const [
    messages,
    setMessages
  ] =
    useState<SupportTicketMessage[]>([])
  const [
    detailLoading,
    setDetailLoading
  ] = useState(false)
  const [
    reply,
    setReply
  ] = useState('')
  const [
    replySending,
    setReplySending
  ] = useState(false)

  const loadTickets =
    useCallback(
      async () => {
        setLoading(true)
        setError('')

        try {
          const result =
            await listSupportTickets()
          setTickets(
            result.tickets
          )
        } catch (loadError) {
          setError(
            getErrorMessage(
              loadError
            )
          )
        } finally {
          setLoading(false)
        }
      },
      []
    )

  const openTicket =
    useCallback(
      async (
        ticketId: string
      ) => {
        setSelectedId(ticketId)
        setDetailLoading(true)
        setError('')

        try {
          const result =
            await getSupportTicket(
              ticketId
            )
          setSelectedTicket(
            result.ticket
          )
          setMessages(
            result.messages
          )
        } catch (loadError) {
          setError(
            getErrorMessage(
              loadError
            )
          )
        } finally {
          setDetailLoading(false)
        }
      },
      []
    )

  useEffect(
    () => {
      void loadTickets()
    },
    [loadTickets]
  )

  useEffect(
    () => {
      if (!createOpen) {
        setCategory(
          suggestedCategory
        )
      }
    },
    [
      createOpen,
      suggestedCategory
    ]
  )

  const submitTicket =
    async () => {
      if (
        subject.trim().length < 4 ||
        message.trim().length < 8
      ) {
        setError(
          'Indique um assunto e explique brevemente o que está a acontecer.'
        )
        return
      }

      setSubmitting(true)
      setError('')

      try {
        const result =
          await createSupportTicket(
            category,
            subject,
            message
          )
        setSubject('')
        setMessage('')
        setCreateOpen(false)
        await loadTickets()
        await openTicket(
          result.ticket.id
        )
      } catch (submitError) {
        setError(
          getErrorMessage(
            submitError
          )
        )
      } finally {
        setSubmitting(false)
      }
    }

  const sendReply =
    async () => {
      if (
        !selectedId ||
        !reply.trim()
      ) {
        return
      }

      setReplySending(true)
      setError('')

      try {
        const result =
          await replySupportTicket(
            selectedId,
            reply
          )
        setSelectedTicket(
          result.ticket
        )
        setMessages(
          result.messages
        )
        setReply('')
        await loadTickets()
      } catch (replyError) {
        setError(
          getErrorMessage(
            replyError
          )
        )
      } finally {
        setReplySending(false)
      }
    }

  return (
    <div className="mt-6 space-y-4">
      <div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.04] p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan-300">
              Apoio
            </p>
            <h3 className="mt-2 text-lg font-black text-white">
              Não encontrou solução?
            </h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Pode enviar um pedido e acompanhar aqui todas as respostas. O ticket não recebe automaticamente alunos, turmas, avaliações, faltas, sumários, planificações, ficheiros, IndexedDB ou passwords.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setCreateOpen(
                current =>
                  !current
              )
            }}
            className="rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-black text-slate-950 transition hover:bg-cyan-200"
          >
            {createOpen
              ? 'Cancelar pedido'
              : 'Pedir ajuda'}
          </button>
        </div>

        {createOpen ? (
          <div className="mt-5 border-t border-white/10 pt-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-xs font-black text-slate-300">
                  Área
                </span>
                <select
                  value={category}
                  onChange={event =>
                    setCategory(
                      event.target.value as
                        SupportTicketCategory
                    )
                  }
                  className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm font-semibold text-white outline-none focus:border-cyan-300/40"
                >
                  {CATEGORY_OPTIONS.map(
                    option => (
                      <option
                        key={option.value}
                        value={option.value}
                      >
                        {option.label}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-black text-slate-300">
                  Assunto
                </span>
                <input
                  value={subject}
                  onChange={event =>
                    setSubject(
                      event.target.value
                    )
                  }
                  maxLength={160}
                  placeholder="Ex.: A previsão da UFCD não aparece"
                  className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm font-semibold text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/40"
                />
              </label>
            </div>

            <label className="mt-4 block">
              <span className="mb-2 block text-xs font-black text-slate-300">
                O que está a acontecer?
              </span>
              <textarea
                value={message}
                onChange={event =>
                  setMessage(
                    event.target.value
                  )
                }
                maxLength={5000}
                rows={5}
                placeholder="Explique o que esperava que acontecesse e o que aconteceu realmente."
                className="w-full resize-y rounded-xl border border-white/10 bg-slate-950 px-3 py-3 text-sm leading-6 text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/40"
              />
            </label>

            <div className="mt-3 rounded-xl border border-amber-300/15 bg-amber-300/[0.05] px-3 py-3 text-xs leading-5 text-amber-100">
              Não inclua nomes de alunos, classificações, emails de terceiros, números de identificação, dados de saúde, passwords ou outros dados pessoais desnecessários.
            </div>

            <button
              type="button"
              disabled={submitting}
              onClick={() => {
                void submitTicket()
              }}
              className="mt-4 rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-black text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting
                ? 'A enviar…'
                : 'Enviar pedido de apoio'}
            </button>
          </div>
        ) : null}
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-rose-300/20 bg-rose-300/[0.06] px-4 py-3 text-sm text-rose-100"
        >
          {error}
        </div>
      ) : null}

      <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              Os meus pedidos
            </p>
            <p className="mt-1 text-sm text-slate-400">
              Acompanhe as respostas sem depender do email.
            </p>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              void loadTickets()
            }}
            className="rounded-lg border border-white/10 px-3 py-2 text-xs font-black text-slate-400 transition hover:bg-white/5 hover:text-white disabled:opacity-50"
          >
            Atualizar
          </button>
        </div>

        {loading && tickets.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            A carregar pedidos…
          </p>
        ) : tickets.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            Ainda não tem pedidos de apoio.
          </p>
        ) : (
          <div className="mt-4 space-y-2">
            {tickets.map(ticket => (
              <button
                key={ticket.id}
                type="button"
                onClick={() => {
                  void openTicket(
                    ticket.id
                  )
                }}
                className="w-full rounded-xl border border-white/10 bg-white/[0.025] px-4 py-3 text-left transition hover:border-cyan-300/20 hover:bg-white/[0.04]"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-white">
                      {ticket.subject}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {ticket.id
                        .replace(
                          'ticket-',
                          '#'
                        )
                        .slice(0, 13)}
                      {' · '}
                      {formatDate(
                        ticket.updatedAt
                      )}
                    </p>
                  </div>
                  <span className="rounded-full border border-white/10 px-2.5 py-1 text-[0.68rem] font-black text-slate-300">
                    {STATUS_LABELS[
                      ticket.status
                    ]}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedId ? (
        <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 sm:p-5">
          {detailLoading ? (
            <p className="text-sm text-slate-500">
              A abrir pedido…
            </p>
          ) : selectedTicket ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan-300">
                    {STATUS_LABELS[
                      selectedTicket.status
                    ]}
                  </p>
                  <h3 className="mt-1 text-lg font-black text-white">
                    {selectedTicket.subject}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(null)
                    setSelectedTicket(null)
                    setMessages([])
                    setReply('')
                  }}
                  className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-black text-slate-400 hover:bg-white/5 hover:text-white"
                >
                  Fechar
                </button>
              </div>

              <div className="mt-5 space-y-3">
                {messages.map(item => (
                  <div
                    key={item.id}
                    className={`rounded-xl border p-3 ${
                      item.authorRole ===
                      'admin'
                        ? 'border-cyan-300/15 bg-cyan-300/[0.04]'
                        : 'border-white/10 bg-white/[0.025]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-black text-slate-300">
                        {item.authorRole ===
                        'admin'
                          ? 'Apoio MA-Professor'
                          : 'Você'}
                      </p>
                      <p className="text-[0.68rem] text-slate-600">
                        {formatDate(
                          item.createdAt
                        )}
                      </p>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">
                      {item.body}
                    </p>
                  </div>
                ))}
              </div>

              {selectedTicket.status !==
              'closed' ? (
                <div className="mt-5 border-t border-white/10 pt-4">
                  <textarea
                    value={reply}
                    onChange={event =>
                      setReply(
                        event.target.value
                      )
                    }
                    maxLength={5000}
                    rows={3}
                    placeholder="Responder ao apoio…"
                    className="w-full resize-y rounded-xl border border-white/10 bg-slate-950 px-3 py-3 text-sm leading-6 text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/40"
                  />
                  <button
                    type="button"
                    disabled={
                      replySending ||
                      !reply.trim()
                    }
                    onClick={() => {
                      void sendReply()
                    }}
                    className="mt-3 rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-black text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {replySending
                      ? 'A enviar…'
                      : 'Enviar resposta'}
                  </button>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
