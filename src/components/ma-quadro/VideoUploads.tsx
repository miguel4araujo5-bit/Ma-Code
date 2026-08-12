import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent
} from 'react'

import {
  createPortal
} from 'react-dom'

import {
  deleteMAQuadroVideo,
  listMAQuadroVideos,
  saveMAQuadroVideo
} from '../../lib/maQuadro/db'
import {
  createMAQuadroVideoPosterFile,
  MA_QUADRO_VIDEO_MAX_BYTES,
  prepareMAQuadroVideo
} from '../../lib/maQuadro/videoAssets'
import type {
  MAQuadroStoredVideo
} from '../../types/maQuadro'
import {
  useMAQuadroEditorContext
} from './editorContext'

import './maQuadroVideo.css'

function formatDuration(
  durationMs: number
) {
  const totalSeconds =
    Math.max(
      0,
      Math.round(
        durationMs / 1000
      )
    )
  const minutes =
    Math.floor(
      totalSeconds / 60
    )
  const seconds =
    totalSeconds % 60

  return `${minutes}:${String(
    seconds
  ).padStart(
    2,
    '0'
  )}`
}

function formatFileSize(
  bytes: number
) {
  if (
    bytes < 1024 * 1024
  ) {
    return `${Math.max(
      1,
      Math.round(
        bytes / 1024
      )
    )} KB`
  }

  return `${(
    bytes /
    (1024 * 1024)
  ).toFixed(
    bytes < 10 * 1024 * 1024
      ? 1
      : 0
  )} MB`
}

function getErrorMessage(
  error: unknown
) {
  if (
    error instanceof DOMException &&
    error.name ===
      'QuotaExceededError'
  ) {
    return 'Não existe espaço local suficiente para guardar este vídeo.'
  }

  if (
    error instanceof Error &&
    error.message
  ) {
    return error.message
  }

  return 'Não foi possível carregar o vídeo.'
}

