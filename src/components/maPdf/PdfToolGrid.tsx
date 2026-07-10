import { pdfTools } from '../../data/pdfTools'
import { accentClasses } from '../../lib/maPdf/constants'
import type { ActiveTool, PdfTool } from '../../types/maPdf'

type PdfToolGridProps = {
  mounted: boolean
  activeTool: ActiveTool
  onSelect: (tool: PdfTool) => void
}

type ToolCardProps = {
  tool: PdfTool
  index: number
  mounted: boolean
  selected: boolean
  onSelect: (tool: PdfTool) => void
}

function ToolCard({
  tool,
  index,
  mounted,
  selected,
  onSelect
}: ToolCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(tool)}
      disabled={!tool.available}
      className={`group relative w-full overflow-hidden rounded-[1.6rem] border p-5 text-left shadow-xl backdrop-blur transition duration-300 md:p-6 ${
        selected
          ? 'border-cyan-200/55 bg-cyan-300/[0.10] shadow-cyan-950/30'
          : 'border-cyan-300/[0.12] bg-slate-950/60 shadow-cyan-950/10'
      } ${
        tool.available
          ? 'hover:-translate-y-1 hover:border-cyan-200/35 hover:bg-slate-900/80'
          : 'cursor-not-allowed opacity-60'
      } ${mounted ? 'animate-fade-in-up' : 'opacity-0'}`}
      style={{ animationDelay: `${Math.min(index, 11) * 55}ms` }}
      aria-pressed={selected}
    >
      <span className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/55 to-transparent opacity-70" />

      <span className="pointer-events-none absolute -right-16 -top-16 h-36 w-36 rounded-full bg-cyan-300/[0.08] blur-3xl transition duration-500 group-hover:bg-cyan-300/[0.14]" />

      <div className="relative z-10 flex h-full gap-4">
        <div
          className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border text-sm font-black tracking-tight shadow-lg ${accentClasses[tool.accent]}`}
        >
          {tool.badge}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-lg font-semibold tracking-tight text-white md:text-xl">
              {tool.title}
            </h3>

            {tool.available ? (
              <span className="mt-1 text-xl text-cyan-200 transition duration-300 group-hover:translate-x-1">
                →
              </span>
            ) : (
              <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[0.58rem] font-bold uppercase tracking-[0.13em] text-slate-400">
                Em breve
              </span>
            )}
          </div>

          <p className="mt-3 text-sm leading-6 text-slate-300">
            {tool.description}
          </p>

          {selected ? (
            <span className="mt-4 inline-flex rounded-full border border-cyan-200/25 bg-cyan-300/10 px-3 py-1.5 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-cyan-100">
              Ferramenta selecionada
            </span>
          ) : null}
        </div>
      </div>
    </button>
  )
}

export default function PdfToolGrid({
  mounted,
  activeTool,
  onSelect
}: PdfToolGridProps) {
  return (
    <section
      id="ferramentas"
      className="relative z-10 px-5 pb-8 sm:px-6 md:px-10 md:pb-14"
    >
      <div className="mx-auto max-w-7xl">
        <div className="mb-7">
          <span className="section-label">Ferramentas MA PDF</span>

          <h2 className="mt-5 text-2xl font-semibold tracking-tight text-white md:text-4xl">
            Escolha a operação que pretende realizar.
          </h2>

          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 md:text-base">
            Cinco ferramentas já estão disponíveis. As restantes serão
            adicionadas progressivamente.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {pdfTools.map((tool, index) => (
            <div key={tool.id} id={tool.id}>
              <ToolCard
                tool={tool}
                index={index}
                mounted={mounted}
                selected={tool.activeTool === activeTool}
                onSelect={onSelect}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
