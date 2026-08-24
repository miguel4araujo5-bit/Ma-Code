import {
  FabricObject,
  Textbox,
  type Canvas
} from 'fabric'

import {
  MA_QUADRO_SERIALIZED_PROPERTIES,
  type MAQuadroFabricObject
} from './canvasObjects'

import {
  getMAQuadroAnimationCanvas
} from './objectAnimations'

import {
  createMAQuadroId
} from './project'

export type MAQuadroTextScriptAction =
  | 'superscript'
  | 'subscript'
  | 'clear'

export type MAQuadroPageNumberPosition =
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'

export type MAQuadroPageNumberFormat =
  | 'number'
  | 'page'
  | 'total'

export type MAQuadroPageNumberOptions = {
  position: MAQuadroPageNumberPosition
  format: MAQuadroPageNumberFormat
  fontFamily: string
  color: string
}

type MAQuadroTypographyObject =
  MAQuadroFabricObject & {
    maPageNumber?: boolean
  }

const TYPOGRAPHY_PROPERTIES = [
  'maPageNumber'
]

const fabricObjectClass =
  FabricObject as unknown as {
    customProperties: string[]
  }

fabricObjectClass.customProperties =
  Array.from(
    new Set([
      ...(
        fabricObjectClass.customProperties ||
        []
      ),
      ...TYPOGRAPHY_PROPERTIES
    ])
  )

for (
  const property
  of TYPOGRAPHY_PROPERTIES
) {
  if (
    !MA_QUADRO_SERIALIZED_PROPERTIES
      .includes(property)
  ) {
    MA_QUADRO_SERIALIZED_PROPERTIES
      .push(property)
  }
}

function clamp(
  value: number,
  minimum: number,
  maximum: number
) {
  return Math.min(
    maximum,
    Math.max(
      minimum,
      Number.isFinite(value)
        ? value
        : minimum
    )
  )
}

function emitObjectModified(
  canvas: Canvas,
  object: MAQuadroFabricObject
) {
  const observable =
    canvas as unknown as {
      fire: (
        eventName: string,
        payload?: unknown
      ) => unknown
    }

  observable.fire(
    'object:modified',
    {
      target: object
    }
  )
}

function selectedTextbox() {
  const canvas =
    getMAQuadroAnimationCanvas()

  if (!canvas) {
    return null
  }

  const active =
    canvas.getActiveObject()

  if (
    !(active instanceof Textbox) ||
    (active as MAQuadroFabricObject).maLocked
  ) {
    return null
  }

  return {
    canvas,
    text:
      active as
        Textbox &
        MAQuadroFabricObject
  }
}

function selectedTextRange(
  text: Textbox
) {
  const start =
    Math.max(
      0,
      Math.min(
        Number(
          text.selectionStart ||
          0
        ),
        Number(
          text.selectionEnd ||
          0
        )
      )
    )

  const end =
    Math.min(
      text.text.length,
      Math.max(
        Number(
          text.selectionStart ||
          0
        ),
        Number(
          text.selectionEnd ||
          0
        )
      )
    )

  return end > start
    ? [
        start,
        end
      ] as const
    : null
}

export function applyMAQuadroSelectedTextScript(
  action:
    MAQuadroTextScriptAction
) {
  const current =
    selectedTextbox()

  if (!current) {
    return {
      changed: false,
      message:
        'Selecione primeiro uma caixa de texto desbloqueada.'
    }
  }

  const range =
    selectedTextRange(
      current.text
    )

  if (!range) {
    return {
      changed: false,
      message:
        'Entre em edição do texto e selecione os caracteres a formatar.'
    }
  }

  const [
    start,
    end
  ] = range

  if (
    action ===
    'superscript'
  ) {
    current.text.setSuperscript(
      start,
      end
    )
  } else if (
    action ===
    'subscript'
  ) {
    current.text.setSubscript(
      start,
      end
    )
  } else {
    current.text.setSelectionStyles(
      {
        fontSize: undefined,
        deltaY: undefined
      },
      start,
      end
    )
  }

  current.text.initDimensions()
  current.text.setCoords()
  current.text.dirty = true

  current.canvas
    .requestRenderAll()

  emitObjectModified(
    current.canvas,
    current.text
  )

  return {
    changed: true,
    message:
      action ===
      'superscript'
        ? 'Sobrescrito aplicado à seleção.'
        : action ===
            'subscript'
          ? 'Subscrito aplicado à seleção.'
          : 'Sobrescrito/subscrito removido da seleção.'
  }
}

