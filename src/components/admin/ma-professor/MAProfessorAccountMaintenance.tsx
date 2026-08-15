import {
  useEffect,
  useMemo,
  useState
} from 'react'

import {
  deleteMAProfessorAccounts,
  resetMAProfessorAccountAccess
} from '../../../lib/admin/maProfessorAccountAdminApi'

import type {
  MAProfessorAdminOverview
} from '../../../lib/admin/maProfessorAdminApi'

interface MAProfessorAccountMaintenanceProps {
  overview:
    MAProfessorAdminOverview | null
  loading?: boolean
  onChanged:
    () => Promise<void>
}

interface AccountRow {
  email: string
  requestStatus: string
  licenseStatus: string
  renewals: number
}

function getErrorMessage(
  error: unknown
) {
  return error instanceof Error &&
    error.message
    ? error.message
    : 'Não foi possível concluir a operação.'
}

function requestStatusLabel(
  status: string
) {
  switch (status) {
    case 'approved':
      return 'Aprovado'

    case 'rejected':
      return 'Rejeitado'

    case 'pending':
      return 'Pendente'

    default:
      return '—'
  }
}

function licenseStatusLabel(
  status: string
) {
  switch (status) {
    case 'active':
      return 'Ativa'

    case 'expiring':
      return 'A terminar'

    case 'renewal_pending':
      return 'Renovação pendente'

    case 'expired':
      return 'Expirada'

    case 'revoked':
      return 'Revogada'

    default:
      return '—'
  }
}

