import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from 'react'

import type {
  SupportTicketMessage,
  SupportTicketStatus
} from '../../ma-professor/support/supportTicketClient'

import {
  getAdminSupportTicket,
  listAdminSupportTickets,
  replyAdminSupportTicket,
  setAdminSupportTicketStatus,
  type AdminSupportTicket
} from '../../../lib/admin/maProfessorSupportTicketAdminApi'

const STATUS_LABELS:
  Record<SupportTicketStatus, string> = {
    new: 'Novo',
    in_review: 'Em análise',
    waiting_professor:
      'Aguarda professor',
    resolved: 'Resolvido',
    closed: 'Fechado'
  }

const STATUS_OPTIONS:
  SupportTicketStatus[] = [
    'new',
    'in_review',
    'waiting_professor',
    'resolved',
    'closed'
  ]

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

export default function MAProfessorSupportTickets() {
  const [tickets, setTickets] =
    useState<AdminSupportTicket[]>([])
  const [loading, setLoading] =
    useState(true)
  const [available, setAvailable] =
    useState<boolean | null>(null)
  const [error, setError] =
    useState('')
  const [selected, setSelected] =
    useState<AdminSupportTicket | null>(
      null
    )
  const [messages, setMessages] =
    useState<SupportTicketMessage[]>([])
  const [detailLoading, setDetailLoading] =
    useState(false)
  const [reply, setReply] =
    useState('')
  const [saving, setSaving] =
    useState(false)

  const loadTickets =
    useCallback(
      async () => {
        setLoading(true)
        setError('')

        try {
          const result =
            await listAdminSupportTickets()

          setAvailable(true)
          setTickets(
            result.tickets
          )
        } catch {
          // The support subsystem is additive. If its D1 schema is
          // not ready yet, the rest of MA-Admin must stay healthy.
          setAvailable(false)
          setTickets([])
          setSelected(null)
          setMessages([])
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
        if (available !== true) {
          return
        }

        setDetailLoading(true)
        setError('')

        try {
          const result =
            await getAdminSupportTicket(
              ticketId
            )
          setSelected(
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
      [available]
    )

  useEffect(
    () => {
      void loadTickets()
    },
    [loadTickets]
  )

  const counts =
    useMemo(
      () => ({
        new:
          tickets.filter(
            ticket =>
              ticket.status === 'new'
          ).length,
        active:
          tickets.filter(
            ticket =>
              ticket.status ===
                'in_review' ||
              ticket.status ===
                'waiting_professor'
          ).length,
        resolved:
          tickets.filter(
            ticket =>
              ticket.status ===
                'resolved'
          ).length
      }),
      [tickets]
    )

  const sendReply =
    async () => {
      if (
        available !== true ||
        !selected ||
        !reply.trim()
      ) {
        return
      }

      setSaving(true)
      setError('')

      try {
        const result =
          await replyAdminSupportTicket(
            selected.id,
            reply
          )
        setSelected(
          result.ticket
        )
        setMessages(
          result.messages
        )
        setReply('')
        await loadTickets()
      } catch (saveError) {
        setError(
          getErrorMessage(
            saveError
          )
        )
      } finally {
        setSaving(false)
      }
    }

  const changeStatus =
    async (
      status: SupportTicketStatus
    ) => {
      if (
        available !== true ||
        !selected
      ) {
        return
      }

      setSaving(true)
      setError('')

      try {
        const result =
          await setAdminSupportTicketStatus(
            selected.id,
            status
          )

        if (result.ticket) {
          setSelected(
            result.ticket
          )
        }

        await loadTickets()
      } catch (saveError) {
        setError(
          getErrorMessage(
            saveError
          )
        )
      } finally {
        setSaving(false)
      }
    }

  return (
    <section className="mt-7 rounded-[1.75rem] border border-white/10 bg-slate-900/55 p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
            Suporte
          </p>
          <h2 className="mt-1 text-2xl font-black text-white">
            Pedidos de apoio
          </h2>
          <p className="mt-2 max-w-3xl text-xs leading-5 text-slate-500">
            Conversas de apoio separadas dos dados escolares. Não existem anexos nem recolha automática de IndexedDB nesta versão.
          </p>
        </div>

        {available === true ? (
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              void loadTickets()
            }}
            className="rounded-xl border border-white/10 px-3 py-2 text-xs font-black text-slate-400 transition hover:bg-white/5 hover:text-white disabled:opacity-50"
          >
            Atualizar
          </button>
        ) : null}
      </div>

      {available === false ? (
        <div className="mt-5 rounded-xl border border-amber-300/15 bg-amber-300/[0.05] p-4">
          <p className="text-sm font-black text-amber-100">
            Pedidos de apoio ainda não disponíveis neste ambiente
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-400">
            O restante MA-Admin continua normal. Para ativar os tickets, é necessário aplicar a migração D1 0004_support_tickets.sql.
          </p>
        </div>
      ) : null}

      {available === true ? (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-slate-950/55 p-3">
              <p className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-slate-500">
                Novos
              </p>
              <p className="mt-1 text-2xl font-black text-white">
                {counts.new}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-950/55 p-3">
              <p className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-slate-500">
                Em curso
              </p>
              <p className="mt-1 text-2xl font-black text-white">
                {counts.active}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-950/55 p-3">
              <p className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-slate-500">
                Resolvidos
              </p>
              <p className="mt-1 text-2xl font-black text-white">
                {counts.resolved}
              </p>
            </div>
          </div>

          {error ? (
            <div
              role="alert"
              className="mt-4 rounded-xl border border-rose-300/20 bg-rose-300/[0.06] px-4 py-3 text-sm text-rose-100"
            >
              {error}
            </div>
          ) : null}

          <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="space-y-2">
              {loading &&
              tickets.length === 0 ? (
                <p className="text-sm text-slate-500">
                  A carregar pedidos…
                </p>
              ) : tickets.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Ainda não existem pedidos de apoio.
                </p>
              ) : (
                tickets.map(ticket => (
                  <button
                    key={ticket.id}
                    type="button"
                    onClick={() => {
                      void openTicket(
                        ticket.id
                      )
                    }}
                    className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                      selected?.id ===
                      ticket.id
                        ? 'border-cyan-300/25 bg-cyan-300/[0.05]'
                        : 'border-white/10 bg-slate-950/45 hover:bg-white/[0.035]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-white">
                          {ticket.subject}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {ticket.category}
                          {' · '}
                          {formatDate(
                            ticket.updatedAt
                          )}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full border border-white/10 px-2 py-1 text-[0.65rem] font-black text-slate-300">
                        {STATUS_LABELS[
                          ticket.status
                        ]}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>

            <div className="min-h-64 rounded-xl border border-white/10 bg-slate-950/55 p-4">
              {detailLoading ? (
                <p className="text-sm text-slate-500">
                  A abrir pedido…
                </p>
              ) : selected ? (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-black text-white">
                        {selected.subject}
                      </h3>
                      <p className="mt-1 text-xs text-slate-500">
                        Conta{' '}
                        {selected.accountId
                          .slice(-10)}
                        {' · '}
                        {selected.context.screen ||
                          'ecrã desconhecido'}
                      </p>
                    </div>
                    <select
                      value={selected.status}
                      disabled={saving}
                      onChange={event => {
                        void changeStatus(
                          event.target.value as
                            SupportTicketStatus
                        )
                      }}
                      className="rounded-lg border border-white/10 bg-slate-900 px-2.5 py-2 text-xs font-black text-white outline-none"
                    >
                      {STATUS_OPTIONS.map(
                        status => (
                          <option
                            key={status}
                            value={status}
                          >
                            {STATUS_LABELS[
                              status
                            ]}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <div className="mt-4 space-y-3">
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
                              ? 'Apoio'
                              : 'Professor'}
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

                  {selected.status !==
                  'closed' ? (
                    <div className="mt-4 border-t border-white/10 pt-4">
                      <textarea
                        value={reply}
                        onChange={event =>
                          setReply(
                            event.target.value
                          )
                        }
                        maxLength={5000}
                        rows={3}
                        placeholder="Responder ao professor…"
                        className="w-full resize-y rounded-xl border border-white/10 bg-slate-950 px-3 py-3 text-sm leading-6 text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/40"
                      />
                      <button
                        type="button"
                        disabled={
                          saving ||
                          !reply.trim()
                        }
                        onClick={() => {
                          void sendReply()
                        }}
                        className="mt-3 rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-black text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {saving
                          ? 'A guardar…'
                          : 'Responder'}
                      </button>
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-slate-500">
                  Selecione um pedido para consultar a conversa.
                </p>
              )}
            </div>
          </div>
        </>
      ) : null}
    </section>
  )
}
