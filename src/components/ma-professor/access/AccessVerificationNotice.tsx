import {
  useEffect,
  useState
} from 'react'

import {
  MA_PROFESSOR_ACCESS_VERIFICATION_EVENT,
  readMAProfessorAccessVerificationState,
  type MAProfessorAccessVerificationState
} from './accessVerificationPolicy'

export default function AccessVerificationNotice() {
  const [
    verificationState,
    setVerificationState
  ] = useState<MAProfessorAccessVerificationState>(
    () =>
      readMAProfessorAccessVerificationState()
  )

  useEffect(() => {
    const update = (
      event: Event
    ) => {
      const next =
        (
          event as CustomEvent<MAProfessorAccessVerificationState>
        ).detail

      if (
        next === 'verified' ||
        next === 'local-cache'
      ) {
        setVerificationState(next)
      }
    }

    setVerificationState(
      readMAProfessorAccessVerificationState()
    )

    window.addEventListener(
      MA_PROFESSOR_ACCESS_VERIFICATION_EVENT,
      update
    )

    return () => {
      window.removeEventListener(
        MA_PROFESSOR_ACCESS_VERIFICATION_EVENT,
        update
      )
    }
  }, [])

  if (
    verificationState !==
    'local-cache'
  ) {
    return null
  }

  return (
    <div className="border-b border-amber-300/20 bg-amber-300/[0.08] px-4 py-2 text-amber-50">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-2 text-xs sm:flex-row sm:items-center sm:justify-between">
        <p className="leading-5">
          <strong>
            Ligação ao servidor indisponível.
          </strong>{' '}
          O MA-Professor está a utilizar a licença válida guardada neste dispositivo. Pode continuar a trabalhar localmente; as operações online ficam disponíveis quando a ligação for restabelecida.
        </p>

        <button
          type="button"
          onClick={() =>
            window.location.reload()
          }
          className="shrink-0 rounded-lg border border-amber-200/30 bg-amber-200/10 px-3 py-1.5 font-black text-amber-50 transition hover:bg-amber-200/15"
        >
          Verificar novamente
        </button>
      </div>
    </div>
  )
}
