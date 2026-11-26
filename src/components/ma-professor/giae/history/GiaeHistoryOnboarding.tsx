import { useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { maProfessorRepository, type SetupSnapshot } from '../../repository'
import { todayISO } from '../../lessons/ufcdProgress'
import { prepareGiaeHistory, type HistoryBook } from './giaeHistory'
import {
  deferGiaeHistory, reviewGiaeHistory, saveGiaeHistory, selectUniqueHistoryEntries,
  type HistoryChoice, type HistoryConflict
} from './giaeHistoryRepository'

type Props = { academicYearId: string; onDone: () => void | Promise<void> }
type Loaded = { books: HistoryBook[]; duplicates: string[]; errors: string[]; snapshot: SetupSnapshot }
type Review = ReturnType<typeof prepareGiaeHistory> & {
  conflicts: HistoryConflict[]; ambiguous: number; divergent: number
}

export default function GiaeHistoryOnboarding({ academicYearId, onDone }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const busy = useRef(false)
  const [working, setWorking] = useState('')
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [review, setReview] = useState<Review | null>(null)
  const [name, setName] = useState('')
  const [duplicatesConfirmed, setDuplicatesConfirmed] = useState(false)
  const [error, setError] = useState('')
  const [choices, setChoices] = useState<Record<string, HistoryChoice>>({})

  async function run(message: string, operation: () => Promise<void>) {
    if (busy.current) return
    busy.current = true
    setWorking(message)
    setError('')
    try {
      await operation()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Ocorreu um erro durante a importação.')
    } finally {
      setWorking('')
      busy.current = false
    }
  }

  async function buildReview(data: Loaded, teacherName: string) {
    const prepared = prepareGiaeHistory(data.books, teacherName, data.snapshot, todayISO())
    const unique = selectUniqueHistoryEntries(prepared.entries)
    const conflicts = await reviewGiaeHistory(academicYearId, unique.entries)
    setChoices({})
    setReview({ ...prepared, ...conflicts, entries: unique.entries, divergent: unique.divergent })
  }

  async function load(files: File[]) {
    if (files.length === 0) return
    await run('A ler os PDFs…', async () => {
      setLoaded(null)
      setReview(null)
      setDuplicatesConfirmed(false)
      const [{ readGiaeHistory }, snapshot, profile] = await Promise.all([
        import('./readGiaeHistory'), maProfessorRepository.getSetupSnapshot(academicYearId), maProfessorRepository.getTeacherProfile()
      ])
      const books: HistoryBook[] = []
      const duplicates: string[] = []
      const errors: string[] = []
      for (const file of files) {
        try {
          const book = await readGiaeHistory(file)
          if (books.some(existing => existing.hash === book.hash)) duplicates.push(file.name)
          else books.push(book)
        } catch (failure) {
          errors.push(file.name + ' — ' + (failure instanceof Error ? failure.message : 'Não foi possível ler o PDF.'))
        }
      }
      const data = { books, duplicates, errors, snapshot }
      setLoaded(data)
      const teacherName = profile?.displayName ?? ''
      setName(teacherName)
      if (books.length) await buildReview(data, teacherName)
    })
  }

  function chooseFiles(event: ChangeEvent<HTMLInputElement>) {
    void load(Array.from(event.target.files ?? []))
    event.target.value = ''
  }

  function dropFiles(event: DragEvent<HTMLElement>) {
    event.preventDefault()
    void load(Array.from(event.dataTransfer.files))
  }

  async function save() {
    if (!review) return
    await run('A guardar o histórico…', async () => {
      const confirmation = Object.fromEntries(review.conflicts.map(conflict =>
        [conflict.key, { choice: choices[conflict.key], version: conflict.version }]
      ))
      await saveGiaeHistory(academicYearId, review.entries, confirmation)
      await onDone()
    })
  }

  const locked = review?.entries.filter(entry => entry.lesson.status === 'cancelled').length ?? 0
  const missingMarks = review?.entries.filter(entry => entry.rosterIssue).length ?? 0
  const canSave = Boolean(review?.entries.length && (!loaded?.duplicates.length || duplicatesConfirmed) &&
    review.conflicts.every(conflict => choices[conflict.key]))
  const secondary = 'rounded-xl border border-slate-500 px-4 py-2 text-sm font-semibold text-slate-200 disabled:opacity-50'
  const primary = 'rounded-xl bg-cyan-300 px-5 py-3 text-sm font-bold text-slate-950 disabled:opacity-50'

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 text-white">
      <section className="space-y-5 rounded-3xl border border-slate-700 bg-slate-950 p-6">
        <h1 className="text-2xl font-bold">Preencher as aulas anteriores a hoje?</h1>
        <p className="text-sm leading-6 text-slate-300">
          Recomendamos que importe o histórico de sumários e faltas. Exporte do GIAE os livros de ponto
          das suas turmas em PDF e carregue-os aqui. O MA‑Professor identifica os seus registos.
          Sem a importação, podem aparecer avisos de sumários em falta e o histórico de faltas pode ficar incompleto.
        </p>
        <div onDragOver={event => event.preventDefault()} onDrop={dropFiles}
          className="space-y-3 rounded-2xl border border-dashed border-cyan-500/60 p-5 text-center">
          <input ref={input} type="file" accept=".pdf,application/pdf" multiple onChange={chooseFiles} className="hidden" />
          <button type="button" disabled={Boolean(working)} onClick={() => input.current?.click()} className={primary}>
            {loaded ? 'Escolher outros PDFs' : 'Importar histórico'}
          </button>
          <p className="text-sm text-slate-300">Também pode arrastar os PDFs para aqui.</p>
        </div>
        {working && <p role="status" className="text-sm text-cyan-200">{working}</p>}
        {error && <p role="alert" className="text-sm text-rose-200">{error}</p>}
        {loaded?.errors.map((failure, index) => <p key={index} className="text-sm text-rose-200">{failure}</p>)}
        {Boolean(loaded?.duplicates.length) && <div className="space-y-2 rounded-xl bg-amber-950/50 p-4 text-sm text-amber-100">
          <p>PDF repetido. Os seguintes ficheiros têm exatamente o mesmo conteúdo de outro PDF carregado.</p>
          <p>{loaded?.duplicates.join(', ')}</p>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={duplicatesConfirmed} onChange={event => setDuplicatesConfirmed(event.target.checked)} />
            Confirmo que quero incluir apenas uma cópia.
          </label>
        </div>}
        {loaded?.books.length && review && !review.teacher ? (
          <form onSubmit={event => {
            event.preventDefault()
            void run('A identificar o docente…', () => buildReview(loaded, name))
          }} className="space-y-3">
            <p className="text-sm text-amber-200">O MA‑Professor precisa de identificar o autor com segurança. Indique o seu nome tal como consta do GIAE.</p>
            <label className="block text-sm">
              Nome no GIAE
              <input value={name} onChange={event => setName(event.target.value)}
                className="mt-1 block w-full rounded-xl border border-slate-600 bg-slate-900 p-2" />
            </label>
            <button type="submit" disabled={!name.trim() || Boolean(working)} className={secondary}>Verificar o meu nome</button>
          </form>
        ) : null}
        {review?.teacher && <div className="space-y-3 text-sm">
          <p><strong>{review.entries.length} aulas identificadas</strong> · {locked} bloqueadas.</p>
          {missingMarks > 0 && <p className="text-amber-200">Há faltas por identificar em {missingMarks} aulas. Serão guardadas as faltas associadas com segurança.</p>}
          {review.issues.length > 0 && <details className="rounded-xl bg-slate-900 p-3">
            <summary>{review.issues.length} registos ficaram fora da seleção.</summary>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {review.issues.map(({ row, file, reason }, index) => <li key={index}>
                {file}, página {row.page} · {row.date} {row.start} · {reason}
              </li>)}
            </ul>
          </details>}
          {(review.ambiguous > 0 || review.divergent > 0) && <p className="text-amber-200">
            {review.ambiguous + review.divergent} posições têm vários registos incompatíveis e ficaram fora da seleção.
          </p>}
          {review.conflicts.map(conflict => <fieldset key={conflict.key} className="space-y-2 rounded-xl border border-amber-600/60 p-4">
            <legend className="px-1 font-semibold">{conflict.entry.row.group} · {conflict.entry.row.subject} · {conflict.entry.row.date} às {conflict.entry.row.start}</legend>
            <p>Já existe uma aula com dados diferentes nesta posição.</p>
            <p><strong>Diário</strong> {conflict.current.summary || 'Sem sumário'}</p>
            <p><strong>PDF</strong> {conflict.entry.row.summary || 'Sem sumário'}</p>
            {(['keep', 'official'] as const).map(choice => <label key={choice} className="flex gap-2">
              <input type="radio" name={conflict.key} checked={choices[conflict.key] === choice}
                onChange={() => setChoices(previous => ({ ...previous, [conflict.key]: choice }))} />
              {choice === 'keep' ? 'Manter o Diário' : 'Usar o registo oficial'}
            </label>)}
          </fieldset>)}
          <button type="button" className={primary} disabled={!canSave || Boolean(working)} onClick={() => void save()}>
            Guardar histórico e abrir o Diário
          </button>
        </div>}
        <div className="space-y-2 border-t border-slate-800 pt-4">
          <p className="text-sm text-slate-300">Ao avançar sem importar, as aulas anteriores ficam por preencher.</p>
          <button type="button" className={secondary} disabled={Boolean(working)} onClick={() => void run('A abrir o Diário…', async () => {
            await deferGiaeHistory(academicYearId)
            await onDone()
          })}>
            Compreendi. Entrar no Diário sem importar
          </button>
        </div>
      </section>
    </main>
  )
}
