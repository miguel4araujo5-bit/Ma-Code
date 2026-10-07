import type { ChangeEvent } from 'react'

type Props = {
  value: string
  suggestion: string
  onChange: (value: string) => void
  disabled?: boolean
  rows?: number
  placeholder?: string
  className?: string
}

export function getPlanificationSuggestionText(item: {
  suggestedSummary: string
  content: string
}) {
  return item.suggestedSummary.trim() || item.content.trim()
}

export function appendPlanificationSuggestion(value: string, suggestion: string) {
  const clean = suggestion.trim()
  if (!clean) return value
  if (!value.trim()) return clean
  return `${value.replace(/\s+$/, '')}\n${clean}`
}

export default function PlanificationSummaryTextarea({
  value,
  suggestion,
  onChange,
  disabled,
  rows = 5,
  placeholder,
  className = ''
}: Props) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/90 focus-within:border-cyan-300/50 focus-within:ring-4 focus-within:ring-cyan-300/10">
      <textarea
        value={value}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onChange(event.target.value)}
        disabled={disabled}
        rows={rows}
        placeholder={placeholder}
        className={`w-full resize-y border-0 bg-transparent px-4 pb-2 pt-3 text-sm leading-6 text-white outline-none placeholder:text-slate-600 disabled:cursor-wait disabled:opacity-60 ${className}`}
      />
      {suggestion ? (
        <div
          aria-hidden="true"
          className="pointer-events-none border-t border-white/[0.04] px-4 pb-3 pt-2 text-sm leading-6 text-slate-600"
        >
          {suggestion}
        </div>
      ) : null}
    </div>
  )
}
