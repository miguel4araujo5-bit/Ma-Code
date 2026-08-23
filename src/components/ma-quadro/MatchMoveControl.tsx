import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useState
} from 'react'

import {
  createPortal
} from 'react-dom'

import {
  getMAQuadroAnimationCanvas
} from '../../lib/maQuadro/objectAnimations'

import {
  previewMAQuadroPageAnimations
} from '../../lib/maQuadro/pageAnimations'

import {
  applyMAQuadroMatchMoveFromPage,
  clearMAQuadroMatchMove,
  countMAQuadroMatchMoveObjects,
  MA_QUADRO_MATCH_MOVE_DEFAULT_DURATION_MS,
  setMAQuadroMatchMovePageResolver
} from '../../lib/maQuadro/matchMove'

import {
  useMAQuadroEditorContext
} from './editorContext'

import './maQuadroMatchMove.css'

const DURATIONS = [
  500,
  700,
  800,
  1000,
  1500
]

export default function MatchMoveControl() {
  const editor =
    useMAQuadroEditorContext()

  const [
    host,
    setHost
  ] =
    useState<
      HTMLElement |
      null
    >(
      null
    )

  const [
    durationMs,
    setDurationMs
  ] =
    useState(
      MA_QUADRO_MATCH_MOVE_DEFAULT_DURATION_MS
    )

  const [
    working,
    setWorking
  ] =
    useState(
      false
    )

  const [
    matchCount,
    setMatchCount
  ] =
    useState(
      0
    )

  const [
    message,
    setMessage
  ] =
    useState(
      ''
    )

  const previousPage =
    useMemo(
      () => {
        const project =
          editor.project

        const activePage =
          editor.activePage

        if (
          !project ||
          !activePage
        ) {
          return null
        }

        const index =
          project.pages
            .findIndex(
              (
                page
              ) =>
                page.id ===
                activePage.id
            )

        return index >
          0
          ? project.pages[
              index -
              1
            ]
          : null
      },
      [
        editor.activePage,
        editor.project
      ]
    )

  useEffect(() => {
    const pages =
      editor.project
        ?.pages ||
      []

    setMAQuadroMatchMovePageResolver(
      (
        pageId
      ) =>
        pages.find(
          (
            page
          ) =>
            page.id ===
            pageId
        )
    )

    return () => {
      setMAQuadroMatchMovePageResolver(
        null
      )
    }
  }, [
    editor.project
      ?.pages
  ])

  useLayoutEffect(() => {
    if (
      !editor.ready
    ) {
      setHost(
        null
      )

      return
    }

    let cancelled =
      false

    let frame =
      0

    let attempts =
      0

    let container:
      | HTMLElement
      | null =
      null

    const mount =
      () => {
        if (
          cancelled
        ) {
          return
        }

        const toolbar =
          document.querySelector<HTMLElement>(
            '.mq-context-toolbar'
          )

        if (
          !toolbar
        ) {
          attempts +=
            1

          if (
            attempts <
            30
          ) {
            frame =
              window
                .requestAnimationFrame(
                  mount
                )
          }

          return
        }

        container =
          document.createElement(
            'div'
          )

        container.className =
          'mq-match-move-host'

        toolbar.append(
          container
        )

        setHost(
          container
        )
      }

    frame =
      window
        .requestAnimationFrame(
          mount
        )

    return () => {
      cancelled =
        true

      if (
        frame
      ) {
        window
          .cancelAnimationFrame(
            frame
          )
      }

      container
        ?.remove()

      setHost(
        null
      )
    }
  }, [
    editor.activePage
      ?.id,
    editor.project
      ?.id,
    editor.ready
  ])

  useLayoutEffect(() => {
    const canvas =
      getMAQuadroAnimationCanvas()

    setMatchCount(
      canvas
        ? countMAQuadroMatchMoveObjects(
            canvas
          )
        : 0
    )

    setMessage(
      ''
    )
  }, [
    editor.activePage
      ?.id,
    editor.project
      ?.id
  ])

  if (
    !host
  ) {
    return null
  }

  const locked =
    editor.busy ||
    editor.structureBusy ||
    editor.imageCropEditing ||
    working

  const apply =
    async () => {
      const canvas =
        getMAQuadroAnimationCanvas()

      const targetPage =
        editor.activePage

      if (
        !canvas ||
        !previousPage ||
        !targetPage ||
        locked
      ) {
        return
      }

      setWorking(
        true
      )

      setMessage(
        ''
      )

      try {
        const saved =
          await editor.saveProject(
            true
          )

        if (
          !saved
        ) {
          setMessage(
            'Não foi possível guardar a página antes de aplicar a transição.'
          )

          return
        }

        const result =
          applyMAQuadroMatchMoveFromPage(
            canvas,
            previousPage,
            durationMs,
            targetPage
          )

        const transitionParts =
          result.animated +
          result.exiting +
          (
            result.backgroundChanged
              ? 1
              : 0
          )

        setMatchCount(
          countMAQuadroMatchMoveObjects(
            canvas
          )
        )

        if (
          transitionParts ===
          0
        ) {
          setMessage(
            result.matched >
            0
              ? 'As duas páginas já têm os elementos correspondentes na mesma posição, escala, rotação e opacidade.'
              : 'Não foram encontradas alterações que possam ser animadas entre esta página e a anterior.'
          )

          return
        }

        if (
          countMAQuadroMatchMoveObjects(
            canvas
          ) ===
          0
        ) {
          setMessage(
            'A página atual não tem elementos que possam guardar a ligação à página anterior. Adicione pelo menos um elemento e volte a aplicar o Match & Move.'
          )

          return
        }

        await editor.saveProject(
          true
        )

        const parts:
          string[] =
          []

        if (
          result.animated >
          0
        ) {
          parts.push(
            `${result.animated} elemento${
              result.animated ===
              1
                ? ''
                : 's'
            } em movimento/entrada`
          )
        }

        if (
          result.exiting >
          0
        ) {
          parts.push(
            `${result.exiting} elemento${
              result.exiting ===
              1
                ? ''
                : 's'
            } em saída`
          )
        }

        if (
          result.backgroundChanged
        ) {
          parts.push(
            'transição do fundo'
          )
        }

        if (
          result.matchedByName >
          0
        ) {
          parts.push(
            `${result.matchedByName} correspondência${
              result.matchedByName ===
              1
                ? ''
                : 's'
            } por nome`
          )
        }

        setMessage(
          `${parts.join(
            ' · '
          )}.`
        )

        await previewMAQuadroPageAnimations(
          canvas,
          {
            mode:
              'together',

            gapMs:
              0,

            holdMs:
              250
          }
        )
      } catch (
        error
      ) {
        console.error(
          error
        )

        setMessage(
          'Não foi possível aplicar o Match & Move. O design permaneceu intacto.'
        )
      } finally {
        setWorking(
          false
        )
      }
    }

  const clear =
    async () => {
      const canvas =
        getMAQuadroAnimationCanvas()

      if (
        !canvas ||
        locked
      ) {
        return
      }

      setWorking(
        true
      )

      try {
        const cleared =
          clearMAQuadroMatchMove(
            canvas
          )

        setMatchCount(
          0
        )

        if (
          cleared >
          0
        ) {
          await editor.saveProject(
            true
          )
        }

        setMessage(
          cleared >
          0
            ? 'Match & Move removido desta página.'
            : 'Esta página não tem Match & Move aplicado.'
        )
      } finally {
        setWorking(
          false
        )
      }
    }

  return createPortal(
    <div
      className="mq-match-move"
      aria-label="Match & Move entre páginas"
    >
      <span
        className={`mq-match-move__status${
          matchCount >
          0
            ? ' is-active'
            : ''
        }`}
        title={
          matchCount >
          0
            ? `${matchCount} elemento${
                matchCount ===
                1
                  ? ''
                  : 's'
              } ligado${
                matchCount ===
                1
                  ? ''
                  : 's'
              } ao Match & Move`
            : 'Sem Match & Move nesta página'
        }
      >
        {matchCount >
        0
          ? `${matchCount} M&M`
          : 'M&M'}
      </span>

      <label className="mq-match-move__duration">
        <span className="sr-only">
          Duração do Match & Move
        </span>

        <select
          value={
            durationMs
          }
          disabled={
            locked ||
            !previousPage
          }
          aria-label="Duração do Match & Move"
          title="Duração do Match & Move"
          onChange={(
            event
          ) =>
            setDurationMs(
              Number(
                event
                  .target
                  .value
              )
            )
          }
        >
          {DURATIONS.map(
            (
              duration
            ) => (
              <option
                key={
                  duration
                }
                value={
                  duration
                }
              >
                {(duration / 1000).toLocaleString(
                  'pt-PT',
                  {
                    maximumFractionDigits:
                      1
                  }
                )}{' '}
                s
              </option>
            )
          )}
        </select>
      </label>

      <button
        type="button"
        className="mq-match-move__apply"
        disabled={
          locked ||
          !previousPage
        }
        title={
          previousPage
            ? `Animar a transição a partir de “${previousPage.name}”`
            : 'O Match & Move precisa de uma página anterior.'
        }
        onClick={() =>
          void apply()
        }
      >
        <span
          aria-hidden="true"
        >
          ↝
        </span>

        <span>
          {working
            ? 'A aplicar…'
            : 'Match & Move'}
        </span>
      </button>

      {matchCount >
      0 ? (
        <button
          type="button"
          className="mq-match-move__clear"
          disabled={
            locked
          }
          title="Remover Match & Move desta página"
          aria-label="Remover Match & Move desta página"
          onClick={() =>
            void clear()
          }
        >
          ×
        </button>
      ) : null}

      {message ? (
        <span
          className="sr-only"
          role="status"
        >
          {
            message
          }
        </span>
      ) : null}
    </div>,
    host
  )
}
