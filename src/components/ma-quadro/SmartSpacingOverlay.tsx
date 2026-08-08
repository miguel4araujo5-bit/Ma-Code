import {
  useLayoutEffect,
  useState
} from 'react'

import {
  createPortal
} from 'react-dom'

import type {
  MAQuadroSpacingGuide
} from '../../lib/maQuadro/smartSpacing'

import {
  useMAQuadroEditorContext
} from './editorContext'

import './maQuadroSpacing.css'

function percentage(
  value: number,
  maximum: number
) {
  return `${(
    value /
    Math.max(
      1,
      maximum
    )
  ) * 100}%`
}

function SpacingGuide({
  guide,
  width,
  height
}: {
  guide: MAQuadroSpacingGuide
  width: number
  height: number
}) {
  return (
    <>
      {guide.segments.map(
        (
          segment,
          index
        ) => {
          const start =
            Math.min(
              segment.start,
              segment.end
            )

          const end =
            Math.max(
              segment.start,
              segment.end
            )

          if (
            segment.axis ===
            'horizontal'
          ) {
            return (
              <div
                key={`spacing-h-${index}-${start}-${end}`}
                className="mq-smart-spacing mq-smart-spacing--horizontal"
                style={{
                  left:
                    percentage(
                      start,
                      width
                    ),
                  top:
                    percentage(
                      segment.cross,
                      height
                    ),
                  width:
                    percentage(
                      end -
                        start,
                      width
                    )
                }}
              >
                <span className="mq-smart-spacing__cap mq-smart-spacing__cap--start" />

                <span className="mq-smart-spacing__line" />

                <span className="mq-smart-spacing__cap mq-smart-spacing__cap--end" />

                <span className="mq-smart-spacing__label">
                  {Math.round(
                    guide.gap
                  )}{' '}
                  px
                </span>
              </div>
            )
          }

          return (
            <div
              key={`spacing-v-${index}-${start}-${end}`}
              className="mq-smart-spacing mq-smart-spacing--vertical"
              style={{
                left:
                  percentage(
                    segment.cross,
                    width
                  ),
                top:
                  percentage(
                    start,
                    height
                  ),
                height:
                  percentage(
                    end -
                      start,
                    height
                  )
              }}
            >
              <span className="mq-smart-spacing__cap mq-smart-spacing__cap--start" />

              <span className="mq-smart-spacing__line" />

              <span className="mq-smart-spacing__cap mq-smart-spacing__cap--end" />

              <span className="mq-smart-spacing__label">
                {Math.round(
                  guide.gap
                )}{' '}
                px
              </span>
            </div>
          )
        }
      )}
    </>
  )
}

export default function SmartSpacingOverlay() {
  const editor =
    useMAQuadroEditorContext()

  const [
    host,
    setHost
  ] = useState<
    HTMLElement |
    null
  >(null)

  useLayoutEffect(() => {
    const canvasElement =
      editor
        .canvasElementRef
        .current

    setHost(
      canvasElement
        ?.closest(
          '.mq-canvas-shell'
        ) as
        HTMLElement |
        null
    )
  }, [
    editor.activePage?.id,
    editor.canvasElementRef,
    editor.ready
  ])

  const page =
    editor.activePage

  const horizontal =
    editor
      .guides
      .spacing
      .horizontal

  const vertical =
    editor
      .guides
      .spacing
      .vertical

  if (
    !host ||
    !page ||
    (
      !horizontal &&
      !vertical
    )
  ) {
    return null
  }

  return createPortal(
    <div
      className="mq-smart-spacing-overlay"
      aria-hidden="true"
    >
      {horizontal ? (
        <SpacingGuide
          guide={
            horizontal
          }
          width={
            page.width
          }
          height={
            page.height
          }
        />
      ) : null}

      {vertical ? (
        <SpacingGuide
          guide={
            vertical
          }
          width={
            page.width
          }
          height={
            page.height
          }
        />
      ) : null}
    </div>,
    host
  )
}
