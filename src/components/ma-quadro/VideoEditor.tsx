import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent
} from 'react'

import {
  createPortal
} from 'react-dom'

import {
  getMAQuadroVideo,
  saveMAQuadroVideo
} from '../../lib/maQuadro/db'

import {
  createMAQuadroVideoPosterFile,
  readMAQuadroVideoDocumentFromName
} from '../../lib/maQuadro/videoAssets'

import type {
  MAQuadroStoredVideo
} from '../../types/maQuadro'

import {
  useMAQuadroEditorContext
} from './editorContext'

import './maQuadroVideo.css'

const MIN_TRIM_DURATION_MS =
  100

function clamp(
  value: number,
  minimum: number,
  maximum: number
) {
  return Math.min(
    maximum,
    Math.max(
      minimum,
      Number.isFinite(
        value
      )
        ? value
        : minimum
    )
  )
}

function formatTime(
  milliseconds: number
) {
  const totalSeconds =
    Math.max(
      0,
      milliseconds
    ) /
    1000

  const minutes =
    Math.floor(
      totalSeconds / 60
    )

  const seconds =
    Math.floor(
      totalSeconds % 60
    )

  const tenths =
    Math.floor(
      (
        totalSeconds -
        Math.floor(
          totalSeconds
        )
      ) *
      10
    )

  return `${minutes}:${String(
    seconds
  ).padStart(
    2,
    '0'
  )}.${tenths}`
}

function createFileChangeEvent(
  file: File
) {
  const files = {
    0:
      file,

    length:
      1,

    item: (
      index: number
    ) =>
      index === 0
        ? file
        : null
  } as unknown as
    FileList

  const input = {
    files,

    value:
      ''
  } as unknown as
    HTMLInputElement

  return {
    currentTarget:
      input,

    target:
      input
  } as unknown as
    ChangeEvent<
      HTMLInputElement
    >
}

function normalizeTrim(
  video:
    MAQuadroStoredVideo
) {
  const duration =
    Math.max(
      MIN_TRIM_DURATION_MS,
      video.durationMs
    )

  const start =
    clamp(
      video.trimStartMs ??
        0,
      0,
      Math.max(
        0,
        duration -
          MIN_TRIM_DURATION_MS
      )
    )

  const end =
    clamp(
      video.trimEndMs ??
        duration,
      start +
        MIN_TRIM_DURATION_MS,
      duration
    )

  return {
    start,
    end
  }
}

