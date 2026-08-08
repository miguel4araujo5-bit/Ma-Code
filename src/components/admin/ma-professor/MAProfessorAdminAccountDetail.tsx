import {
  useEffect,
  useRef,
  useState
} from 'react'

import {
  getAccessRequestStatusLabel,
  getLicensePlanLabel,
  getLicenseStatusLabel,
  type MAProfessorAccessRequestSummary
} from '../../ma-professor/access/accessTypes'

import type {
  LicenseRenewalRequest,
  LicenseSummary
} from '../../ma-professor/types'

import {
  generateMAProfessorAccessPassword,
  getMAProfessorCredentialStatus,
  type MAProfessorAdminCredentialStatus,
  type MAProfessorGeneratedCredential
} from '../../../lib/admin/maProfessorAdminApi'

import MAProfessorAdminHistory from './MAProfessorAdminHistory'

interface MAProfessorAdminAccountDetailProps {
  email: string

  request:
    MAProfessorAccessRequestSummary |
    null

  license:
    LicenseSummary |
    null

  renewals:
    LicenseRenewalRequest[]

  dataConnected?:
    boolean

  onClose:
    () => void
}

function formatDate(
  value: string | null
) {
  if (!value) {
    return '—'
  }

  const date =
    new Date(
      value
    )

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return '—'
  }

  return new Intl.DateTimeFormat(
    'pt-PT',
    {
      day:
        '2-digit',

      month:
        '2-digit',

      year:
        'numeric',

      hour:
        '2-digit',

      minute:
        '2-digit'
    }
  ).format(date)
}

function formatMoney(
  amountCents: number,
  currency: string
) {
  return new Intl.NumberFormat(
    'pt-PT',
    {
      style:
        'currency',

      currency
    }
  ).format(
    amountCents /
      100
  )
}

function getRequestStatusClassName(
  status:
    MAProfessorAccessRequestSummary['status']
) {
  switch (status) {
    case 'approved':
      return 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200'

    case 'rejected':
      return 'border-rose-300/20 bg-rose-300/10 text-rose-200'

    default:
      return 'border-amber-300/20 bg-amber-300/10 text-amber-200'
  }
}

function getLicenseStatusClassName(
  status:
    LicenseSummary['status']
) {
  switch (status) {
    case 'active':
      return 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200'

    case 'expiring':
      return 'border-amber-300/20 bg-amber-300/10 text-amber-200'

    case 'renewal_pending':
      return 'border-cyan-300/20 bg-cyan-300/10 text-cyan-200'

    case 'revoked':
      return 'border-rose-300/20 bg-rose-300/10 text-rose-200'

    case 'expired':
      return 'border-slate-400/20 bg-slate-400/10 text-slate-300'

    default:
      return 'border-white/10 bg-white/[0.04] text-slate-400'
  }
}

function getErrorMessage(
  error: unknown
) {
  if (
    error instanceof
      Error &&
    error.message
  ) {
    return error.message
  }

  return 'Ocorreu um erro ao gerir a senha desta conta.'
}

function DetailValue({
  label,
  value,
  note
}: {
  label:
    string

  value:
    string

  note?:
    string
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
      <p className="text-[0.65rem] font-black uppercase tracking-[0.12em] text-slate-600">
        {label}
      </p>

      <p className="mt-1 break-words text-xs font-bold text-slate-300">
        {value}
      </p>

      {note ? (
        <p className="mt-1 text-[0.68rem] leading-5 text-slate-600">
          {note}
        </p>
      ) : null}
    </div>
  )
}

