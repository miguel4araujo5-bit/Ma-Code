import {
  formatFileSize
} from '../../lib/maPdf/fileUtils'

import type {
  SelectedPdf
} from '../../types/maPdf'

type SelectedFilesListProps = {
  files: SelectedPdf[]
  allowReorder: boolean
  fileBadge:
    | 'PDF'
    | 'JPG'
    | 'DOCX'
  onRemove: (id: string) => void
  onMove: (
    index: number,
    direction: -1 | 1
  ) => void
}

export default function SelectedFilesList({
  files,
  allowReorder,
  fileBadge,
  onRemove,
  onMove
}: SelectedFilesListProps) {
  if (files.length === 0) {
    return null
  }

  return (
    <div className="mt-6 space-y-3">
      {files.map(
        (item, index) => (
          <div
            key={item.id}
            className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:flex-row sm:items-center"
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-xs font-black text-cyan-100">
                {fileBadge}
              </div>

              <div className="min-w-0">
                <strong className="block truncate text-sm font-semibold text-white">
                  {item.file.name}
                </strong>

                <span className="mt-1 block text-xs text-slate-400">
                  {formatFileSize(
                    item.file.size
                  )}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {allowReorder ? (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      onMove(
                        index,
                        -1
                      )
                    }
                    disabled={
                      index === 0
                    }
                    className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-slate-200 transition hover:border-cyan-200/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                    aria-label={`Mover ${item.file.name} para cima`}
                  >
                    ↑
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      onMove(
                        index,
                        1
                      )
                    }
                    disabled={
                      index ===
                      files.length - 1
                    }
                    className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-slate-200 transition hover:border-cyan-200/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                    aria-label={`Mover ${item.file.name} para baixo`}
                  >
                    ↓
                  </button>
                </>
              ) : null}

              <button
                type="button"
                onClick={() =>
                  onRemove(
                    item.id
                  )
                }
                className="rounded-xl border border-red-300/15 bg-red-400/[0.08] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-red-100 transition hover:border-red-200/30 hover:bg-red-400/[0.14]"
              >
                Remover
              </button>
            </div>
          </div>
        )
      )}
    </div>
  )
}
