import {
  useState
} from 'react'

import type {
  EntityId
} from '../types'

import {
  BackupSettingsPanel,
  type SecuritySection
} from './BackupSettingsPanel'

import {
  LicenseSettingsPanel
} from './LicenseSettingsPanel'

import {
  ProfileSettingsPanel
} from './ProfileSettingsPanel'

import {
  SearchSettingsPanel
} from './SearchSettingsPanel'

import {
  ProblemReportPanel
} from '../support/ProblemReportPanel'

type SettingsTab =
  | 'profile'
  | 'backup'
  | 'search'
  | 'license'
  | 'support'

type SettingsNavigationItem =
  | SettingsTab
  | 'configuration'

interface SettingsWorkspaceViewProps {
  academicYearId:
    EntityId | null

  onDataChanged?:
    () => void

  onOpenConfiguration?:
    () => void

  initialTab?:
    SettingsTab

  initialSecuritySection?:
    SecuritySection
}

const tabs: Array<{
  id:
    SettingsNavigationItem

  label:
    string

  description:
    string
}> = [
  {
    id:
      'profile',

    label:
      'Perfil e regras',

    description:
      'Professor, escola e valores predefinidos'
  },

  {
    id:
      'backup',

    label:
      'Segurança e recuperação',

    description:
      'Proteção, cópias, restauro e exportações'
  },

  {
    id:
      'search',

    label:
      'Pesquisa',

    description:
      'Encontrar registos em todo o ano letivo'
  },

  {
    id:
      'configuration',

    label:
      'Corrigir configuração inicial',

    description:
      'Corrigir horário, planificações, critérios, turmas ou alunos'
  },

  {
    id:
      'license',

    label:
      'Licença',

    description:
      'Acesso, validade e renovação'
  },

  {
    id:
      'support',

    label:
      'Diagnóstico e suporte',

    description:
      'Reportar um problema sem enviar dados escolares'
  }
]

export function SettingsWorkspaceView({
  academicYearId,
  onDataChanged,
  onOpenConfiguration,
  initialTab = 'profile',
  initialSecuritySection = 'protection'
}: SettingsWorkspaceViewProps) {
  const [
    tab,
    setTab
  ] =
    useState<SettingsTab>(
      initialTab
    )

  const securitySelected =
    tab === 'backup'

  return (
    <main className="min-h-[calc(100vh-58px)] bg-slate-950 px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/30 p-6 shadow-2xl shadow-black/20 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">
                MA-Professor
              </p>

              <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                {securitySelected
                  ? 'Segurança e recuperação'
                  : 'Definições do MA-Professor'}
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
                {securitySelected
                  ? 'Proteja os seus dados ou recupere uma cópia. As exportações e opções avançadas continuam disponíveis mais abaixo.'
                  : 'Personalize o perfil, consulte a pesquisa global e acompanhe a licença da aplicação.'}
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-right">
              <p className="text-xs font-black text-emerald-200">
                {securitySelected
                  ? 'Proteção dos dados'
                  : 'Configuração local'}
              </p>

              <p className="mt-1 text-[0.65rem] leading-4 text-emerald-100/70">
                {securitySelected
                  ? 'Dados locais · cópia online opcional'
                  : 'Alterações guardadas neste dispositivo'}
              </p>
            </div>
          </div>
        </section>

        <div className="mt-5 grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="h-fit rounded-3xl border border-white/10 bg-slate-900/70 p-2 lg:sticky lg:top-20">
            <nav className="grid gap-1 sm:grid-cols-2 lg:grid-cols-1">
              {tabs.map(
                item => {
                  const active =
                    item.id !==
                      'configuration' &&
                    tab ===
                      item.id

                  return (
                    <button
                      key={
                        item.id
                      }
                      type="button"
                      onClick={() => {
                        if (
                          item.id ===
                          'configuration'
                        ) {
                          onOpenConfiguration?.()
                          return
                        }

                        setTab(
                          item.id
                        )
                      }}
                      aria-current={
                        active
                          ? 'page'
                          : undefined
                      }
                      className={`rounded-2xl px-4 py-3 text-left transition ${
                        active
                          ? 'bg-cyan-300 text-slate-950'
                          : 'text-slate-300 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <span className="block text-sm font-black">
                        {item.label}
                      </span>

                      <span
                        className={`mt-1 block text-[0.68rem] leading-4 ${
                          active
                            ? 'text-slate-800'
                            : 'text-slate-500'
                        }`}
                      >
                        {item.description}
                      </span>
                    </button>
                  )
                }
              )}
            </nav>
          </aside>

          <div className="min-w-0">
            {tab ===
            'profile' ? (
              <ProfileSettingsPanel />
            ) : null}

            {tab ===
            'backup' ? (
              <BackupSettingsPanel
                onDataChanged={
                  onDataChanged
                }
                initialSection={
                  initialSecuritySection
                }
              />
            ) : null}

            {tab ===
            'search' ? (
              <SearchSettingsPanel
                academicYearId={
                  academicYearId
                }
              />
            ) : null}

            {tab ===
            'license' ? (
              <LicenseSettingsPanel />
            ) : null}

            {tab ===
            'support' ? (
              <ProblemReportPanel />
            ) : null}
          </div>
        </div>
      </div>
    </main>
  )
}
