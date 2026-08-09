import {
  useEffect,
  useState,
  type ChangeEvent
} from 'react'

import {
  createPortal
} from 'react-dom'

import {
  getMAQuadroFramePreset,
  type MAQuadroFrameKind
} from '../../lib/maQuadro/framePlaceholders'

import {
  useMAQuadroEditorContext
} from './editorContext'

type FrameDropOverlay = {
  left: number
  top: number
  width: number
  height: number
  label: string
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
      index:
        number
    ) =>
      index ===
        0
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

function pointInside(
  x: number,
  y: number,
  rect: {
    left: number
    top: number
    width: number
    height: number
  }
) {
  return (
    x >=
      rect.left &&
    x <=
      rect.left +
        rect.width &&
    y >=
      rect.top &&
    y <=
      rect.top +
        rect.height
  )
}

function acceptsSingleImageDrag(
  transfer:
    DataTransfer
) {
  if (
    !Array.from(
      transfer.types
    ).includes(
      'Files'
    )
  ) {
    return false
  }

  const fileItems =
    Array.from(
      transfer.items ||
      []
    ).filter(
      (
        item
      ) =>
        item.kind ===
        'file'
    )

  if (
    fileItems.length >
    1
  ) {
    return false
  }

  if (
    fileItems.length ===
      1 &&
    fileItems[0].type &&
    !fileItems[0].type.startsWith(
      'image/'
    )
  ) {
    return false
  }

  return true
}

export default function FrameDropController() {
  const editor =
    useMAQuadroEditorContext()

  const [
    overlay,
    setOverlay
  ] = useState<
    FrameDropOverlay |
    null
  >(
    null
  )

  const frameKind:
    MAQuadroFrameKind |
    null =
    editor.selection.count ===
      1 &&
    editor.selection.role ===
      'image' &&
    editor.selection.imageFrame !==
      'none'
      ? editor.selection.imageFrame
      : null

  const locked =
    editor.busy ||
    editor.structureBusy ||
    editor.imageCropEditing

  useEffect(() => {
    if (
      !editor.ready ||
      !editor.activePage ||
      !frameKind ||
      locked
    ) {
      setOverlay(
        null
      )

      return
    }

    const getFrameRect =
      () => {
        const canvasElement =
          editor
            .canvasElementRef
            .current

        const page =
          editor.activePage

        if (
          !canvasElement ||
          !page
        ) {
          return null
        }

        const canvasRect =
          canvasElement
            .getBoundingClientRect()

        if (
          canvasRect.width <=
            0 ||
          canvasRect.height <=
            0
        ) {
          return null
        }

        const scaleX =
          canvasRect.width /
          Math.max(
            1,
            page.width
          )

        const scaleY =
          canvasRect.height /
          Math.max(
            1,
            page.height
          )

        return {
          left:
            canvasRect.left +
            editor.selection.x *
              scaleX,

          top:
            canvasRect.top +
            editor.selection.y *
              scaleY,

          width:
            Math.max(
              1,
              editor.selection.width *
                scaleX
            ),

          height:
            Math.max(
              1,
              editor.selection.height *
                scaleY
            )
        }
      }

    const showOverlay = (
      rect: {
        left: number
        top: number
        width: number
        height: number
      }
    ) => {
      const preset =
        getMAQuadroFramePreset(
          frameKind
        )

      setOverlay({
        ...rect,

        label:
          preset.label
      })
    }

    const clearOverlay =
      () => {
        setOverlay(
          null
        )
      }

    const handleDragOver = (
      event:
        globalThis.DragEvent
    ) => {
      const transfer =
        event.dataTransfer

      if (
        !transfer ||
        !acceptsSingleImageDrag(
          transfer
        )
      ) {
        clearOverlay()

        return
      }

      const rect =
        getFrameRect()

      if (
        !rect ||
        !pointInside(
          event.clientX,
          event.clientY,
          rect
        )
      ) {
        clearOverlay()

        return
      }

      event.preventDefault()
      event.stopPropagation()

      transfer.dropEffect =
        'copy'

      showOverlay(
        rect
      )
    }

    const handleDrop = (
      event:
        globalThis.DragEvent
    ) => {
      const transfer =
        event.dataTransfer

      if (
        !transfer
      ) {
        clearOverlay()

        return
      }

      const files =
        Array.from(
          transfer.files ||
          []
        )

      if (
        files.length !==
          1 ||
        !files[0].type.startsWith(
          'image/'
        )
      ) {
        clearOverlay()

        return
      }

      const rect =
        getFrameRect()

      if (
        !rect ||
        !pointInside(
          event.clientX,
          event.clientY,
          rect
        )
      ) {
        clearOverlay()

        return
      }

      event.preventDefault()
      event.stopPropagation()

      clearOverlay()

      void editor
        .replaceSelectedImage(
          createFileChangeEvent(
            files[0]
          )
        )
    }

    document.addEventListener(
      'dragover',
      handleDragOver,
      true
    )

    document.addEventListener(
      'drop',
      handleDrop,
      true
    )

    document.addEventListener(
      'dragend',
      clearOverlay,
      true
    )

    window.addEventListener(
      'blur',
      clearOverlay
    )

    return () => {
      document.removeEventListener(
        'dragover',
        handleDragOver,
        true
      )

      document.removeEventListener(
        'drop',
        handleDrop,
        true
      )

      document.removeEventListener(
        'dragend',
        clearOverlay,
        true
      )

      window.removeEventListener(
        'blur',
        clearOverlay
      )
    }
  }, [
    editor.activePage,
    editor.busy,
    editor.canvasElementRef,
    editor.imageCropEditing,
    editor.ready,
    editor.replaceSelectedImage,
    editor.selection.height,
    editor.selection.width,
    editor.selection.x,
    editor.selection.y,
    editor.structureBusy,
    frameKind,
    locked
  ])

  if (
    !overlay
  ) {
    return null
  }

  return createPortal(
    <div
      className="mq-frame-drop-overlay"
      style={{
        left:
          overlay.left,

        top:
          overlay.top,

        width:
          overlay.width,

        height:
          overlay.height
      }}
      aria-hidden="true"
    >
      <span>
        Solte para preencher
      </span>

      <small>
        {
          overlay.label
        }
      </small>
    </div>,
    document.body
  )
}