export default function MAProfessorAdminAccountDetail({
  email,
  request,
  license,
  renewals,
  dataConnected = false,
  onClose
}: MAProfessorAdminAccountDetailProps) {
  const sectionRef =
    useRef<HTMLElement | null>(
      null
    )

  const [
    credentialStatus,
    setCredentialStatus
  ] =
    useState<MAProfessorAdminCredentialStatus | null>(
      null
    )

  const [
    generatedCredential,
    setGeneratedCredential
  ] =
    useState<MAProfessorGeneratedCredential | null>(
      null
    )

  const [
    credentialLoading,
    setCredentialLoading
  ] =
    useState(false)

  const [
    generatingCredential,
    setGeneratingCredential
  ] =
    useState(false)

  const [
    credentialError,
    setCredentialError
  ] =
    useState('')

  const [
    passwordCopied,
    setPasswordCopied
  ] =
    useState(false)

  const sortedRenewals =
    [
      ...renewals
    ].sort(
      (
        left,
        right
      ) =>
        new Date(
          right.requestedAt
        ).getTime() -
        new Date(
          left.requestedAt
        ).getTime()
    )

  const latestRenewal =
    sortedRenewals[
      0
    ] ||
    null

  const canGenerateCredential =
    dataConnected &&
    request?.status ===
      'approved' &&
    !credentialLoading &&
    !generatingCredential &&
    !credentialStatus
      ?.hasCredential &&
    !generatedCredential

  useEffect(
    () => {
      const frame =
        window
          .requestAnimationFrame(
            () => {
              sectionRef
                .current
                ?.scrollIntoView({
                  behavior:
                    'smooth',

                  block:
                    'start'
                })
            }
          )

      return () => {
        window
          .cancelAnimationFrame(
            frame
          )
      }
    },
    [
      email
    ]
  )

  useEffect(
    () => {
      let cancelled =
        false

      setGeneratedCredential(
        null
      )

      setPasswordCopied(
        false
      )

      setCredentialError(
        ''
      )

      setCredentialStatus(
        null
      )

      if (
        !dataConnected ||
        !request
      ) {
        setCredentialLoading(
          false
        )

        return () => {
          cancelled =
            true
        }
      }

      setCredentialLoading(
        true
      )

      void getMAProfessorCredentialStatus(
        email
      )
        .then(
          status => {
            if (
              cancelled
            ) {
              return
            }

            setCredentialStatus(
              status
            )
          }
        )
        .catch(
          error => {
            if (
              cancelled
            ) {
              return
            }

            setCredentialError(
              getErrorMessage(
                error
              )
            )
          }
        )
        .finally(
          () => {
            if (
              !cancelled
            ) {
              setCredentialLoading(
                false
              )
            }
          }
        )

      return () => {
        cancelled =
          true
      }
    },
    [
      dataConnected,
      email,
      request
        ?.status
    ]
  )

  const handleReloadCredentialStatus =
    async () => {
      if (
        !dataConnected ||
        !request ||
        credentialLoading
      ) {
        return
      }

      setCredentialLoading(
        true
      )

      setCredentialError(
        ''
      )

      try {
        const status =
          await getMAProfessorCredentialStatus(
            email
          )

        setCredentialStatus(
          status
        )
      } catch (
        error
      ) {
        setCredentialError(
          getErrorMessage(
            error
          )
        )
      } finally {
        setCredentialLoading(
          false
        )
      }
    }

  const handleGenerateCredential =
    async () => {
      if (
        !canGenerateCredential
      ) {
        return
      }

      const confirmed =
        window.confirm(
          [
            `Gerar a senha de acesso para ${email}?`,
            '',
            'A senha será apresentada em texto simples apenas agora.',
            'Copie-a antes de fechar ou atualizar a página.'
          ].join(
            '\n'
          )
        )

      if (
        !confirmed
      ) {
        return
      }

      setGeneratingCredential(
        true
      )

      setCredentialError(
        ''
      )

      setPasswordCopied(
        false
      )

      try {
        const credential =
          await generateMAProfessorAccessPassword(
            email
          )

        setGeneratedCredential(
          credential
        )

        setCredentialStatus({
          email:
            credential.email,

          hasCredential:
            true,

          createdAt:
            credential.createdAt,

          updatedAt:
            credential.updatedAt
        })
      } catch (
        error
      ) {
        setCredentialError(
          getErrorMessage(
            error
          )
        )
      } finally {
        setGeneratingCredential(
          false
        )
      }
    }

  const handleCopyPassword =
    async () => {
      const password =
        generatedCredential
          ?.password

      if (
        !password
      ) {
        return
      }

      setCredentialError(
        ''
      )

      try {
        await navigator
          .clipboard
          .writeText(
            password
          )

        setPasswordCopied(
          true
        )
      } catch {
        setPasswordCopied(
          false
        )

        setCredentialError(
          'Não foi possível copiar automaticamente. Selecione a senha no campo e copie-a manualmente.'
        )
      }
    }

  const handlePrepareEmail =
    () => {
      const password =
        generatedCredential
          ?.password

      if (
        !password
      ) {
        return
      }

      const subject =
        'Acesso ao MA-Professor — MA-CODE'

      const body = [
        'Olá,',
        '',
        'O seu acesso ao MA-Professor foi aprovado.',
        '',
        `Email: ${email}`,
        `Senha: ${password}`,
        '',
        'Aceda a https://ma-code.pt/produtos/ma-professor e utilize este email e esta senha para ativar a sua conta.',
        '',
        'O período beta gratuito de 30 dias começa apenas na primeira ativação válida.',
        '',
        'MA-CODE',
        'https://ma-code.pt'
      ].join(
        '\n'
      )

      window.location.href =
        `mailto:${email}?subject=${encodeURIComponent(
          subject
        )}&body=${encodeURIComponent(
          body
        )}`
    }

  return (
    <section
      ref={
        sectionRef
      }
      className="scroll-mt-6 overflow-hidden rounded-[1.75rem] border border-cyan-300/15 bg-slate-900/65"
    >
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 p-5 sm:p-6">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
            Ficha da conta
          </p>

          <h2 className="mt-2 break-all text-xl font-black text-white sm:text-2xl">
            {email}
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Visão consolidada do pedido,
            ativação, licença, senha e
            renovações conhecidas desta
            conta.
          </p>
        </div>

        <button
          type="button"
          onClick={
            onClose
          }
          className="rounded-xl border border-white/10 px-4 py-2 text-xs font-black text-slate-400 transition hover:bg-white/5 hover:text-white"
        >
          Fechar ficha
        </button>
      </div>

      <div className="grid gap-6 p-5 sm:p-6 xl:grid-cols-2">
        <article className="rounded-2xl border border-white/10 bg-slate-950/35 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-500">
                Pedido de acesso
              </p>

              <h3 className="mt-1 text-lg font-black text-white">
                Estado do pedido
              </h3>
            </div>

            {request ? (
              <span
                className={[
                  'rounded-full border px-2.5 py-1 text-[0.65rem] font-black',
                  getRequestStatusClassName(
                    request.status
                  )
                ].join(
                  ' '
                )}
              >
                {getAccessRequestStatusLabel(
                  request.status
                )}
              </span>
            ) : (
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[0.65rem] font-black text-slate-500">
                Sem pedido
              </span>
            )}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <DetailValue
              label="Pedido recebido"
              value={formatDate(
                request
                  ?.requestedAt ??
                  null
              )}
            />

            <DetailValue
              label="Aprovado em"
              value={formatDate(
                request
                  ?.approvedAt ??
                  null
              )}
            />

            <DetailValue
              label="Rejeitado em"
              value={formatDate(
                request
                  ?.rejectedAt ??
                  null
              )}
            />

            <DetailValue
              label="Primeira ativação"
              value={formatDate(
                request
                  ?.activatedAt ??
                  null
              )}
              note="A beta de 30 dias começa apenas na primeira ativação válida."
            />
          </div>
        </article>

        <article className="rounded-2xl border border-white/10 bg-slate-950/35 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-500">
                Licença atual
              </p>

              <h3 className="mt-1 text-lg font-black text-white">
                Período de acesso
              </h3>
            </div>

            {license ? (
              <span
                className={[
                  'rounded-full border px-2.5 py-1 text-[0.65rem] font-black',
                  getLicenseStatusClassName(
                    license.status
                  )
                ].join(
                  ' '
                )}
              >
                {getLicenseStatusLabel(
                  license.status
                )}
              </span>
            ) : (
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[0.65rem] font-black text-slate-500">
                Sem licença
              </span>
            )}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <DetailValue
              label="Plano"
              value={
                license
                  ? getLicensePlanLabel(
                      license.plan
                    )
                  : '—'
              }
            />

            <DetailValue
              label="Estado"
              value={
                license
                  ? getLicenseStatusLabel(
                      license.status
                    )
                  : '—'
              }
            />

            <DetailValue
              label="Início"
              value={formatDate(
                license
                  ?.validFrom ??
                  null
              )}
            />

            <DetailValue
              label="Válida até"
              value={formatDate(
                license
                  ?.validUntil ??
                  null
              )}
            />

            <DetailValue
              label="Dias restantes"
              value={
                license
                  ?.daysRemaining ==
                null
                  ? '—'
                  : String(
                      license
                        .daysRemaining
                    )
              }
            />

            <DetailValue
              label="Renovação pedida em"
              value={formatDate(
                license
                  ?.renewalRequestedAt ??
                  null
              )}
            />
          </div>
        </article>

        <article className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.025] p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.15em] text-cyan-300">
                Credencial
              </p>

              <h3 className="mt-1 text-lg font-black text-white">
                Senha da conta
              </h3>
            </div>

            {credentialLoading ? (
              <span className="rounded-full border border-cyan-300/15 bg-cyan-300/[0.05] px-2.5 py-1 text-[0.65rem] font-black text-cyan-200">
                A verificar
              </span>
            ) : credentialStatus
                ?.hasCredential ? (
              <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-[0.65rem] font-black text-emerald-200">
                Senha emitida
              </span>
            ) : (
              <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-[0.65rem] font-black text-amber-200">
                Sem senha
              </span>
            )}
          </div>

          {credentialError ? (
            <div
              role="alert"
              className="mt-4 rounded-xl border border-rose-300/20 bg-rose-300/[0.06] p-3"
            >
              <p className="text-xs font-bold leading-5 text-rose-200">
                {credentialError}
              </p>

              {dataConnected &&
              request ? (
                <button
                  type="button"
                  onClick={() => {
                    void handleReloadCredentialStatus()
                  }}
                  disabled={
                    credentialLoading
                  }
                  className="mt-2 text-xs font-black text-rose-100 underline decoration-rose-300/40 underline-offset-4 disabled:opacity-50"
                >
                  Tentar novamente
                </button>
              ) : null}
            </div>
          ) : null}

          {generatedCredential ? (
            <div className="mt-4 rounded-2xl border border-emerald-300/25 bg-emerald-300/[0.07] p-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-300">
                Senha gerada
              </p>

              <p className="mt-2 text-sm font-black text-white">
                Copie esta senha agora
              </p>

              <p className="mt-1 text-xs leading-5 text-slate-400">
                Depois de fechar a ficha ou
                atualizar a página, a
                password em texto simples
                deixa de poder ser
                recuperada.
              </p>

              <input
                type="text"
                readOnly
                value={
                  generatedCredential
                    .password
                }
                onFocus={
                  event =>
                    event
                      .currentTarget
                      .select()
                }
                className="mt-4 w-full rounded-xl border border-emerald-300/25 bg-slate-950 px-4 py-3 font-mono text-base font-black tracking-wider text-emerald-200 outline-none"
                aria-label="Senha gerada"
              />

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    void handleCopyPassword()
                  }}
                  className="rounded-xl bg-emerald-300 px-4 py-2.5 text-xs font-black text-slate-950 transition hover:bg-emerald-200"
                >
                  {passwordCopied
                    ? 'Senha copiada ✓'
                    : 'Copiar senha'}
                </button>

                <button
                  type="button"
                  onClick={
                    handlePrepareEmail
                  }
                  className="rounded-xl border border-cyan-300/25 bg-cyan-300/[0.06] px-4 py-2.5 text-xs font-black text-cyan-200 transition hover:bg-cyan-300/10"
                >
                  Preparar email
                </button>
              </div>

              <p className="mt-3 text-[0.68rem] leading-5 text-slate-500">
                “Preparar email” abre o seu
                programa de email com o
                destinatário, assunto e
                mensagem preenchidos. O envio
                final continua a ser feito
                manualmente por si.
              </p>
            </div>
          ) : credentialLoading ? (
            <div className="mt-4 flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/45 p-4">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-300/20 border-t-cyan-200" />

              <p className="text-xs font-bold text-slate-400">
                A verificar se esta conta já
                tem uma senha associada…
              </p>
            </div>
          ) : credentialStatus
              ?.hasCredential ? (
            <div className="mt-4 rounded-xl border border-emerald-300/15 bg-emerald-300/[0.04] p-4">
              <p className="text-sm font-black text-emerald-200">
                Esta conta já tem uma senha
                associada.
              </p>

              <p className="mt-2 text-xs leading-5 text-slate-500">
                Por segurança, a senha
                original não é armazenada em
                texto simples e não pode ser
                mostrada novamente.
              </p>

              <p className="mt-3 text-xs font-bold text-slate-400">
                Emitida em:{' '}
                {formatDate(
                  credentialStatus
                    .createdAt
                )}
              </p>

              <p className="mt-1 text-[0.68rem] leading-5 text-slate-600">
                A redefinição de senha será
                tratada como uma operação
                administrativa separada, com
                confirmação explícita.
              </p>
            </div>
          ) : request
              ?.status ===
            'approved' ? (
            <div className="mt-4">
              <div className="rounded-xl border border-cyan-300/15 bg-cyan-300/[0.04] p-4">
                <p className="text-sm font-black text-cyan-200">
                  Conta aprovada e pronta para
                  receber uma senha.
                </p>

                <p className="mt-2 text-xs leading-5 text-slate-500">
                  A geração cria uma
                  credencial segura no
                  servidor. A password em
                  texto simples será
                  apresentada apenas uma vez.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  void handleGenerateCredential()
                }}
                disabled={
                  !canGenerateCredential
                }
                className="mt-3 w-full rounded-xl bg-cyan-300 px-4 py-3 text-xs font-black text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {generatingCredential
                  ? 'A gerar senha…'
                  : 'Gerar senha'}
              </button>
            </div>
          ) : request
              ?.status ===
            'pending' ? (
            <div className="mt-4 rounded-xl border border-amber-300/15 bg-amber-300/[0.04] p-4">
              <p className="text-sm font-black text-amber-200">
                O pedido ainda está pendente.
              </p>

              <p className="mt-2 text-xs leading-5 text-slate-500">
                Aprove primeiro o pedido de
                acesso antes de gerar a
                senha.
              </p>
            </div>
          ) : request
              ?.status ===
            'rejected' ? (
            <div className="mt-4 rounded-xl border border-rose-300/15 bg-rose-300/[0.04] p-4">
              <p className="text-sm font-black text-rose-200">
                Pedido rejeitado.
              </p>

              <p className="mt-2 text-xs leading-5 text-slate-500">
                Não é possível emitir uma
                senha para esta conta
                enquanto o pedido estiver
                rejeitado.
              </p>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/45 p-4">
              <p className="text-sm font-black text-slate-400">
                Sem pedido de acesso
                disponível.
              </p>
            </div>
          )}
        </article>

        <article className="rounded-2xl border border-white/10 bg-slate-950/35 p-4 sm:p-5">
          <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-500">
            Última renovação conhecida
          </p>

          <h3 className="mt-1 text-lg font-black text-white">
            Pedido de renovação
          </h3>

          {latestRenewal ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <DetailValue
                label="Plano"
                value={getLicensePlanLabel(
                  latestRenewal
                    .requestedPlan
                )}
              />

              <DetailValue
                label="Valor"
                value={formatMoney(
                  latestRenewal
                    .amountCents,
                  latestRenewal
                    .currency
                )}
              />

              <DetailValue
                label="Pedido em"
                value={formatDate(
                  latestRenewal
                    .requestedAt
                )}
              />

              <DetailValue
                label="Resolvido em"
                value={formatDate(
                  latestRenewal
                    .resolvedAt
                )}
              />

              <DetailValue
                label="Estado"
                value={
                  latestRenewal
                    .status
                }
              />

              <DetailValue
                label="Total de pedidos"
                value={String(
                  sortedRenewals
                    .length
                )}
              />
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-white/10 px-4 py-8 text-center">
              <p className="text-sm font-black text-slate-400">
                Sem renovações
              </p>

              <p className="mt-2 text-xs leading-5 text-slate-600">
                Não existe nenhum pedido de
                renovação conhecido para
                esta conta.
              </p>
            </div>
          )}
        </article>
      </div>

      <div className="border-t border-white/10 p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-500">
              Histórico da conta
            </p>

            <h3 className="mt-1 text-lg font-black text-white">
              Timeline administrativa
            </h3>
          </div>

          <span className="text-xs font-semibold text-slate-600">
            Apenas acontecimentos suportados
            pelos dados atuais
          </span>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/30">
          <MAProfessorAdminHistory
            accessRequests={
              request
                ? [
                    request
                  ]
                : []
            }
            licenses={
              license
                ? [
                    license
                  ]
                : []
            }
            renewals={
              sortedRenewals
            }
            email={
              email
            }
            dataConnected={
              dataConnected
            }
            compact
          />
        </div>
      </div>

      <div className="border-t border-white/10 bg-slate-950/35 p-5 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <button
            type="button"
            disabled
            className="cursor-not-allowed rounded-xl bg-emerald-300/10 px-4 py-2.5 text-xs font-black text-emerald-300/40"
          >
            {request
              ?.status ===
              'approved'
              ? 'Pedido aprovado'
              : 'Aprovar pedido'}
          </button>

          <button
            type="button"
            onClick={() => {
              void handleGenerateCredential()
            }}
            disabled={
              !canGenerateCredential
            }
            className="rounded-xl border border-cyan-300/20 bg-cyan-300/[0.05] px-4 py-2.5 text-xs font-black text-cyan-200 transition hover:bg-cyan-300/10 disabled:cursor-not-allowed disabled:border-cyan-300/10 disabled:bg-transparent disabled:text-cyan-300/40"
          >
            {generatedCredential ||
            credentialStatus
              ?.hasCredential
              ? 'Senha emitida'
              : generatingCredential
                ? 'A gerar senha…'
                : 'Gerar senha'}
          </button>

          <button
            type="button"
            disabled
            className="cursor-not-allowed rounded-xl border border-violet-300/10 px-4 py-2.5 text-xs font-black text-violet-300/40"
          >
            Confirmar renovação
          </button>

          <button
            type="button"
            disabled
            className="cursor-not-allowed rounded-xl border border-rose-300/10 px-4 py-2.5 text-xs font-black text-rose-300/40"
          >
            Rejeitar / revogar
          </button>
        </div>

        <p className="mt-3 text-center text-[0.68rem] leading-5 text-slate-600">
          Aprovação/rejeição e emissão
          inicial da senha já utilizam o
          backend protegido. Pagamentos,
          renovações, redefinição de senha e
          revogação continuam bloqueados
          nesta fase.
        </p>
      </div>
    </section>
  )
}