function pageNumberText(
  pageNumber: number,
  finalNumber: number,
  format:
    MAQuadroPageNumberFormat
) {
  if (
    format ===
    'page'
  ) {
    return `Página ${pageNumber}`
  }

  if (
    format ===
    'total'
  ) {
    return `${pageNumber} / ${finalNumber}`
  }

  return String(
    pageNumber
  )
}

function validColor(
  value: string
) {
  return /^#[0-9A-F]{6}$/i.test(
    value.trim()
  )
    ? value.trim()
    : '#64748B'
}

function positionPageNumber(
  canvas: Canvas,
  object: Textbox,
  position:
    MAQuadroPageNumberPosition
) {
  const width =
    canvas.getWidth()

  const height =
    canvas.getHeight()

  const shortest =
    Math.min(
      width,
      height
    )

  const margin =
    Math.max(
      18,
      shortest *
      0.035
    )

  const boxWidth =
    Math.max(
      120,
      Math.min(
        width *
        0.34,
        520
      )
    )

  const align =
    position ===
    'bottom-left'
      ? 'left'
      : position ===
          'bottom-right'
        ? 'right'
        : 'center'

  object.set({
    width:
      boxWidth,
    textAlign:
      align
  })

  object.initDimensions()

  const objectHeight =
    Math.max(
      Number(
        object.height ||
        0
      ),
      Number(
        object.fontSize ||
        0
      ) *
      1.1
    )

  const left =
    position ===
    'bottom-left'
      ? margin
      : position ===
          'bottom-right'
        ? width -
          margin -
          boxWidth
        : (
            width -
            boxWidth
          ) /
          2

  object.set({
    left,

    top:
      height -
      margin -
      objectHeight
  })

  object.setCoords()
}

export function upsertMAQuadroPageNumber(
  canvas: Canvas,
  pageNumber: number,
  finalNumber: number,
  options:
    MAQuadroPageNumberOptions
) {
  const objects =
    canvas.getObjects() as
      MAQuadroTypographyObject[]

  const existing =
    objects.find(
      (
        candidate
      ) =>
        candidate.maPageNumber ===
        true
    )

  let object:
    Textbox &
    MAQuadroTypographyObject

  const shortest =
    Math.min(
      canvas.getWidth(),
      canvas.getHeight()
    )

  const fontSize =
    Math.round(
      clamp(
        shortest *
        0.024,
        14,
        72
      )
    )

  const text =
    pageNumberText(
      pageNumber,
      finalNumber,
      options.format
    )

  if (
    !(existing instanceof
      Textbox)
  ) {
    object =
      new Textbox(
        text,
        {
          left: 0,
          top: 0,

          originX:
            'left',

          originY:
            'top',

          fill:
            validColor(
              options.color
            ),

          fontFamily:
            options.fontFamily ||
            'Arial',

          fontSize,

          fontWeight:
            '500',

          lineHeight:
            1,

          charSpacing:
            25,

          textAlign:
            'center',

          editable:
            true,

          selectable:
            true,

          evented:
            true
        }
      ) as
        Textbox &
        MAQuadroTypographyObject

    object.maId =
      createMAQuadroId(
        'page-number'
      )

    object.maName =
      'Número de página'

    object.maRole =
      'text'

    object.maLocked =
      false

    object.maPageNumber =
      true

    canvas.add(
      object
    )
  } else {
    object =
      existing as
        Textbox &
        MAQuadroTypographyObject

    object.set({
      text,

      fill:
        validColor(
          options.color
        ),

      fontFamily:
        options.fontFamily ||
        'Arial',

      fontSize,

      fontWeight:
        '500',

      lineHeight:
        1,

      charSpacing:
        25,

      visible:
        true
    })
  }

  positionPageNumber(
    canvas,
    object,
    options.position
  )

  object.dirty =
    true

  canvas.requestRenderAll()

  emitObjectModified(
    canvas,
    object
  )

  return object
}

export function removeMAQuadroPageNumber(
  canvas: Canvas
) {
  const objects =
    (
      canvas.getObjects() as
        MAQuadroTypographyObject[]
    ).filter(
      (
        object
      ) =>
        object.maPageNumber ===
        true
    )

  if (
    objects.length ===
    0
  ) {
    return 0
  }

  canvas.remove(
    ...objects
  )

  canvas.requestRenderAll()

  return objects.length
}
