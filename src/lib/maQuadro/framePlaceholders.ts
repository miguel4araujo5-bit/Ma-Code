import type {
  MAQuadroImageFrameKind
} from './editorEnhancements'

export type MAQuadroFrameKind =
  Exclude<
    MAQuadroImageFrameKind,
    'none'
  >

export type MAQuadroFramePreset = {
  kind: MAQuadroFrameKind
  label: string
  description: string
  width: number
  height: number
}

export const MA_QUADRO_FRAME_PRESETS:
  MAQuadroFramePreset[] = [
    {
      kind: 'rounded',
      label: 'Arredondada',
      description:
        'Retângulo com cantos suaves',
      width: 760,
      height: 520
    },
    {
      kind: 'circle',
      label: 'Círculo',
      description:
        'Moldura circular',
      width: 620,
      height: 620
    },
    {
      kind: 'ellipse',
      label: 'Elipse',
      description:
        'Moldura oval horizontal',
      width: 760,
      height: 520
    },
    {
      kind: 'triangle',
      label: 'Triângulo',
      description:
        'Moldura triangular',
      width: 680,
      height: 600
    },
    {
      kind: 'star',
      label: 'Estrela',
      description:
        'Moldura em estrela',
      width: 680,
      height: 680
    }
  ]

export function getMAQuadroFramePreset(
  kind: MAQuadroFrameKind
) {
  return (
    MA_QUADRO_FRAME_PRESETS.find(
      (
        preset
      ) =>
        preset.kind ===
        kind
    ) ||
    MA_QUADRO_FRAME_PRESETS[0]
  )
}

function escapeXml(
  value: string
) {
  return value
    .replace(
      /&/g,
      '&amp;'
    )
    .replace(
      /</g,
      '&lt;'
    )
    .replace(
      />/g,
      '&gt;'
    )
    .replace(
      /"/g,
      '&quot;'
    )
    .replace(
      /'/g,
      '&apos;'
    )
}

export function createMAQuadroFramePlaceholderSvg(
  kind: MAQuadroFrameKind
) {
  const preset =
    getMAQuadroFramePreset(
      kind
    )

  const centerX =
    preset.width /
    2

  const centerY =
    preset.height /
    2

  const iconSize =
    Math.max(
      54,
      Math.min(
        preset.width,
        preset.height
      ) *
        0.12
    )

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="${preset.width}"
  height="${preset.height}"
  viewBox="0 0 ${preset.width} ${preset.height}"
  role="img"
  aria-label="${escapeXml(
    preset.label
  )}"
>
  <defs>
    <pattern
      id="mq-frame-grid"
      width="32"
      height="32"
      patternUnits="userSpaceOnUse"
    >
      <rect
        width="32"
        height="32"
        fill="#0F172A"
      />

      <rect
        width="16"
        height="16"
        fill="#172033"
      />

      <rect
        x="16"
        y="16"
        width="16"
        height="16"
        fill="#172033"
      />
    </pattern>
  </defs>

  <rect
    width="${preset.width}"
    height="${preset.height}"
    fill="url(#mq-frame-grid)"
  />

  <circle
    cx="${centerX}"
    cy="${centerY - 22}"
    r="${iconSize}"
    fill="#082F49"
    stroke="#22D3EE"
    stroke-width="5"
  />

  <path
    d="M ${centerX - iconSize * 0.45} ${centerY - 22}
       H ${centerX + iconSize * 0.45}
       M ${centerX} ${centerY - 22 - iconSize * 0.45}
       V ${centerY - 22 + iconSize * 0.45}"
    fill="none"
    stroke="#67E8F9"
    stroke-width="8"
    stroke-linecap="round"
  />

  <text
    x="${centerX}"
    y="${centerY + iconSize + 38}"
    text-anchor="middle"
    fill="#E2E8F0"
    font-family="Arial, Helvetica, sans-serif"
    font-size="24"
    font-weight="700"
    letter-spacing="1"
  >ARRASTE UMA IMAGEM</text>
</svg>`
}

export function createMAQuadroFramePlaceholderFile(
  kind: MAQuadroFrameKind
) {
  const preset =
    getMAQuadroFramePreset(
      kind
    )

  return new File(
    [
      createMAQuadroFramePlaceholderSvg(
        kind
      )
    ],
    `Moldura · ${preset.label}`,
    {
      type:
        'image/svg+xml',

      lastModified:
        Date.now()
    }
  )
}
