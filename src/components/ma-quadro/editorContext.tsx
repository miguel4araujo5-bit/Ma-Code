import {
  createContext,
  useContext,
  type ReactNode
} from 'react'

import type {
  MAQuadroEditor
} from './editorTypes'

const MAQuadroEditorContext =
  createContext<
    MAQuadroEditor | null
  >(null)

export function
MAQuadroEditorProvider({
  editor,
  children
}: {
  editor: MAQuadroEditor
  children: ReactNode
}) {
  return (
    <MAQuadroEditorContext.Provider
      value={editor}
    >
      {children}
    </MAQuadroEditorContext.Provider>
  )
}

export function
useMAQuadroEditorContext() {
  const context =
    useContext(
      MAQuadroEditorContext
    )

  if (!context) {
    throw new Error(
      'O contexto do MA-Quadro não está disponível.'
    )
  }

  return context
}
