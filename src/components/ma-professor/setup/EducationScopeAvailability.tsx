export default function EducationScopeAvailability() {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-5">
      <p className="text-sm font-black text-slate-200">
        Tipo de ensino
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <label className="flex items-center gap-3 rounded-2xl border border-cyan-300/25 bg-cyan-300/[0.07] px-4 py-3 text-sm font-bold text-cyan-50">
          <input
            type="checkbox"
            checked
            readOnly
            aria-label="Ensino Profissional"
            className="h-4 w-4 rounded border-white/20 bg-slate-900 accent-cyan-300"
          />
          <span>Ensino Profissional</span>
        </label>

        <label className="flex cursor-not-allowed items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm font-bold text-slate-500">
          <input
            type="checkbox"
            disabled
            aria-label="Ensino regular — em breve"
            className="h-4 w-4 rounded border-white/10 bg-slate-900"
          />
          <span>Ensino regular (Em breve)</span>
        </label>

        <label className="flex cursor-not-allowed items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm font-bold text-slate-500">
          <input
            type="checkbox"
            disabled
            aria-label="Misto — profissional e regular — em breve"
            className="h-4 w-4 rounded border-white/10 bg-slate-900"
          />
          <span>Misto — profissional e regular (Em breve)</span>
        </label>

        <label className="flex cursor-not-allowed items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm font-bold text-slate-500">
          <input
            type="checkbox"
            disabled
            aria-label="AEC — em breve"
            className="h-4 w-4 rounded border-white/10 bg-slate-900"
          />
          <span>AEC (Em breve)</span>
        </label>
      </div>
    </section>
  )
}
