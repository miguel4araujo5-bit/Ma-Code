export default function EducationScopeAvailability() {
  return (
    <section className="w-full max-w-sm rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
        Tipo de ensino
      </p>

      <div className="mt-2 space-y-1.5">
        <label className="flex items-center gap-2.5 rounded-lg border border-cyan-300/20 bg-cyan-300/[0.05] px-2.5 py-2 text-xs font-bold text-cyan-50">
          <input
            type="checkbox"
            checked
            readOnly
            aria-label="Ensino Profissional"
            className="h-3.5 w-3.5 rounded border-white/20 bg-slate-900 accent-cyan-300"
          />
          <span>Ensino Profissional</span>
        </label>

        <label className="flex cursor-not-allowed items-center gap-2.5 px-2.5 py-1.5 text-xs font-semibold text-slate-500">
          <input
            type="checkbox"
            disabled
            aria-label="Ensino Regular — em breve"
            className="h-3.5 w-3.5 rounded border-white/10 bg-slate-900"
          />
          <span>Ensino Regular (Em breve)</span>
        </label>

        <label className="flex cursor-not-allowed items-center gap-2.5 px-2.5 py-1.5 text-xs font-semibold text-slate-500">
          <input
            type="checkbox"
            disabled
            aria-label="Misto — Profissional e Regular — em breve"
            className="h-3.5 w-3.5 rounded border-white/10 bg-slate-900"
          />
          <span>Misto — Profissional e Regular (Em breve)</span>
        </label>

        <label className="flex cursor-not-allowed items-center gap-2.5 px-2.5 py-1.5 text-xs font-semibold text-slate-500">
          <input
            type="checkbox"
            disabled
            aria-label="AEC — em breve"
            className="h-3.5 w-3.5 rounded border-white/10 bg-slate-900"
          />
          <span>AEC (Em breve)</span>
        </label>
      </div>
    </section>
  )
}
