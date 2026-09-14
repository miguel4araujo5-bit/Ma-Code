import type {
  ISODate
} from '../types'

interface DailyBackupReminderProps {
  activeDate: ISODate
  today: ISODate
}

export default function DailyBackupReminder({
  activeDate,
  today
}: DailyBackupReminderProps) {
  if (activeDate !== today) {
    return null
  }

  return (
    <div className="px-3 pt-1 sm:px-5 lg:px-7">
      <div className="mx-auto max-w-[1600px] rounded-xl border border-amber-200/10 bg-amber-200/[0.035] px-3 py-2 text-[0.68rem] font-semibold text-slate-400">
        Para maior segurança, faça regularmente uma cópia de segurança — sobretudo em navegação privada ou se surgir algum erro.
      </div>
    </div>
  )
}