export default function VideoUploads() {
  const editor =
    useMAQuadroEditorContext()
  const inputRef =
    useRef<HTMLInputElement | null>(
      null
    )

  const [host, setHost] =
    useState<HTMLElement | null>(
      null
    )
  const [videos, setVideos] =
    useState<MAQuadroStoredVideo[]>(
      []
    )
  const [processing, setProcessing] =
    useState(
      false
    )
  const [addingId, setAddingId] =
    useState<string | null>(
      null
    )
  const [message, setMessage] =
    useState(
      ''
    )

  const refreshVideos =
    useCallback(
      async () => {
        const nextVideos =
          await listMAQuadroVideos()

        setVideos(
          nextVideos
        )
      },
      []
    )

  useLayoutEffect(() => {
    if (
      !editor.ready ||
      editor.activePanel !==
        'uploads'
    ) {
      setHost(
        null
      )
      return
    }

    const panelScroll =
      document.querySelector<HTMLElement>(
        '.mq-left-panel .mq-left-panel__scroll'
      )
    const anchor =
      editor.imageInputRef.current ||
      panelScroll?.querySelector<HTMLElement>(
        '.mq-upload-zone'
      ) ||
      null

    if (
      !panelScroll ||
      !anchor
    ) {
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
      'mq-video-uploads-host'
    anchor.insertAdjacentElement(
      'afterend',
      mount
    )

    setHost(
      mount
    )

    return () => {
      mount.remove()
    }
  }, [
    editor.activePanel,
    editor.imageInputRef,
    editor.ready
  ])

  useEffect(() => {
    if (
      !editor.ready ||
      editor.activePanel !==
        'uploads'
    ) {
      return
    }

    void refreshVideos()
      .catch(() => {
        setMessage(
          'Não foi possível abrir a biblioteca local de vídeos.'
        )
      })
  }, [
    editor.activePanel,
    editor.ready,
    refreshVideos
  ])

  if (!host) {
    return null
  }

  const locked =
    editor.busy ||
    editor.structureBusy ||
    editor.imageCropEditing ||
    processing ||
    addingId !== null

  const addStoredVideo =
    async (
      video:
        MAQuadroStoredVideo
    ) => {
      if (locked) {
        return
      }

      setAddingId(
        video.id
      )
      setMessage(
        ''
      )

      try {
        await editor.handleDroppedFiles([
          createMAQuadroVideoPosterFile(
            video
          )
        ])

        setMessage(
          'Vídeo adicionado ao design.'
        )
      } catch (
        error
      ) {
        setMessage(
          getErrorMessage(
            error
          )
        )
      } finally {
        setAddingId(
          null
        )
      }
    }

  const handleVideoChange =
    async (
      event:
        ChangeEvent<HTMLInputElement>
    ) => {
      const files =
        Array.from(
          event.currentTarget.files ||
          []
        )

      event.currentTarget.value =
        ''

      const file =
        files[0]

      if (
        !file ||
        locked
      ) {
        return
      }

      setProcessing(
        true
      )
      setMessage(
        ''
      )

      let savedVideo:
        MAQuadroStoredVideo |
        null = null

      try {
        const prepared =
          await prepareMAQuadroVideo(
            file
          )

        savedVideo =
          prepared.video

        await saveMAQuadroVideo(
          prepared.video
        )

        try {
          await editor.handleDroppedFiles([
            prepared.posterFile
          ])
        } catch (
          error
        ) {
          await deleteMAQuadroVideo(
            prepared.video.id
          )
          savedVideo =
            null
          throw error
        }

        savedVideo =
          null

        setVideos(
          (current) => [
            prepared.video,
            ...current.filter(
              (video) =>
                video.id !==
                prepared.video.id
            )
          ]
        )

        setMessage(
          'Vídeo guardado localmente e adicionado ao design.'
        )
      } catch (
        error
      ) {
        if (
          savedVideo
        ) {
          await deleteMAQuadroVideo(
            savedVideo.id
          ).catch(
            () => undefined
          )
        }

        setMessage(
          getErrorMessage(
            error
          )
        )
      } finally {
        setProcessing(
          false
        )
      }
    }

  return createPortal(
    <section
      className="mq-video-uploads"
      aria-label="Vídeos"
    >
      <div className="mq-section-title mq-video-uploads__title">
        <h3>
          Vídeos
        </h3>

        <span>
          {videos.length}
        </span>
      </div>

      <button
        type="button"
        className="mq-video-upload-button"
        disabled={locked}
        aria-busy={processing}
        onClick={() =>
          inputRef.current?.click()
        }
      >
        <span
          className="mq-video-upload-button__icon"
          aria-hidden="true"
        >
          ▶
        </span>

        <span className="mq-video-upload-button__copy">
          <strong>
            {processing
              ? 'A preparar vídeo…'
              : 'Carregar vídeo'}
          </strong>

          <small>
            MP4, WebM, MOV ou M4V · até{' '}
            {Math.round(
              MA_QUADRO_VIDEO_MAX_BYTES /
              (1024 * 1024)
            )}{' '}
            MB
          </small>
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime,video/x-m4v,.mp4,.webm,.mov,.m4v"
        disabled={locked}
        onChange={(event) =>
          void handleVideoChange(
            event
          )
        }
        hidden
      />

      {videos.length > 0 ? (
        <div className="mq-video-library">
          {videos.map(
            (video) => (
              <article
                key={video.id}
                className="mq-video-card"
              >
                <button
                  type="button"
                  className="mq-video-card__preview"
                  disabled={locked}
                  aria-label={`Adicionar ${video.name} ao design`}
                  onClick={() =>
                    void addStoredVideo(
                      video
                    )
                  }
                >
                  <img
                    src={video.posterDataUrl}
                    alt=""
                  />

                  <span aria-hidden="true">
                    ▶
                  </span>
                </button>

                <div className="mq-video-card__copy">
                  <strong
                    title={video.name}
                  >
                    {video.name}
                  </strong>

                  <small>
                    {formatDuration(
                      video.durationMs
                    )}
                    {' · '}
                    {video.width}
                    {' × '}
                    {video.height}
                    {' · '}
                    {formatFileSize(
                      video.size
                    )}
                  </small>
                </div>

                <button
                  type="button"
                  className="mq-video-card__add"
                  disabled={locked}
                  onClick={() =>
                    void addStoredVideo(
                      video
                    )
                  }
                >
                  {addingId ===
                  video.id
                    ? 'A adicionar…'
                    : 'Adicionar'}
                </button>
              </article>
            )
          )}
        </div>
      ) : (
        <div className="mq-video-empty">
          Os vídeos carregados ficam disponíveis neste dispositivo para reutilizar noutros designs.
        </div>
      )}

      <div className="mq-video-local-note">
        O ficheiro original permanece no browser. O design recebe uma capa ligada ao vídeo local.
      </div>

      {message ? (
        <p
          className="mq-video-uploads__message"
          role="status"
        >
          {message}
        </p>
      ) : null}
    </section>,
    host
  )
}
