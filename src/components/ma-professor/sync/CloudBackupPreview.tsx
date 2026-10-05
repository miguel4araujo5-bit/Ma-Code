import type { MAProfessorBackup } from '../types'
import BackupDraftNotice from '../settings/BackupDraftNotice'

function getPreparedBackupStats(
  backup: MAProfessorBackup
) {
  const data =
    backup.data

  return [
    {
      label: 'Perfis do professor',
      value: data.teacherProfiles.length
    },
    {
      label: 'Anos letivos',
      value: data.academicYears.length
    },
    {
      label: 'Turmas',
      value: data.groups.length
    },
    {
      label: 'Disciplinas',
      value: data.subjects.length
    },
    {
      label: 'Atribuições letivas',
      value: data.teachingAssignments.length
    },
    {
      label: 'UFCD / módulos',
      value: data.modules.length
    },
    {
      label: 'Alunos',
      value: data.students.length
    },
    {
      label: 'Tempos de horário',
      value: data.weeklyScheduleSlots.length
    },
    {
      label: 'Eventos do calendário',
      value: data.schoolCalendarEvents.length
    },
    {
      label: 'Atividades do PAA',
      value: data.paaActivities?.length ?? 0
    },
    {
      label: 'Lembretes semanais',
      value: data.weeklyScheduleSlots.filter(slot => Boolean(slot.summaryReminderText?.trim())).length
    },
    {
      label: 'Planificações',
      value: data.planifications.length
    },
    {
      label: 'Itens de planificação',
      value: data.planificationItems.length
    },
    {
      label: 'Critérios',
      value: data.assessmentCriteria.length
    },
    {
      label: 'Grelhas de avaliação',
      value: data.assessmentSchemes.length
    },
    {
      label: 'Aulas',
      value: data.lessons.length
    },
    {
      label: 'Sumários',
      value: data.lessons.filter(
        lesson =>
          Boolean(
            lesson.summary.trim()
          )
      ).length
    },
    {
      label: 'Faltas',
      value: data.lessonAttendance.filter(
        attendance =>
          attendance.status === 'absent'
      ).length
    },
    {
      label: 'Registos de assiduidade',
      value: data.lessonAttendance.length
    },
    {
      label: 'Sugestões de sumários',
      value: data.summarySuggestions.length
    },
    {
      label: 'Avaliações',
      value: data.lessonAssessments.length
    },
    {
      label: 'Resultados / notas',
      value: data.assessmentResults.length
    },
    {
      label: 'Notas finais',
      value: data.moduleFinalGrades.filter(
        grade =>
          grade.finalGrade !== null ||
          grade.qualitativeFinalGrade != null ||
          Boolean(
            grade.descriptiveAssessment?.trim()
          )
      ).length
    },
    {
      label: 'Registos de notas finais',
      value: data.moduleFinalGrades.length
    },
    {
      label: 'Recuperações',
      value: data.learningRecoveries.length
    },
    {
      label: 'Definições',
      value: data.settings.length
    },
    {
      label: 'Configuração inicial',
      value: data.setupProgress.length
    }
  ]
}

interface Props {
  accountEmail?: string
  preparedBackup: MAProfessorBackup
  busy: boolean
  uploadBlocked?: boolean
  uploadConfirmed: boolean
  onConfirmationChange: (confirmed: boolean) => void
  onConfirm: () => void
  onRefresh: () => void
  onCancel: () => void
}

// Quadro comum à cópia manual e ao lembrete: apresenta o snapshot que será enviado.
export default function CloudBackupPreview({ accountEmail, preparedBackup, busy, uploadBlocked = false, uploadConfirmed,
  onConfirmationChange, onConfirm, onRefresh, onCancel }: Props) {
  const preparedStats = getPreparedBackupStats(preparedBackup)
  return (
            <div role="group" aria-label="Dados que vão ser enviados" className="mt-5 rounded-2xl border border-violet-300/20 bg-slate-950/60 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-200">
                    Dados que vão ser enviados
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Cópia preparada em {new Intl.DateTimeFormat('pt-PT', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(preparedBackup.exportedAt))}. Os números abaixo pertencem exatamente à cópia que será enviada.
                  </p>
                </div>
                <span className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-xs font-black text-emerald-200">
                  Ainda não enviada
                </span>
              </div>

              <table className="mt-4 w-full text-left text-xs">
                <caption className="sr-only">Dados incluídos na cópia preparada</caption>
                <thead>
                  <tr className="border-b border-white/10 text-slate-300">
                    <th scope="col" className="pb-2 pr-3 font-bold">Dados</th>
                    <th scope="col" className="pb-2 text-right font-bold">Quantidade</th>
                  </tr>
                </thead>
                <tbody>
                  {preparedStats.map(item => (
                    <tr key={item.label} className="border-b border-white/5">
                      <th scope="row" className="py-2 pr-3 font-normal leading-4 text-slate-300">{item.label}</th>
                      <td className="py-2 text-right text-sm font-black text-white">{item.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <p className="mt-4 rounded-xl border border-cyan-300/15 bg-cyan-300/[0.05] px-3 py-2 text-xs leading-5 text-cyan-100">
                Inclui os dados já guardados no MA-Professor. Os rascunhos não entram nesta cópia. Guarde as aulas e atualize o quadro antes de confirmar para incluir essas alterações.
              </p>

              {accountEmail ? <BackupDraftNotice accountEmail={accountEmail} /> : null}

              <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/[0.05] p-3 text-sm">
                <p className="font-bold text-amber-100">Confirmação do envio</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">
                  Esta cópia substituirá a cópia online atual. Os dados são cifrados neste dispositivo antes de serem enviados.
                </p>
                <label className="mt-3 flex cursor-pointer items-start gap-3 text-slate-200">
                  <input
                    type="checkbox"
                    checked={uploadConfirmed}
                    disabled={busy || uploadBlocked}
                    onChange={event => onConfirmationChange(event.target.checked)}
                    className="mt-1 h-4 w-4 shrink-0 accent-violet-500"
                  />
                  <span>Confirmo o envio dos dados apresentados e a substituição da cópia online anterior.</span>
                </label>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={busy || uploadBlocked || !uploadConfirmed}
                  onClick={() =>
                    onConfirm()
                  }
                  className="rounded-xl bg-violet-300 px-4 py-2.5 text-sm font-black text-slate-950 transition hover:bg-violet-200 disabled:cursor-wait disabled:opacity-60"
                >
                  {busy
                    ? 'A cifrar, enviar e verificar…'
                    : 'Confirmar e enviar para a nuvem'}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    onRefresh()
                  }
                  className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-bold text-slate-200 transition hover:bg-white/5 disabled:cursor-wait disabled:opacity-60"
                >
                  Atualizar pré-visualização
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={onCancel}
                  className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-400 transition hover:text-white disabled:cursor-wait disabled:opacity-60"
                >
                  Cancelar
                </button>
              </div>
            </div>
  )
}
