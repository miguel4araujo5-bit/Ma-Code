interface MBWayLogoProps {
  className?: string
}

export default function MBWayLogo({
  className = ''
}: MBWayLogoProps) {
  return (
    <svg
      viewBox="0 0 188 72"
      role="img"
      aria-label="MB WAY"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M17 8h42c7 0 11 4 11 11v7h-8v-6c0-3-1-4-4-4H17V8Zm0 56h42c7 0 11-4 11-11v-7h-8v6c0 3-1 4-4 4H17v8Z"
        fill="#ef3e35"
      />
      <path
        d="M8 20v32c0 8 4 12 12 12h8v-8h-7c-3 0-5-2-5-5V20H8Zm0 0C8 12 12 8 20 8h8v8h-7c-3 0-5 2-5 5v7H8v-8Z"
        fill="#ef3e35"
      />
      <path
        d="M29 49V23h7l7 16 7-16h7v26h-6V34l-6 15h-4l-6-15v15h-6Zm47 0V23h10c6 0 10 3 10 8 0 3-1 5-4 6 4 1 6 3 6 6 0 4-4 6-11 6H76Zm6-16h4c3 0 4-1 4-3s-1-3-4-3h-4v6Zm0 12h5c3 0 5-1 5-3s-2-3-5-3h-5v6Zm31 4-9-26h6l6 18 6-18h6l-9 26h-6Zm23 0V39l-9-16h7l5 10 5-10h7l-9 16v10h-6Zm19 0 9-26h7l9 26h-6l-2-5h-10l-2 5h-5Zm9-10h6l-3-9-3 9Z"
        fill="currentColor"
      />
    </svg>
  )
}
