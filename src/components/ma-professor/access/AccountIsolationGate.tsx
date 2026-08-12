import {
  type ReactNode,
  useEffect,
  useState
} from 'react'

import Dexie, {
  type Table
} from 'dexie'

import {
  MA_PROFESSOR_DEFAULT_SETTINGS_ID,
  maProfessorDb,
  openMAProfessorDatabase
} from '../db'

import {
  useMAProfessorAccess
} from './AccessGate'

type GuardStage =
  | 'checking'
  | 'claim-required'
  | 'ready'
  | 'conflict'
  | 'error'

interface LocalDataOwner {
  id: string
  email: string
  createdAt: string
  updatedAt: string
}

const OWNERSHIP_DATABASE_NAME =
  'ma-professor-account-ownership'

const OWNERSHIP_DATABASE_VERSION =
  1

const OWNERSHIP_RECORD_ID =
  'local-data-owner'

class MAProfessorAccountOwnershipDatabase
  extends Dexie {
  owners!:
    Table<
      LocalDataOwner,
      string
    >

  constructor() {
    super(
      OWNERSHIP_DATABASE_NAME
    )

    this.version(
      OWNERSHIP_DATABASE_VERSION
    ).stores({
      owners:
        '&id, email'
    })
  }
}

const ownershipDb =
  new MAProfessorAccountOwnershipDatabase()

function normalizeEmail(
  value: string
) {
  return value
    .trim()
    .toLowerCase()
}

function getErrorMessage(
  error: unknown
) {
  return error instanceof Error &&
    error.message.trim()
    ? error.message
    : 'Não foi possível verificar os dados locais deste browser.'
}

async function readLocalDataOwner() {
  await ownershipDb.open()

  return (
    await ownershipDb.owners.get(
      OWNERSHIP_RECORD_ID
    )
  ) ?? null
}

async function claimLocalDataOwner(
  email: string
) {
  const normalizedEmail =
    normalizeEmail(
      email
    )

  await ownershipDb.open()

  return ownershipDb.transaction(
    'rw',
    ownershipDb.owners,
    async () => {
      const existing =
        await ownershipDb
          .owners
          .get(
            OWNERSHIP_RECORD_ID
          )

      if (existing) {
        return (
          normalizeEmail(
            existing.email
          ) ===
          normalizedEmail
        )
      }

      const timestamp =
        new Date()
          .toISOString()

      await ownershipDb
        .owners
        .add({
          id:
            OWNERSHIP_RECORD_ID,
          email:
            normalizedEmail,
          createdAt:
            timestamp,
          updatedAt:
            timestamp
        })

      return true
    }
  )
}

async function hasMeaningfulLocalData() {
  const database =
    await openMAProfessorDatabase()

  return database.transaction(
    'r',
    database.tables,
    async () => {
      const otherTables =
        database.tables.filter(
          table =>
            table.name !==
            'settings'
        )

      const [
        counts,
        settings
      ] =
        await Promise.all([
          Promise.all(
            otherTables.map(
              table =>
                table.count()
            )
          ),
          database.settings
            .toArray()
        ])

      if (
        counts.some(
          count =>
            count > 0
        )
      ) {
        return true
      }

      if (
        settings.length ===
        0
      ) {
        return false
      }

      if (
        settings.length !==
        1
      ) {
        return true
      }

      const localSettings =
        settings[0]

      return (
        localSettings.id !==
          MA_PROFESSOR_DEFAULT_SETTINGS_ID ||
        localSettings.updatedAt !==
          localSettings.createdAt
      )
    }
  )
}

function GuardShell({
  children
}: {
  children:
    ReactNode
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-white sm:px-6">
      <section className="w-full max-w-xl rounded-[2rem] border border-white/10 bg-slate-900 p-6 shadow-2xl shadow-cyan-950/20 sm:p-9">
        {children}
      </section>
    </main>
  )
}

