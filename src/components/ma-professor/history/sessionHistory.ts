/**
 * Histórico reversível da sessão do MA-Professor.
 *
 * Não persiste em IndexedDB nem na cloud. Os repositórios que utilizem
 * este serviço devem registar apenas operações já confirmadas e fornecer
 * callbacks transacionais, com verificação de conflitos antes de escrever.
 */
export interface HistoryOperation {
  label: string
  undo: () => Promise<void>
  redo: () => Promise<void>
  navigate?: () => void
}

export interface HistoryState {
  canUndo: boolean
  canRedo: boolean
  undoLabel: string | null
  redoLabel: string | null
  busy: boolean
}

export class SessionHistory {
  private past: HistoryOperation[] = []
  private future: HistoryOperation[] = []
  private busy = false
  private mutations = 0
  private listeners = new Set<() => void>()
  private scope: string | null = null
  private revision = 0

  constructor(private readonly limit = 50) {
    if (!Number.isInteger(limit) || limit < 1) {
      throw new Error('O limite do histórico deve ser positivo.')
    }
  }

  getState(): HistoryState {
    return {
      canUndo: !this.busy && !this.mutations && this.past.length > 0,
      canRedo: !this.busy && !this.mutations && this.future.length > 0,
      undoLabel: this.past.at(-1)?.label ?? null,
      redoLabel: this.future.at(-1)?.label ?? null,
      busy: this.busy || this.mutations > 0
    }
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  private notify() {
    for (const listener of this.listeners) {
      try { listener() } catch { /* Um observador não pode interromper a persistência. */ }
    }
  }

  /** Isola o histórico por conta e ano letivo, sem persistir dados pessoais. */
  setScope(scope: string): void {
    if (this.busy) throw new Error('Aguarde pela conclusão da reversão.')
    if (this.scope === scope) return
    this.scope = scope
    this.clear()
  }

  beginMutation(): () => void {
    if (this.busy) throw new Error('Aguarde pela conclusão de Desfazer ou Refazer.')
    this.mutations++
    this.notify()
    let ended = false
    return () => {
      if (ended) return
      ended = true
      this.mutations--
      this.notify()
    }
  }

  getRevision(): number {
    return this.revision
  }

  record(operation: HistoryOperation): void {
    if (this.busy) throw new Error('Não é possível registar alterações durante uma reversão.')
    this.past.push(operation)
    if (this.past.length > this.limit) this.past.shift()
    this.future = []
    this.notify()
  }

  clear(): void {
    if (this.busy) throw new Error('Aguarde pela conclusão da reversão.')
    this.revision++
    this.past = []
    this.future = []
    this.notify()
  }

  async undo(): Promise<boolean> {
    return this.run('undo')
  }

  async redo(): Promise<boolean> {
    return this.run('redo')
  }

  private async run(direction: 'undo' | 'redo'): Promise<boolean> {
    if (this.busy || this.mutations) return false
    const source = direction === 'undo' ? this.past : this.future
    const target = direction === 'undo' ? this.future : this.past
    const operation = source.at(-1)
    if (!operation) return false

    this.busy = true
    this.notify()
    try {
      // Só deslocar o cursor depois de a escrita ter sido confirmada.
      // Em caso de falha, manter a operação disponível para nova tentativa.
      await operation[direction]()
      source.pop()
      target.push(operation)
      if (target.length > this.limit) target.shift()
      // A navegação é auxiliar: uma falha visual não pode desfazer uma
      // operação que já foi confirmada na base de dados.
      try {
        operation.navigate?.()
      } catch {
        // A interface poderá ser atualizada manualmente.
      }
      return true
    } finally {
      this.busy = false
      this.notify()
    }
  }
}

export const maProfessorHistory = new SessionHistory(50)