export default function MAProfessorAccountMaintenance({
  overview,
  loading = false,
  onChanged
}: MAProfessorAccountMaintenanceProps) {
  const users =
    useMemo<AccountRow[]>(
      () => {
        if (!overview) {
          return []
        }

        const byEmail =
          new Map<
            string,
            AccountRow
          >()

        const ensure =
          (email: string) => {
            const normalized =
              email
                .trim()
                .toLowerCase()

            const existing =
              byEmail.get(
                normalized
              )

            if (existing) {
              return existing
            }

            const row:
              AccountRow = {
                email:
                  normalized,
                requestStatus:
                  '',
                licenseStatus:
                  '',
                renewals:
                  0
              }

            byEmail.set(
              normalized,
              row
            )

            return row
          }

        for (
          const request of
          overview.accessRequests
        ) {
          ensure(
            request.email
          ).requestStatus =
            request.status
        }

        for (
          const license of
          overview.licenses
        ) {
          ensure(
            license.email
          ).licenseStatus =
            license.status
        }

        for (
          const renewal of
          overview.renewals
        ) {
          ensure(
            renewal.email
          ).renewals += 1
        }

        return Array.from(
          byEmail.values()
        ).sort(
          (left, right) =>
            left.email.localeCompare(
              right.email
            )
        )
      },
      [overview]
    )

  const [
    selectedEmails,
    setSelectedEmails
  ] = useState<string[]>([])

  const [
    deleteDialogOpen,
    setDeleteDialogOpen
  ] = useState(false)

  const [
    deleteConfirmation,
    setDeleteConfirmation
  ] = useState('')

  const [
    busy,
    setBusy
  ] = useState(false)

  const [
    busyEmail,
    setBusyEmail
  ] = useState<string | null>(
    null
  )

  const [
    feedback,
    setFeedback
  ] = useState<{
    tone: 'success' | 'error'
    message: string
  } | null>(null)

  const selectedSet =
    useMemo(
      () =>
        new Set(
          selectedEmails
        ),
      [selectedEmails]
    )

  const allSelected =
    users.length > 0 &&
    users.every(
      user =>
        selectedSet.has(
          user.email
        )
    )

  useEffect(
    () => {
      const available =
        new Set(
          users.map(
            user =>
              user.email
          )
        )

      setSelectedEmails(
        current =>
          current.filter(
            email =>
              available.has(
                email
              )
          )
      )
    },
    [users]
  )

  const toggleUser =
    (email: string) => {
      setSelectedEmails(
        current =>
          current.includes(
            email
          )
            ? current.filter(
                item =>
                  item !== email
              )
            : [
                ...current,
                email
              ]
      )
    }

  const toggleAll = () => {
    setSelectedEmails(
      allSelected
        ? []
        : users.map(
            user =>
              user.email
          )
    )
  }

  const handleResetAccess =
    async (
      email: string
    ) => {
      const confirmed =
        window.confirm(
          `Repor o acesso de ${email}?\n\nEsta ação remove pedido, licença, sessões, senhas de ativação, password pessoal, renovações e autorizações de acesso. A cópia cifrada dos dados escolares na cloud não é eliminada.`
        )

      if (!confirmed) {
        return
      }

      setFeedback(null)
      setBusyEmail(email)

      try {
        const result =
          await resetMAProfessorAccountAccess(
            email
          )

        setSelectedEmails(
          current =>
            current.filter(
              item =>
                item !== email
            )
        )

        setFeedback({
          tone:
            'success',
          message:
            result.message
        })

        await onChanged()
      } catch (
        error
      ) {
        setFeedback({
          tone:
            'error',
          message:
            getErrorMessage(
              error
            )
        })
      } finally {
        setBusyEmail(null)
      }
    }

  const openDeleteDialog = () => {
    if (
      selectedEmails.length ===
        0 ||
      busy ||
      Boolean(
        busyEmail
      )
    ) {
      return
    }

    setFeedback(null)
    setDeleteConfirmation('')
    setDeleteDialogOpen(true)
  }

  const closeDeleteDialog = () => {
    if (busy) {
      return
    }

    setDeleteDialogOpen(false)
    setDeleteConfirmation('')
  }

  const handleDeleteSelected =
    async () => {
      if (
        deleteConfirmation !==
          'APAGAR' ||
        selectedEmails.length ===
          0
      ) {
        return
      }

      setBusy(true)
      setFeedback(null)

      try {
        const result =
          await deleteMAProfessorAccounts(
            selectedEmails,
            deleteConfirmation
          )

        setSelectedEmails([])
        setDeleteDialogOpen(false)
        setDeleteConfirmation('')

        setFeedback({
          tone:
            'success',
          message:
            result.message
        })

        await onChanged()
      } catch (
        error
      ) {
        setFeedback({
          tone:
            'error',
          message:
            getErrorMessage(
              error
            )
        })
      } finally {
        setBusy(false)
      }
    }

  return (
    <section className="mt-7 rounded-[1.75rem] border border-rose-300/15 bg-slate-900/55 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-rose-300">
            Utilizadores
          </p>

          <h2 className="mt-2 text-xl font-black">
            Repor ou apagar contas
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Utilize “Repor acesso” para voltar a testar uma conta sem eliminar a cópia cifrada dos dados escolares. A eliminação remove também os dados cloud associados ao email selecionado.
          </p>
        </div>

        <span className="rounded-full border border-white/10 bg-slate-950/50 px-3 py-1.5 text-xs font-black text-slate-400">
          {users.length}{' '}
          {users.length === 1
            ? 'utilizador'
            : 'utilizadores'}
        </span>
      </div>

      {feedback ? (
        <div
          role={
            feedback.tone ===
            'error'
              ? 'alert'
              : 'status'
          }
          className={[
            'mt-5 rounded-2xl border p-4 text-sm font-semibold',
            feedback.tone ===
            'success'
              ? 'border-emerald-300/20 bg-emerald-300/[0.06] text-emerald-200'
              : 'border-rose-300/20 bg-rose-300/[0.06] text-rose-200'
          ].join(' ')}
        >
          {feedback.message}
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/35 p-3">
        <label className="flex cursor-pointer items-center gap-3 text-sm font-black text-slate-300">
          <input
            type="checkbox"
            checked={allSelected}
            disabled={
              loading ||
              busy ||
              Boolean(
                busyEmail
              ) ||
              users.length === 0
            }
            onChange={toggleAll}
            className="h-4 w-4 rounded border-white/20 bg-slate-950 accent-cyan-300"
          />
          Selecionar todos
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-bold text-slate-500">
            {selectedEmails.length}{' '}
            selecionado(s)
          </span>

          <button
            type="button"
            disabled={
              selectedEmails.length ===
                0 ||
              busy ||
              Boolean(
                busyEmail
              )
            }
            onClick={openDeleteDialog}
            className="rounded-xl border border-rose-300/30 bg-rose-300/10 px-4 py-2 text-xs font-black text-rose-200 transition hover:bg-rose-300/15 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Apagar selecionados
          </button>
        </div>
      </div>

      {users.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/35 p-6 text-center">
          <p className="text-sm font-black text-slate-300">
            Não existem utilizadores para gerir.
          </p>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10">
          <table className="min-w-full divide-y divide-white/10 text-left text-sm">
            <thead className="bg-slate-950/55 text-[0.68rem] font-black uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="w-12 px-4 py-3">
                  <span className="sr-only">
                    Seleção
                  </span>
                </th>
                <th className="px-4 py-3">
                  Email
                </th>
                <th className="px-4 py-3">
                  Pedido
                </th>
                <th className="px-4 py-3">
                  Licença
                </th>
                <th className="px-4 py-3">
                  Renovações
                </th>
                <th className="px-4 py-3 text-right">
                  Ação
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-white/10 bg-slate-950/25">
              {users.map(
                user => {
                  const selected =
                    selectedSet.has(
                      user.email
                    )

                  const resetting =
                    busyEmail ===
                    user.email

                  return (
                    <tr
                      key={user.email}
                      className={
                        selected
                          ? 'bg-cyan-300/[0.045]'
                          : ''
                      }
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selected}
                          disabled={
                            busy ||
                            Boolean(
                              busyEmail
                            )
                          }
                          onChange={() =>
                            toggleUser(
                              user.email
                            )
                          }
                          aria-label={`Selecionar ${user.email}`}
                          className="h-4 w-4 rounded border-white/20 bg-slate-950 accent-cyan-300"
                        />
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 font-bold text-slate-200">
                        {user.email}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 text-slate-400">
                        {requestStatusLabel(
                          user.requestStatus
                        )}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 text-slate-400">
                        {licenseStatusLabel(
                          user.licenseStatus
                        )}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 text-slate-400">
                        {user.renewals}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <button
                          type="button"
                          disabled={
                            busy ||
                            Boolean(
                              busyEmail
                            )
                          }
                          onClick={() => {
                            void handleResetAccess(
                              user.email
                            )
                          }}
                          className="rounded-lg border border-amber-300/20 bg-amber-300/[0.06] px-3 py-1.5 text-[0.68rem] font-black text-amber-200 transition hover:bg-amber-300/10 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {resetting
                            ? 'A repor…'
                            : 'Repor acesso'}
                        </button>
                      </td>
                    </tr>
                  )
                }
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border border-amber-300/15 bg-amber-300/[0.04] p-4">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-amber-200">
            Repor acesso
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-400">
            Limpa o estado de acesso da conta para permitir um novo ciclo de teste/ativação. Os dados escolares cifrados guardados na cloud são preservados.
          </p>
        </div>

        <div className="rounded-2xl border border-rose-300/15 bg-rose-300/[0.04] p-4">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-rose-200">
            Apagar utilizador
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-400">
            Remove a identidade de acesso e a cópia cloud cifrada associada. Os dados que permaneçam localmente no dispositivo do professor não podem ser apagados remotamente.
          </p>
        </div>
      </div>

      {deleteDialogOpen ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ma-professor-delete-users-title"
        >
          <div className="w-full max-w-xl rounded-[1.75rem] border border-rose-300/25 bg-slate-950 p-5 shadow-2xl shadow-black/50 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-rose-300">
                  Ação destrutiva
                </p>

                <h3
                  id="ma-professor-delete-users-title"
                  className="mt-2 text-xl font-black text-white"
                >
                  Apagar {selectedEmails.length}{' '}
                  {selectedEmails.length === 1
                    ? 'utilizador'
                    : 'utilizadores'}?
                </h3>
              </div>

              <button
                type="button"
                disabled={busy}
                onClick={closeDeleteDialog}
                aria-label="Fechar confirmação"
                className="rounded-lg border border-white/10 px-3 py-1.5 text-sm font-black text-slate-500 transition hover:bg-white/5 hover:text-white disabled:opacity-40"
              >
                ×
              </button>
            </div>

            <p className="mt-4 text-sm leading-6 text-slate-300">
              Esta operação remove pedidos, licenças, sessões, senhas de ativação, password pessoal, renovações, autorizações e os dados cifrados guardados na cloud para os emails selecionados.
            </p>

            <div className="mt-4 max-h-40 overflow-y-auto rounded-xl border border-white/10 bg-slate-900/60 p-3">
              {selectedEmails.map(
                email => (
                  <p
                    key={email}
                    className="break-all py-1 font-mono text-xs font-bold text-slate-400"
                  >
                    {email}
                  </p>
                )
              )}
            </div>

            <label className="mt-5 block">
              <span className="text-xs font-black text-slate-300">
                Para confirmar, escreva{' '}
                <span className="font-mono text-rose-200">
                  APAGAR
                </span>
              </span>

              <input
                type="text"
                value={deleteConfirmation}
                disabled={busy}
                autoComplete="off"
                spellCheck={false}
                onChange={event =>
                  setDeleteConfirmation(
                    event.currentTarget.value
                  )
                }
                className="mt-2 w-full rounded-xl border border-rose-300/20 bg-slate-900 px-4 py-3 font-mono text-sm font-black text-white outline-none transition focus:border-rose-300/50 focus:ring-4 focus:ring-rose-300/10 disabled:opacity-50"
              />
            </label>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={busy}
                onClick={closeDeleteDialog}
                className="rounded-xl border border-white/10 px-4 py-2.5 text-xs font-black text-slate-400 transition hover:bg-white/5 hover:text-white disabled:opacity-40"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={
                  busy ||
                  deleteConfirmation !==
                    'APAGAR'
                }
                onClick={() => {
                  void handleDeleteSelected()
                }}
                className="rounded-xl bg-rose-500 px-4 py-2.5 text-xs font-black text-white transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy
                  ? 'A apagar…'
                  : 'Apagar definitivamente'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
