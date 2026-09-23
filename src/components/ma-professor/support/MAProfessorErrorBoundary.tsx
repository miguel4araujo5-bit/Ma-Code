import {
  Component,
  type ErrorInfo,
  type ReactNode
} from 'react'

import {
  ProblemReportDialog
} from './ProblemReportDialog'

import {
  getProblemReportScreen
} from './problemReportClient'

interface MAProfessorErrorBoundaryProps {
  children: ReactNode
}

interface MAProfessorErrorBoundaryState {
  failed: boolean
  errorSummary: string
  screen: string
  reportOpen: boolean
}

function getSafeErrorSummary(
  error: unknown
) {
  if (error instanceof Error) {
    const message =
      error.message.toLowerCase()

    if (
      message.includes(
        'dynamically imported module'
      ) ||
      message.includes(
        'importing a module script failed'
      ) ||
      message.includes(
        'chunkloaderror'
      )
    ) {
      return 'Falha ao carregar uma parte da aplicação.'
    }

    if (
      [
        'TypeError',
        'ReferenceError',
        'RangeError',
        'SyntaxError'
      ].includes(
        error.name
      )
    ) {
      return `Erro inesperado: ${error.name}`
    }
  }

  return 'Erro inesperado no MA-Professor.'
}

export class MAProfessorErrorBoundary
  extends Component<
    MAProfessorErrorBoundaryProps,
    MAProfessorErrorBoundaryState
  > {
  state:
    MAProfessorErrorBoundaryState = {
      failed: false,
      errorSummary: '',
      screen:
        '/produtos/ma-professor',
      reportOpen: false
    }

  static getDerivedStateFromError(
    error: unknown
  ):
    Partial<MAProfessorErrorBoundaryState> {
    return {
      failed: true,
      errorSummary:
        getSafeErrorSummary(
          error
        ),
      screen:
        getProblemReportScreen(),
      reportOpen: false
    }
  }

  componentDidCatch(
    error: unknown,
    info: ErrorInfo
  ) {
    /*
     * O erro completo fica apenas na consola local do browser.
     * O relatório nunca é enviado automaticamente.
     */
    console.error(
      'MA-Professor: erro não tratado na interface',
      error,
      info
    )
  }

  private reload = () => {
    window.location.reload()
  }

  private goHome = () => {
    window.location.assign(
      '/produtos/ma-professor'
    )
  }

  render() {
    if (!this.state.failed) {
      return this.props.children
    }

    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-8 text-white">
        <section className="w-full max-w-2xl rounded-[2rem] border border-white/10 bg-slate-900 p-6 shadow-2xl sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
            MA-Professor
          </p>

          <h1 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">
            Algo correu mal
          </h1>

          <p className="mt-4 text-sm leading-7 text-slate-300 sm:text-base">
            O MA-Professor encontrou um problema nesta área. Os dados que já tinham sido guardados neste dispositivo não são apagados por este ecrã. Alterações ainda não guardadas podem não ter sido gravadas.
          </p>

          <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
              Detalhe técnico
            </p>

            <p className="mt-2 text-sm text-slate-300">
              {this.state.errorSummary}
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={
                this.reload
              }
              className="rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-black text-slate-950 transition hover:bg-cyan-200"
            >
              Recarregar
            </button>

            <button
              type="button"
              onClick={() => {
                this.setState({
                  reportOpen:
                    true
                })
              }}
              className="rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-4 py-2.5 text-sm font-black text-cyan-100 transition hover:bg-cyan-300/15"
            >
              Reportar problema
            </button>

            <button
              type="button"
              onClick={
                this.goHome
              }
              className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-black text-slate-300 transition hover:bg-white/5 hover:text-white"
            >
              Voltar ao início
            </button>
          </div>

          <ProblemReportDialog
            open={
              this.state.reportOpen
            }
            errorSummary={
              this.state.errorSummary
            }
            screen={
              this.state.screen
            }
            onClose={() => {
              this.setState({
                reportOpen:
                  false
              })
            }}
          />
        </section>
      </main>
    )
  }
}
