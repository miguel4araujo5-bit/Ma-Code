export type ProductWorkspace = 'daily' | 'calendar' | 'backup' | 'menu'
export type ManagementWorkspace = 'dashboard' | 'giae' | 'assessments' | 'criteria' | 'planifications' | 'groups'
export type ProductMenuTarget = ManagementWorkspace | 'attendance' | 'schedule' | 'configuration' | 'settings' | 'restore' | 'reset' | 'license'
export type ProductSidebarDestination = ProductMenuTarget | 'calendar'

export interface ProductMenuNavigationRequest {
  id: number
  target: ProductMenuTarget
}

export const primaryNavigation: Array<{ id: ProductWorkspace; label: string; icon: string }> = [
  { id: 'daily', label: 'Hoje', icon: '▤' },
  { id: 'calendar', label: 'Calendário', icon: '▦' },
  { id: 'menu', label: 'Menu', icon: '☰' }
]

export const menuDestinations: Array<{
  id: ProductMenuTarget
  label: string
  eyebrow: string
  description: string
  icon: string
}> = [
  { id: 'giae', label: 'Sumários / GIAE', eyebrow: 'Pedagogia', description: 'Consulte, copie e acompanhe a entrega dos sumários.', icon: '▤' },
  { id: 'assessments', label: 'Avaliações', eyebrow: 'Pedagogia', description: 'Consulte atividades, classificações e fechos de avaliação.', icon: '✓' },
  { id: 'criteria', label: 'Critérios de avaliação', eyebrow: 'Pedagogia', description: 'Consulte e edite critérios, ponderações e conjuntos de avaliação.', icon: '≡' },
  { id: 'planifications', label: 'Planificações', eyebrow: 'Pedagogia', description: 'Consulte e organize as planificações e o progresso das aprendizagens.', icon: '▤' },
  { id: 'groups', label: 'Turmas e alunos', eyebrow: 'Pedagogia', description: 'Edite as turmas e as listas de alunos.', icon: '▤' },
  { id: 'attendance', label: 'Faltas e recuperações', eyebrow: 'Acompanhamento', description: 'Consulte percentagens de faltas, alertas e atividades de recuperação.', icon: '✓' },
  { id: 'schedule', label: 'Horários', eyebrow: 'Organização', description: 'Altere o horário semanal e registe feriados, interrupções e outros eventos.', icon: '▦' },
  { id: 'settings', label: 'Definições', eyebrow: 'Configuração', description: 'Aceda ao perfil, pesquisa global, segurança e recuperação, exportações e licença.', icon: '⚙' }
]

export function isManagementWorkspaceTarget(target: string): target is ManagementWorkspace {
  return ['dashboard', 'giae', 'assessments', 'criteria', 'planifications', 'groups'].includes(target)
}

export function getMenuDestinationLabel(target: ProductMenuTarget) {
  if (target === 'dashboard') {
    return 'Painel do ano letivo'
  }

  if (target === 'configuration') {
    return 'Corrigir configuração inicial'
  }

  if (target === 'license') {
    return 'Licença'
  }

  if (target === 'reset') {
    return 'Segurança e recuperação'
  }

  return menuDestinations.find(item => item.id === target)!.label
}
