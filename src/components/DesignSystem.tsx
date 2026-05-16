import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  HTMLAttributes,
  ReactNode,
} from 'react'

type ContainerSize = 'default' | 'narrow' | 'wide'
type SectionHeaderAlign = 'left' | 'center'
type HeadingTag = 'h1' | 'h2' | 'h3'
type ButtonVariant = 'primary' | 'secondary' | 'ghost'
type ButtonSize = 'sm' | 'md' | 'lg'
type CardTone = 'default' | 'strong' | 'soft'

type ContainerProps = HTMLAttributes<HTMLDivElement> & {
  size?: ContainerSize
  children: ReactNode
}

type SectionShellProps = HTMLAttributes<HTMLElement> & {
  padded?: boolean
  children: ReactNode
}

type EyebrowProps = HTMLAttributes<HTMLParagraphElement> & {
  children: ReactNode
}

type SectionHeaderProps = HTMLAttributes<HTMLDivElement> & {
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  align?: SectionHeaderAlign
  titleAs?: HeadingTag
  children?: ReactNode
}

type SurfaceCardProps = HTMLAttributes<HTMLDivElement> & {
  tone?: CardTone
  interactive?: boolean
  children: ReactNode
}

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode
}

type ActionLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  children: ReactNode
}

type ActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  children: ReactNode
}

type FeatureListProps = HTMLAttributes<HTMLUListElement> & {
  items: ReactNode[]
}

type StatCardProps = HTMLAttributes<HTMLDivElement> & {
  value: ReactNode
  label: ReactNode
  description?: ReactNode
}

type NumberedStepProps = HTMLAttributes<HTMLDivElement> & {
  number: ReactNode
  title: ReactNode
  description: ReactNode
}

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

const containerSizes: Record<ContainerSize, string> = {
  narrow: 'max-w-4xl',
  default: 'max-w-6xl',
  wide: 'max-w-7xl',
}

const buttonSizes: Record<ButtonSize, string> = {
  sm: 'min-h-10 px-4 py-2 text-sm',
  md: 'min-h-11 px-5 py-2.5 text-sm',
  lg: 'min-h-12 px-6 py-3 text-base',
}

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    'border border-cyan-200/70 bg-cyan-300 text-slate-950 shadow-[0_18px_45px_rgba(34,211,238,0.24)] hover:-translate-y-0.5 hover:bg-cyan-200 hover:shadow-[0_22px_60px_rgba(34,211,238,0.32)]',
  secondary:
    'border border-white/15 bg-white/[0.06] text-cyan-50 shadow-[0_18px_45px_rgba(0,0,0,0.18)] hover:-translate-y-0.5 hover:border-cyan-200/50 hover:bg-white/[0.1]',
  ghost:
    'border border-transparent bg-transparent text-cyan-100 hover:bg-white/[0.06] hover:text-white',
}

const cardTones: Record<CardTone, string> = {
  default:
    'border-white/10 bg-white/[0.045] shadow-[0_24px_80px_rgba(0,0,0,0.22)]',
  strong:
    'border-cyan-200/15 bg-slate-950/70 shadow-[0_28px_90px_rgba(8,47,73,0.35)]',
  soft:
    'border-white/10 bg-white/[0.03] shadow-[0_20px_70px_rgba(0,0,0,0.16)]',
}

export function Container({
  size = 'default',
  className,
  children,
  ...props
}: ContainerProps) {
  return (
    <div
      className={cn(
        'mx-auto w-full px-4 sm:px-6 lg:px-8',
        containerSizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function SectionShell({
  padded = true,
  className,
  children,
  ...props
}: SectionShellProps) {
  return (
    <section
      className={cn(
        'relative overflow-hidden',
        padded && 'py-16 sm:py-20 lg:py-24',
        className,
      )}
      {...props}
    >
      {children}
    </section>
  )
}

export function Eyebrow({ className, children, ...props }: EyebrowProps) {
  return (
    <p
      className={cn(
        'mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-200/15 bg-cyan-300/[0.08] px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200',
        className,
      )}
      {...props}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.85)]" />
      {children}
    </p>
  )
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  align = 'left',
  titleAs = 'h2',
  className,
  children,
  ...props
}: SectionHeaderProps) {
  const Heading = titleAs

  return (
    <div
      className={cn(
        'mb-10 max-w-3xl',
        align === 'center' && 'mx-auto text-center',
        className,
      )}
      {...props}
    >
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}

      <Heading className="text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-5xl">
        {title}
      </Heading>

      {description ? (
        <p className="mt-5 text-base leading-8 text-slate-300 sm:text-lg">
          {description}
        </p>
      ) : null}

      {children}
    </div>
  )
}

export function SurfaceCard({
  tone = 'default',
  interactive = false,
  className,
  children,
  ...props
}: SurfaceCardProps) {
  return (
    <div
      className={cn(
        'relative rounded-[2rem] border p-6 backdrop-blur-xl',
        cardTones[tone],
        interactive &&
          'transition duration-300 hover:-translate-y-1 hover:border-cyan-200/35 hover:bg-white/[0.07]',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function Badge({ className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-semibold text-cyan-100',
        className,
      )}
      {...props}
    >
      {children}
    </span>
  )
}

export function ActionLink({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: ActionLinkProps) {
  return (
    <a
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300',
        buttonSizes[size],
        buttonVariants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </a>
  )
}

export function ActionButton({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: ActionButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300 disabled:cursor-not-allowed disabled:opacity-60',
        buttonSizes[size],
        buttonVariants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export function FeatureList({ items, className, ...props }: FeatureListProps) {
  return (
    <ul className={cn('space-y-3', className)} {...props}>
      {items.map((item, index) => (
        <li key={index} className="flex gap-3 text-sm leading-6 text-slate-300">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300 shadow-[0_0_16px_rgba(34,211,238,0.75)]" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

export function StatCard({
  value,
  label,
  description,
  className,
  ...props
}: StatCardProps) {
  return (
    <SurfaceCard tone="soft" className={cn('p-5', className)} {...props}>
      <p className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
        {value}
      </p>
      <p className="mt-2 text-sm font-semibold uppercase tracking-[0.18em] text-cyan-200">
        {label}
      </p>
      {description ? (
        <p className="mt-3 text-sm leading-6 text-slate-400">{description}</p>
      ) : null}
    </SurfaceCard>
  )
}

export function NumberedStep({
  number,
  title,
  description,
  className,
  ...props
}: NumberedStepProps) {
  return (
    <SurfaceCard className={cn('p-6', className)} {...props}>
      <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-200/20 bg-cyan-300/[0.08] text-sm font-bold text-cyan-200">
        {number}
      </div>
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-slate-300">{description}</p>
    </SurfaceCard>
  )
}

export function Divider({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'h-px w-full bg-gradient-to-r from-transparent via-white/15 to-transparent',
        className,
      )}
      {...props}
    />
  )
}
