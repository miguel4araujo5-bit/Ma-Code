import {
  useEffect,
  useRef,
  useState
} from 'react'
import { createPortal } from 'react-dom'

import {
  createProblemReportDraft,
  getProblemReportScreen,
  sendProblemReport,
  type ProblemReportDraft
} from './problemReportClient'

interface ProblemReportDialogProps {
  open: boolean
  errorSummary: string
  screen?: string
  onClose: () => void
}

export function ProblemReportDialog({
  open,
  errorSummary,
  screen,
  onClose
}: ProblemReportDialogProps) {
  const dialog = useRef<HTMLElement>(null)
  const [
    draft,
    setDraft
  ] =
    useState<ProblemReportDraft | null>(
      null
    )

  const [
    message,
    setMessage
  ] =
    useState('')

  const [
    sending,
    setSending
  ] =
    useState(false)

  const [
    sent,
    setSent
  ] =
    useState(false)

  const [
    error,
    setError
  ] =
    useState('')

  useEffect(
    () => {
      if (!open) {
        return
      }

      setDraft(
        createProblemReportDraft(
          errorSummary,
          screen ||
            getProblemReportScreen()
        )
      )
      setMessage('')
      setSending(false)
      setSent(false)
      setError('')
    },
    [
      open,
      errorSummary,
      screen
    ]
  )

  useEffect(() => {
    if (!open || !draft) return
    const previousFocus = document.activeElement
    dialog.current?.querySelector<HTMLButtonElement>('button')?.focus()
    return () => {
      if (previousFocus instanceof window.HTMLElement && previousFocus.isConnected) previousFocus.focus()
    }
  }, [open, Boolean(draft)])

  if (
    !open ||
    !draft
  ) {
    return null
  }

  const handleSubmit =
    async () => {
      if (sending) {
        return
      }

      setSending(true)
      setError('')

      try {
        await sendProblemReport(
          draft,
          message
        )

        setSent(true)
      } catch (submitError) {
        setError(
          submitError instanceof Error
            ? submitError.message
            : 'Não foi possível enviar o relatório. Tente novamente mais tarde.'
        )
      } finally {
        setSending(false)
      }
    }

  return createPortal(
    <div
      className="fixed inset-0 z-[1100] grid place-items-center overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-sm"
      role="presentation"
    >
      <section
        ref={dialog}
        className="my-auto max-h-[calc(100dvh-2rem)] w-full max-w-xl overflow-y-auto rounded-3xl border border-white/10 bg-slate-900 p-5 text-white shadow-2xl sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ma-professor-problem-report-title"
        onKeyDown={event => {
          if (event.key === 'Escape' && !sending) { event.preventDefault(); event.stopPropagation(); onClose() }
          if (event.key === 'Tab') {
            const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), textarea:not(:disabled)'))
            const first = items[0], last = items[items.length - 1]
            if (document.activeElement === (event.shiftKey ? first : last)) {
              event.preventDefault(); (event.shiftKey ? last : first)?.focus()
            }
          }
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
              MA-Professor
            </p>

            <h2
              id="ma-professor-problem-report-title"
              className="mt-2 text-xl font-black"
            >
              Reportar problema
            </h2>
          </div>

          <button
            type="button"
            onClick={
              onClose
            }
            disabled={
              sending
            }
            className="rounded-xl border border-white/10 px-3 py-2 text-sm font-bold text-slate-300 transition hover:bg-white/5 hover:text-white disabled:opacity-50"
          >
            Fechar
          </button>
        </div>

        {sent ? (
          <div
            className="mt-5 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4 text-sm leading-6 text-emerald-100"
            role="status"
          >
            O relatório foi enviado. Obrigado.
          </div>
        ) : (
          <>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              Confirme os dados técnicos abaixo. Nenhum dado escolar, ficheiro, conteúdo do IndexedDB ou password é incluído automaticamente.
            </p>
            <p className="mt-2 text-xs text-slate-400">Se houver uma sessão válida, o relatório fica associado à sua conta para podermos prestar apoio.</p>

            <dl className="mt-4 grid gap-2 rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-xs">
              <div><dt className="font-black text-slate-400">Dispositivo</dt><dd className="mt-1 text-slate-200">{draft.device}</dd></div>
              <div>
                <dt className="font-black text-slate-400">
                  Erro
                </dt>
                <dd className="mt-1 break-words text-slate-200">
                  {draft.error}
                </dd>
              </div>

              <div>
                <dt className="font-black text-slate-400">
                  Versão
                </dt>
                <dd className="mt-1 break-words text-slate-200">
                  {draft.version}
                </dd>
              </div>

              <div>
                <dt className="font-black text-slate-400">
                  Ecrã
                </dt>
                <dd className="mt-1 break-words text-slate-200">
                  {draft.screen}
                </dd>
              </div>

              <div>
                <dt className="font-black text-slate-400">
                  Navegador
                </dt>
                <dd className="mt-1 break-words text-slate-200">
                  {draft.browser}
                </dd>
              </div>

              <div>
                <dt className="font-black text-slate-400">
                  Data
                </dt>
                <dd className="mt-1 break-words text-slate-200">
                  {draft.occurredAt}
                </dd>
              </div>
            </dl>

            <label className="mt-4 block">
              <span className="text-sm font-black text-slate-200">
                Mensagem opcional
              </span>

              <textarea
                value={
                  message
                }
                onChange={
                  event =>
                    setMessage(
                      event.target.value.slice(
                        0,
                        800
                      )
                    )
                }
                maxLength={
                  800
                }
                rows={
                  4
                }
                placeholder="Explique, se quiser, o que estava a tentar fazer."
                className="mt-2 w-full resize-y rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/60"
              />
            </label>

            <p className="mt-2 text-xs leading-5 text-amber-100/80">
              Não inclua nomes de alunos, emails, números de identificação ou outros dados pessoais.
            </p>

            {error ? (
              <p
                className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-300/10 p-3 text-sm text-rose-100"
                role="alert"
              >
                {error}
              </p>
            ) : null}

            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={
                  onClose
                }
                disabled={
                  sending
                }
                className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-black text-slate-300 transition hover:bg-white/5 hover:text-white disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={() => {
                  void handleSubmit()
                }}
                disabled={
                  sending
                }
                className="rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-black text-slate-950 transition hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-60"
              >
                {sending
                  ? 'A enviar…'
                  : 'Enviar'}
              </button>
            </div>
          </>
        )}
      </section>
    </div>, document.body
  )
}
