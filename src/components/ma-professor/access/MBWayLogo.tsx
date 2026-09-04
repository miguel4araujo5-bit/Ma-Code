interface MBWayLogoProps {
  className?: string
}

export default function MBWayLogo({
  className = ''
}: MBWayLogoProps) {
  return (
    <img
      src="/mbway.svg"
      alt="MB WAY"
      className={className}
      draggable={false}
    />
  )
}
