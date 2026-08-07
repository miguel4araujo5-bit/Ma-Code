import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode
} from 'react'

import {
  useMAQuadroEditorContext
} from './editorContext'

export type MAQuadroContextMenuPosition = {
  x: number
  y: number
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
      value
    )
  )
}

function MenuSeparator() {
  return (
    <div
      className="mq-context-menu__separator"
      role="separator"
    />
  )
}

function MenuItem({
  icon,
  label,
  shortcut,
  danger = false,
  disabled = false,
  onClick
}: {
  icon: string
  label: string
  shortcut?: string
  danger?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className={`mq-context-menu__item${
        danger
          ? ' is-danger'
          : ''
      }`}
      disabled={disabled}
      onClick={onClick}
    >
      <span
        className="mq-context-menu__icon"
        aria-hidden="true"
      >
        {icon}
      </span>

      <span className="mq-context-menu__label">
        {label}
      </span>

      {shortcut ? (
        <kbd>
          {shortcut}
        </kbd>
      ) : null}
    </button>
  )
}

function MenuGroup({
  label,
  children
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div
      className="mq-context-menu__group"
      role="group"
      aria-label={label}
    >
      {children}
    </div>
  )
}

export default function CanvasContextMenu({
  position,
  onClose
}: {
  position:
    MAQuadroContextMenuPosition

  onClose:
    () => void
}) {
  const editor =
    useMAQuadroEditorContext()

  const menuRef =
    useRef<
      HTMLDivElement | null
    >(null)

  const [
    adjustedPosition,
    setAdjustedPosition
  ] = useState(
    position
  )

  const locked =
    editor.busy ||
    editor.structureBusy ||
    editor.imageCropEditing

  const multiple =
    editor.selection.count >
    1

  const isGroup =
    editor.selection.count ===
      1 &&
    editor.selection.role ===
      'group'

  const isImage =
    editor.selection.count ===
      1 &&
    editor.selection.role ===
      'image'

  const canLockRatio =
    editor.selection.count ===
      1 &&
    editor.selection.role !==
      'text' &&
    editor.selection.role !==
      'line' &&
    editor.selection.role !==
      'arrow'

  useLayoutEffect(() => {
    setAdjustedPosition(
      position
    )

    const frame =
      window.requestAnimationFrame(
        () => {
          const menu =
            menuRef.current

          if (!menu) {
            return
          }

          const bounds =
            menu.getBoundingClientRect()

          const margin =
            8

          const maximumX =
            Math.max(
              margin,
              window.innerWidth -
                bounds.width -
                margin
            )

          const maximumY =
            Math.max(
              margin,
              window.innerHeight -
                bounds.height -
                margin
            )

          setAdjustedPosition({
            x:
              clamp(
                position.x,
                margin,
                maximumX
              ),

            y:
              clamp(
                position.y,
                margin,
                maximumY
              )
          })

          const first =
            menu.querySelector<
              HTMLButtonElement
            >(
              'button:not([disabled])'
            )

          first?.focus({
            preventScroll:
              true
          })
        }
      )

    return () => {
      window.cancelAnimationFrame(
        frame
      )
    }
  }, [
    position
  ])

  useEffect(() => {
    const handlePointerDown = (
      event:
        PointerEvent
    ) => {
      const menu =
        menuRef.current

      if (
        !menu ||
        menu.contains(
          event.target as Node
        )
      ) {
        return
      }

      onClose()
    }

    const handleResize =
      () => {
        onClose()
      }

    const handleScroll =
      () => {
        onClose()
      }

    document.addEventListener(
      'pointerdown',
      handlePointerDown,
      true
    )

    window.addEventListener(
      'resize',
      handleResize
    )

    window.addEventListener(
      'scroll',
      handleScroll,
      true
    )

    return () => {
      document.removeEventListener(
        'pointerdown',
        handlePointerDown,
        true
      )

      window.removeEventListener(
        'resize',
        handleResize
      )

      window.removeEventListener(
        'scroll',
        handleScroll,
        true
      )
    }
  }, [
    onClose
  ])

  const run = (
    action:
      () => void
  ) => {
    if (locked) {
      return
    }

    onClose()
    action()
  }

  const runAsync = (
    action:
      () => Promise<void>
  ) => {
    if (locked) {
      return
    }

    onClose()

    void action()
  }

  const handleKeyDown = (
    event:
      KeyboardEvent<HTMLDivElement>
  ) => {
    if (
      event.key ===
      'Escape'
    ) {
      event.preventDefault()
      event.stopPropagation()

      onClose()

      return
    }

    if (
      ![
        'ArrowDown',
        'ArrowUp',
        'Home',
        'End'
      ].includes(
        event.key
      )
    ) {
      return
    }

    event.preventDefault()
    event.stopPropagation()

    const menu =
      menuRef.current

    if (!menu) {
      return
    }

    const items =
      Array.from(
        menu.querySelectorAll<
          HTMLButtonElement
        >(
          'button:not([disabled])'
        )
      )

    if (
      items.length ===
      0
    ) {
      return
    }

    const activeIndex =
      items.indexOf(
        document.activeElement as
          HTMLButtonElement
      )

    if (
      event.key ===
      'Home'
    ) {
      items[0].focus()
      return
    }

    if (
      event.key ===
      'End'
    ) {
      items[
        items.length - 1
      ].focus()

      return
    }

    const direction =
      event.key ===
      'ArrowDown'
        ? 1
        : -1

    const nextIndex =
      activeIndex < 0
        ? 0
        : (
            activeIndex +
            direction +
            items.length
          ) %
          items.length

    items[
      nextIndex
    ].focus()
  }

  if (
    editor.selection.count ===
    0
  ) {
    return null
  }

  return (
    <div
      ref={menuRef}
      className="mq-context-menu"
      role="menu"
      aria-label="Ações da seleção"
      aria-busy={locked}
      style={{
        left:
          adjustedPosition.x,
        top:
          adjustedPosition.y
      }}
      onKeyDown={
        handleKeyDown
      }
      onContextMenu={(event) => {
        event.preventDefault()
        event.stopPropagation()
      }}
    >
      <div className="mq-context-menu__heading">
        <span>
          {editor.selection.count ===
          1
            ? editor.selection
                .name
            : `${editor.selection.count} elementos`}
        </span>

        <small>
          {editor.selection.role ||
            (
              multiple
                ? 'seleção'
                : 'elemento'
            )}
        </small>
      </div>

      <MenuSeparator />

      <MenuGroup label="Edição">
        <MenuItem
          icon="⧉"
          label="Copiar"
          shortcut="⌘/Ctrl C"
          disabled={locked}
          onClick={() =>
            runAsync(
              editor.copySelection
            )
          }
        />

        <MenuItem
          icon="⎘"
          label="Duplicar"
          shortcut="⌘/Ctrl D"
          disabled={locked}
          onClick={() =>
            runAsync(
              editor.duplicateSelection
            )
          }
        />

        <MenuItem
          icon="◈"
          label="Copiar estilo"
          shortcut="⌘/Ctrl Alt C"
          disabled={locked}
          onClick={() =>
            run(
              editor.copySelectionStyle
            )
          }
        />

        <MenuItem
          icon="◆"
          label="Colar estilo"
          shortcut="⌘/Ctrl Alt V"
          disabled={
            locked ||
            !editor.hasCopiedStyle
          }
          onClick={() =>
            run(
              editor.pasteSelectionStyle
            )
          }
        />
      </MenuGroup>

      {isImage ? (
        <>
          <MenuSeparator />

          <MenuGroup label="Imagem">
            <MenuItem
              icon="↻"
              label="Substituir imagem"
              disabled={locked}
              onClick={() =>
                run(
                  () =>
                    editor.replacementImageInputRef
                      .current
                      ?.click()
                )
              }
            />

            <MenuItem
              icon="▣"
              label="Definir como fundo"
              disabled={locked}
              onClick={() =>
                run(
                  editor.setImageAsBackground
                )
              }
            />

            <MenuItem
              icon="⌗"
              label="Recortar imagem"
              disabled={locked}
              onClick={() =>
                run(
                  editor.beginImageCrop
                )
              }
            />
          </MenuGroup>
        </>
      ) : null}

      <MenuSeparator />

      <MenuGroup label="Organizar">
        <MenuItem
          icon="⇈"
          label="Trazer para a frente"
          disabled={locked}
          onClick={() =>
            run(
              () =>
                editor.arrangeSelection(
                  'front'
                )
            )
          }
        />

        <MenuItem
          icon="↑"
          label="Avançar uma camada"
          disabled={locked}
          onClick={() =>
            run(
              () =>
                editor.arrangeSelection(
                  'forward'
                )
            )
          }
        />

        <MenuItem
          icon="↓"
          label="Recuar uma camada"
          disabled={locked}
          onClick={() =>
            run(
              () =>
                editor.arrangeSelection(
                  'backward'
                )
            )
          }
        />

        <MenuItem
          icon="⇊"
          label="Enviar para trás"
          disabled={locked}
          onClick={() =>
            run(
              () =>
                editor.arrangeSelection(
                  'back'
                )
            )
          }
        />
      </MenuGroup>

      <MenuSeparator />

      <MenuGroup label="Alinhamento">
        <MenuItem
          icon="↔"
          label="Centrar horizontalmente"
          disabled={locked}
          onClick={() =>
            run(
              () =>
                editor.alignSelection(
                  'center-x'
                )
            )
          }
        />

        <MenuItem
          icon="↕"
          label="Centrar verticalmente"
          disabled={locked}
          onClick={() =>
            run(
              () =>
                editor.alignSelection(
                  'center-y'
                )
            )
          }
        />
      </MenuGroup>

      {multiple ||
      isGroup ? (
        <>
          <MenuSeparator />

          <MenuGroup label="Grupo">
            {multiple ? (
              <MenuItem
                icon="▣"
                label="Agrupar"
                disabled={locked}
                onClick={() =>
                  run(
                    editor.groupSelection
                  )
                }
              />
            ) : null}

            {isGroup ? (
              <MenuItem
                icon="▦"
                label="Desagrupar"
                disabled={locked}
                onClick={() =>
                  run(
                    editor.ungroupSelection
                  )
                }
              />
            ) : null}
          </MenuGroup>
        </>
      ) : null}

      <MenuSeparator />

      <MenuGroup label="Transformar">
        <MenuItem
          icon="⇆"
          label="Virar horizontalmente"
          disabled={locked}
          onClick={() =>
            run(
              () =>
                editor.setSelectionFlip(
                  'x'
                )
            )
          }
        />

        <MenuItem
          icon="⇅"
          label="Virar verticalmente"
          disabled={locked}
          onClick={() =>
            run(
              () =>
                editor.setSelectionFlip(
                  'y'
                )
            )
          }
        />

        {canLockRatio ? (
          <MenuItem
            icon={
              editor.selection
                .aspectLocked
                ? '🔒'
                : '🔓'
            }
            label={
              editor.selection
                .aspectLocked
                ? 'Desbloquear proporção'
                : 'Bloquear proporção'
            }
            disabled={locked}
            onClick={() =>
              run(
                () =>
                  editor.setSelectionAspectLocked(
                    !editor.selection
                      .aspectLocked
                  )
              )
            }
          />
        ) : null}
      </MenuGroup>

      <MenuSeparator />

      <MenuItem
        icon="⌫"
        label="Eliminar"
        shortcut="Delete"
        danger
        disabled={locked}
        onClick={() =>
          run(
            editor.deleteSelection
          )
        }
      />
    </div>
  )
}
