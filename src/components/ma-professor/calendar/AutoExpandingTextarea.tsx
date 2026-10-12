import { useCallback, useLayoutEffect, useRef, type TextareaHTMLAttributes } from 'react'

export default function AutoExpandingTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const fitContent = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea || textarea.clientWidth === 0) return

    textarea.style.height = 'auto'
    const styles = window.getComputedStyle(textarea)
    const padding = parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom)
    const border = parseFloat(styles.borderTopWidth) + parseFloat(styles.borderBottomWidth)
    const adjustment = styles.boxSizing === 'border-box' ? border : -padding
    textarea.style.height = `${textarea.scrollHeight + adjustment}px`
  }, [])

  useLayoutEffect(fitContent, [fitContent, props.value, props.defaultValue, props.rows, props.className])

  useLayoutEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    let width = textarea.clientWidth
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => {
      if (textarea.clientWidth === width) return
      width = textarea.clientWidth
      fitContent()
    })
    observer?.observe(textarea)
    window.addEventListener('resize', fitContent)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', fitContent)
    }
  }, [fitContent])

  return <textarea {...props} ref={textareaRef} />
}