export default function
VideoEditor() {
  const editor =
    useMAQuadroEditorContext()

  const playerRef =
    useRef<HTMLVideoElement | null>(
      null
    )

  const sourceDocument =
    useMemo(
      () => {
        if (
          editor
            .selection
            .count !==
            1 ||
          editor
            .selection
            .role !==
            'image'
        ) {
          return null
        }

        return readMAQuadroVideoDocumentFromName(
          editor
            .selection
            .name
        )
      },
      [
        editor.selection.count,
        editor.selection.name,
        editor.selection.role
      ]
    )

  const [
    host,
    setHost
  ] = useState<
    HTMLElement |
    null
  >(
    null
  )

  const [
    video,
    setVideo
  ] = useState<
    MAQuadroStoredVideo |
    null
  >(
    null
  )

  const [
    videoUrl,
    setVideoUrl
  ] = useState(
    ''
  )

  const [
    loading,
    setLoading
  ] = useState(
    false
  )

  const [
    saving,
    setSaving
  ] = useState(
    false
  )

  const [
    playing,
    setPlaying
  ] = useState(
    false
  )

  const [
    currentMs,
    setCurrentMs
  ] = useState(
    0
  )

  const [
    trimStartMs,
    setTrimStartMs
  ] = useState(
    0
  )

  const [
    trimEndMs,
    setTrimEndMs
  ] = useState(
    0
  )

  const [
    message,
    setMessage
  ] = useState(
    ''
  )

  useLayoutEffect(() => {
    if (
      !editor.ready ||
      !sourceDocument
    ) {
      setHost(
        null
      )

      return
    }

    const scroll =
      document.querySelector<HTMLElement>(
        '.mq-properties-panel .mq-properties-panel__scroll'
      )

    if (!scroll) {
      setHost(
        null
      )

      return
    }

    const mount =
      document.createElement(
        'div'
      )

    mount.className =
      'mq-video-editor-host'

    scroll.prepend(
      mount
    )

    setHost(
      mount
    )

    return () => {
      mount.remove()
    }
  }, [
    editor.ready,
    editor.selection.name,
    sourceDocument
  ])

  useEffect(() => {
    let cancelled =
      false

    if (
      !sourceDocument
    ) {
      setVideo(
        null
      )

      setLoading(
        false
      )

      setMessage(
        ''
      )

      return
    }

    setLoading(
      true
    )

    setMessage(
      ''
    )

    void getMAQuadroVideo(
      sourceDocument.assetId
    )
      .then(
        (
          storedVideo
        ) => {
          if (
            cancelled
          ) {
            return
          }

          if (
            !storedVideo
          ) {
            setVideo(
              null
            )

            setMessage(
              'O ficheiro de vídeo não está disponível neste dispositivo.'
            )

            return
          }

          const trim =
            normalizeTrim(
              storedVideo
            )

          setVideo(
            storedVideo
          )

          setTrimStartMs(
            trim.start
          )

          setTrimEndMs(
            trim.end
          )

          setCurrentMs(
            trim.start
          )
        }
      )
      .catch(
        () => {
          if (
            cancelled
          ) {
            return
          }

          setVideo(
            null
          )

          setMessage(
            'Não foi possível abrir este vídeo.'
          )
        }
      )
      .finally(
        () => {
          if (
            !cancelled
          ) {
            setLoading(
              false
            )
          }
        }
      )

    return () => {
      cancelled =
        true
    }
  }, [
    sourceDocument
  ])

  useEffect(() => {
    if (
      !video
    ) {
      setVideoUrl(
        ''
      )

      return
    }

    const blob =
      new Blob(
        [
          video.data
        ],
        {
          type:
            video.mimeType ||
            'video/mp4'
        }
      )

    const url =
      URL.createObjectURL(
        blob
      )

    setVideoUrl(
      url
    )

    return () => {
      URL.revokeObjectURL(
        url
      )
    }
  }, [
    video?.data,
    video?.id,
    video?.mimeType
  ])

  useEffect(() => {
    const player =
      playerRef.current

    if (
      !player ||
      !videoUrl
    ) {
      return
    }

    const seconds =
      trimStartMs /
      1000

    if (
      Number.isFinite(
        seconds
      )
    ) {
      try {
        player.currentTime =
          seconds
      } catch {
        return
      }
    }

    setCurrentMs(
      trimStartMs
    )
  }, [
    videoUrl
  ])

  if (
    !host ||
    !sourceDocument
  ) {
    return null
  }

  const locked =
    editor.busy ||
    editor.structureBusy ||
    editor.imageCropEditing ||
    loading ||
    saving

  const durationMs =
    Math.max(
      MIN_TRIM_DURATION_MS,
      video?.durationMs ||
        MIN_TRIM_DURATION_MS
    )

  const storedTrim =
    video
      ? normalizeTrim(
          video
        )
      : {
          start: 0,
          end:
            durationMs
        }

  const trimDirty =
    Boolean(
      video &&
      (
        Math.round(
          trimStartMs
        ) !==
          Math.round(
            storedTrim.start
          ) ||
        Math.round(
          trimEndMs
        ) !==
          Math.round(
            storedTrim.end
          )
      )
    )

  const seekTo =
    (
      milliseconds: number
    ) => {
      const player =
        playerRef.current

      const next =
        clamp(
          milliseconds,
          trimStartMs,
          trimEndMs
        )

      setCurrentMs(
        next
      )

      if (
        player &&
        Number.isFinite(
          player.duration
        )
      ) {
        player.currentTime =
          next /
          1000
      }
    }

  const togglePlayback =
    async () => {
      const player =
        playerRef.current

      if (
        !player ||
        locked
      ) {
        return
      }

      setMessage(
        ''
      )

      if (
        !player.paused
      ) {
        player.pause()

        setPlaying(
          false
        )

        return
      }

      const now =
        player.currentTime *
        1000

      if (
        now <
          trimStartMs ||
        now >=
          trimEndMs -
            20
      ) {
        player.currentTime =
          trimStartMs /
          1000

        setCurrentMs(
          trimStartMs
        )
      }

      try {
        await player.play()

        setPlaying(
          true
        )
      } catch {
        setPlaying(
          false
        )

        setMessage(
          'O browser não permitiu iniciar a reprodução.'
        )
      }
    }

  const saveTrim =
    async () => {
      if (
        !video ||
        locked ||
        !trimDirty
      ) {
        return
      }

      setSaving(
        true
      )

      setMessage(
        ''
      )

      try {
        const updated:
          MAQuadroStoredVideo = {
          ...video,

          trimStartMs:
            Math.round(
              trimStartMs
            ),

          trimEndMs:
            Math.round(
              trimEndMs
            )
        }

        await saveMAQuadroVideo(
          updated
        )

        setVideo(
          updated
        )

        setMessage(
          'Corte guardado.'
        )
      } catch {
        setMessage(
          'Não foi possível guardar o corte.'
        )
      } finally {
        setSaving(
          false
        )
      }
    }

  const resetTrim =
    () => {
      if (
        !video ||
        locked
      ) {
        return
      }

      const player =
        playerRef.current

      player?.pause()

      setPlaying(
        false
      )

      setTrimStartMs(
        0
      )

      setTrimEndMs(
        durationMs
      )

      setCurrentMs(
        0
      )

      if (player) {
        player.currentTime =
          0
      }

      setMessage(
        ''
      )
    }

  const useCurrentFrameAsPoster =
    async () => {
      const player =
        playerRef.current

      if (
        !video ||
        !player ||
        locked ||
        player.readyState <
          2
      ) {
        return
      }

      setSaving(
        true
      )

      setMessage(
        ''
      )

      player.pause()

      setPlaying(
        false
      )

      try {
        const sourceWidth =
          Math.max(
            1,
            player.videoWidth
          )

        const sourceHeight =
          Math.max(
            1,
            player.videoHeight
          )

        const maxSide =
          1280

        const scale =
          Math.min(
            1,
            maxSide /
              Math.max(
                sourceWidth,
                sourceHeight
              )
          )

        const canvas =
          document.createElement(
            'canvas'
          )

        canvas.width =
          Math.max(
            1,
            Math.round(
              sourceWidth *
              scale
            )
          )

        canvas.height =
          Math.max(
            1,
            Math.round(
              sourceHeight *
              scale
            )
          )

        const context =
          canvas.getContext(
            '2d'
          )

        if (
          !context
        ) {
          throw new Error()
        }

        context.drawImage(
          player,
          0,
          0,
          canvas.width,
          canvas.height
        )

        const updated:
          MAQuadroStoredVideo = {
          ...video,

          posterDataUrl:
            canvas.toDataURL(
              'image/jpeg',
              0.9
            )
        }

        await saveMAQuadroVideo(
          updated
        )

        await editor.replaceSelectedImage(
          createFileChangeEvent(
            createMAQuadroVideoPosterFile(
              updated
            )
          )
        )

        setVideo(
          updated
        )

        setMessage(
          'Fotograma definido como capa.'
        )
      } catch {
        setMessage(
          'Não foi possível atualizar a capa.'
        )
      } finally {
        setSaving(
          false
        )
      }
    }

  return createPortal(
    <section
      className="mq-video-editor"
      aria-label="Editar vídeo"
    >
      <div className="mq-video-editor__heading">
        <span>
          <strong>
            Vídeo
          </strong>

          <small>
            {video
              ? video.name
              : sourceDocument.name}
          </small>
        </span>

        {trimDirty ? (
          <span className="mq-video-editor__dirty">
            Alterado
          </span>
        ) : null}
      </div>

      {loading ? (
        <div className="mq-video-editor__state">
          A carregar vídeo…
        </div>
      ) : null}

      {!loading &&
      !video ? (
        <div className="mq-video-editor__state">
          {message ||
            'O vídeo não está disponível neste dispositivo.'}
        </div>
      ) : null}

      {video &&
      videoUrl ? (
        <>
          <div className="mq-video-editor__preview">
            <video
              ref={playerRef}
              src={videoUrl}
              preload="metadata"
              playsInline
              muted
              poster={
                video.posterDataUrl
              }
              onLoadedMetadata={() => {
                const player =
                  playerRef.current

                if (!player) {
                  return
                }

                player.currentTime =
                  trimStartMs /
                  1000
              }}
              onPlay={() =>
                setPlaying(
                  true
                )
              }
              onPause={() =>
                setPlaying(
                  false
                )
              }
              onEnded={() =>
                setPlaying(
                  false
                )
              }
              onTimeUpdate={(
                event
              ) => {
                const player =
                  event.currentTarget

                const next =
                  player.currentTime *
                  1000

                if (
                  next >=
                  trimEndMs
                ) {
                  player.pause()

                  player.currentTime =
                    trimEndMs /
                    1000

                  setCurrentMs(
                    trimEndMs
                  )

                  setPlaying(
                    false
                  )

                  return
                }

                setCurrentMs(
                  Math.max(
                    trimStartMs,
                    next
                  )
                )
              }}
              onError={() => {
                setPlaying(
                  false
                )

                setMessage(
                  'Este formato não pôde ser reproduzido pelo browser.'
                )
              }}
            />

            <button
              type="button"
              className="mq-video-editor__play"
              disabled={locked}
              aria-label={
                playing
                  ? 'Pausar vídeo'
                  : 'Reproduzir vídeo'
              }
              onClick={() =>
                void togglePlayback()
              }
            >
              {playing
                ? 'Ⅱ'
                : '▶'}
            </button>
          </div>

          <div className="mq-video-editor__time">
            <strong>
              {formatTime(
                currentMs
              )}
            </strong>

            <span>
              {formatTime(
                trimEndMs
              )}
            </span>
          </div>

          <input
            className="mq-video-editor__timeline"
            type="range"
            min={
              trimStartMs
            }
            max={
              trimEndMs
            }
            step="10"
            value={
              clamp(
                currentMs,
                trimStartMs,
                trimEndMs
              )
            }
            disabled={locked}
            aria-label="Posição no vídeo"
            onChange={(
              event
            ) =>
              seekTo(
                Number(
                  event.target.value
                )
              )
            }
          />

          <div className="mq-video-editor__trim-heading">
            <span>
              Corte
            </span>

            <small>
              {formatTime(
                trimEndMs -
                trimStartMs
              )}
            </small>
          </div>

          <label className="mq-video-editor__range-field">
            <span>
              Início
              <strong>
                {formatTime(
                  trimStartMs
                )}
              </strong>
            </span>

            <input
              type="range"
              min="0"
              max={
                Math.max(
                  0,
                  trimEndMs -
                    MIN_TRIM_DURATION_MS
                )
              }
              step="10"
              value={
                trimStartMs
              }
              disabled={locked}
              onChange={(
                event
              ) => {
                const next =
                  clamp(
                    Number(
                      event
                        .target
                        .value
                    ),
                    0,
                    trimEndMs -
                      MIN_TRIM_DURATION_MS
                  )

                setTrimStartMs(
                  next
                )

                if (
                  currentMs <
                  next
                ) {
                  seekTo(
                    next
                  )
                }

                setMessage(
                  ''
                )
              }}
            />
          </label>

          <label className="mq-video-editor__range-field">
            <span>
              Fim
              <strong>
                {formatTime(
                  trimEndMs
                )}
              </strong>
            </span>

            <input
              type="range"
              min={
                trimStartMs +
                MIN_TRIM_DURATION_MS
              }
              max={
                durationMs
              }
              step="10"
              value={
                trimEndMs
              }
              disabled={locked}
              onChange={(
                event
              ) => {
                const next =
                  clamp(
                    Number(
                      event
                        .target
                        .value
                    ),
                    trimStartMs +
                      MIN_TRIM_DURATION_MS,
                    durationMs
                  )

                setTrimEndMs(
                  next
                )

                if (
                  currentMs >
                  next
                ) {
                  seekTo(
                    next
                  )
                }

                setMessage(
                  ''
                )
              }}
            />
          </label>

          <div className="mq-video-editor__actions">
            <button
              type="button"
              disabled={
                locked ||
                !trimDirty
              }
              className="is-primary"
              onClick={() =>
                void saveTrim()
              }
            >
              {saving
                ? 'A guardar…'
                : 'Guardar corte'}
            </button>

            <button
              type="button"
              disabled={locked}
              onClick={
                resetTrim
              }
            >
              Repor
            </button>
          </div>

          <button
            type="button"
            className="mq-video-editor__poster-button"
            disabled={locked}
            onClick={() =>
              void useCurrentFrameAsPoster()
            }
          >
            Usar fotograma atual como capa
          </button>

          <div className="mq-video-editor__meta">
            <span>
              Original
            </span>

            <strong>
              {formatTime(
                durationMs
              )}
            </strong>

            <span>
              Resolução
            </span>

            <strong>
              {video.width}
              {' × '}
              {video.height}
            </strong>
          </div>

          {message ? (
            <p
              className="mq-video-editor__message"
              role="status"
            >
              {message}
            </p>
          ) : null}
        </>
      ) : null}
    </section>,
    host
  )
}