export function AccountIsolationGate({
  children
}: {
  children:
    ReactNode
}) {
  const {
    session,
    signOut
  } =
    useMAProfessorAccess()

  const [
    stage,
    setStage
  ] =
    useState<GuardStage>(
      'checking'
    )

  const [
    error,
    setError
  ] =
    useState('')

  const [
    claiming,
    setClaiming
  ] =
    useState(false)

  const [
    retryNonce,
    setRetryNonce
  ] =
    useState(0)

  useEffect(
    () => {
      let cancelled =
        false

      async function inspect() {
        setStage(
          'checking'
        )

        setError(
          ''
        )

        try {
          const currentEmail =
            normalizeEmail(
              session.email
            )

          const owner =
            await readLocalDataOwner()

          if (cancelled) {
            return
          }

          if (owner) {
            setStage(
              normalizeEmail(
                owner.email
              ) ===
                currentEmail
                ? 'ready'
                : 'conflict'
            )

            return
          }

          const hasLocalData =
            await hasMeaningfulLocalData()

          if (cancelled) {
            return
          }

          if (hasLocalData) {
            setStage(
              'claim-required'
            )

            return
          }

          const claimed =
            await claimLocalDataOwner(
              currentEmail
            )

          if (cancelled) {
            return
          }

          setStage(
            claimed
              ? 'ready'
              : 'conflict'
          )
        } catch (
          inspectionError
        ) {
          if (cancelled) {
            return
          }

          setError(
            getErrorMessage(
              inspectionError
            )
          )

          setStage(
            'error'
          )
        }
      }

      void inspect()

      return () => {
        cancelled =
          true
      }
    },
    [
      retryNonce,
      session.email
    ]
  )

  const handleClaim =
    async () => {
      if (claiming) {
        return
      }

      setClaiming(
        true
      )

      setError(
        ''
      )

      try {
        const claimed =
          await claimLocalDataOwner(
            session.email
          )

        setStage(
          claimed
            ? 'ready'
            : 'conflict'
        )
      } catch (
        claimError
      ) {
        setError(
          getErrorMessage(
            claimError
          )
        )

        setStage(
          'error'
        )
      } finally {
        setClaiming(
          false
        )
      }
    }

  if (
    stage ===
    'ready'
  ) {
    return children
  }

  if (
    stage ===
    'checking'
  ) {
    return (
      <GuardShell>
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-cyan-300/20 border-t-cyan-300" />

          <p className="mt-5 text-sm font-bold text-slate-400">
            A verificar os dados deste browser…
          </p>
        </div>
      </GuardShell>
    )
  }

  if (
    stage ===
    'claim-required'
  ) {
    return (
      <GuardShell>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-300">
          Dados locais encontrados
        </p>

        <h1 className="mt-3 text-2xl font-black">
          Confirme a conta destes dados
        </h1>

        <p className="mt-4 text-sm leading-7 text-slate-300">
          Este browser já contém dados do MA-Professor criados antes da associação local por conta.
        </p>

        <p className="mt-3 text-sm leading-7 text-slate-400">
          Confirme apenas se estes dados pertencem à conta:
        </p>

        <div className="mt-4 rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.06] px-4 py-3 text-sm font-black text-cyan-100">
          {session.email}
        </div>

        {error ? (
          <p
            role="alert"
            className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-300/[0.06] p-4 text-sm text-rose-100"
          >
            {error}
          </p>
        ) : null}

        <button
          type="button"
          disabled={
            claiming
          }
          onClick={() =>
            void handleClaim()
          }
          className="mt-6 w-full rounded-2xl bg-cyan-300 px-5 py-3.5 text-sm font-black text-slate-950 transition hover:brightness-110 disabled:cursor-wait disabled:opacity-50"
        >
          {claiming
            ? 'A associar…'
            : 'Sim, estes dados pertencem a esta conta'}
        </button>

        <button
          type="button"
          disabled={
            claiming
          }
          onClick={() =>
            void signOut()
          }
          className="mt-3 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-black text-white disabled:opacity-50"
        >
          Usar outra conta
        </button>

        <p className="mt-4 text-center text-xs leading-5 text-slate-500">
          Nenhum dado é eliminado durante esta verificação.
        </p>
      </GuardShell>
    )
  }

  if (
    stage ===
    'conflict'
  ) {
    return (
      <GuardShell>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-300/25 bg-amber-300/10 text-xl font-black text-amber-200">
          !
        </div>

        <p className="mt-5 text-xs font-black uppercase tracking-[0.18em] text-amber-300">
          Conta diferente
        </p>

        <h1 className="mt-3 text-2xl font-black">
          Estes dados pertencem a outra conta
        </h1>

        <p className="mt-4 text-sm leading-7 text-slate-300">
          Este browser já possui um espaço local do MA-Professor associado a outra conta.
        </p>

        <p className="mt-3 text-sm leading-7 text-slate-400">
          Por segurança, esta conta não pode abrir, alterar ou sincronizar esses dados. Entre com a conta original ou utilize outro browser ou dispositivo.
        </p>

        <button
          type="button"
          onClick={() =>
            void signOut()
          }
          className="mt-6 w-full rounded-2xl bg-cyan-300 px-5 py-3.5 text-sm font-black text-slate-950"
        >
          Entrar com outra conta
        </button>
      </GuardShell>
    )
  }

  return (
    <GuardShell>
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-rose-300/25 bg-rose-300/10 text-xl font-black text-rose-200">
        !
      </div>

      <p className="mt-5 text-xs font-black uppercase tracking-[0.18em] text-rose-300">
        Verificação indisponível
      </p>

      <h1 className="mt-3 text-2xl font-black">
        Não foi possível verificar os dados locais
      </h1>

      <p className="mt-4 text-sm leading-7 text-slate-400">
        O MA-Professor não abriu os dados deste browser para evitar uma associação incorreta.
      </p>

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-300/[0.06] p-4 text-sm text-rose-100"
        >
          {error}
        </p>
      ) : null}

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() =>
            setRetryNonce(
              current =>
                current + 1
            )
          }
          className="rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950"
        >
          Tentar novamente
        </button>

        <button
          type="button"
          onClick={() =>
            void signOut()
          }
          className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-black text-white"
        >
          Terminar sessão
        </button>
      </div>
    </GuardShell>
  )
}

export default AccountIsolationGate
