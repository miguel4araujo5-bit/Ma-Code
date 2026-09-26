export type HelpCategoryId =
  | 'getting-started'
  | 'daily-work'
  | 'planning'
  | 'attendance'
  | 'security'
  | 'technical'

export interface HelpCategory {
  id: HelpCategoryId
  label: string
  description: string
}

export interface HelpArticle {
  id: string
  categoryId: HelpCategoryId
  title: string
  summary: string
  keywords: string[]
  steps: string[]
  note?: string
}

export const helpCategories: HelpCategory[] = [
  {
    id: 'getting-started',
    label: 'Começar e configurar',
    description: 'Configuração inicial, acesso e organização do ano letivo.'
  },
  {
    id: 'daily-work',
    label: 'Sumários e trabalho diário',
    description: 'Aulas, sumários, GIAE e tarefas do dia a dia.'
  },
  {
    id: 'planning',
    label: 'Planificações e UFCDs',
    description: 'Planificações, módulos, UCs e previsão de conclusão.'
  },
  {
    id: 'attendance',
    label: 'Faltas e recuperações',
    description: 'Assiduidade, alertas e atividades de recuperação.'
  },
  {
    id: 'security',
    label: 'Segurança e cópias',
    description: 'Password, sessões, cópias online e restauro.'
  },
  {
    id: 'technical',
    label: 'Problemas técnicos',
    description: 'Passos seguros para diagnosticar um comportamento inesperado.'
  }
]

export const helpArticles: HelpArticle[] = [
  {
    id: 'correct-initial-configuration',
    categoryId: 'getting-started',
    title: 'Corrigir a configuração inicial sem apagar o trabalho existente',
    summary: 'Use a opção de correção quando precisar de rever dados da configuração já concluída.',
    keywords: [
      'configuração',
      'corrigir',
      'assistente',
      'ano letivo',
      'apagar'
    ],
    steps: [
      'Abra Definições.',
      'Escolha “Corrigir configuração inicial”.',
      'Altere apenas a informação necessária e guarde normalmente.'
    ],
    note: '“Corrigir configuração inicial” é diferente das opções destrutivas de segurança e recuperação.'
  },
  {
    id: 'summary-giae-status',
    categoryId: 'daily-work',
    title: 'Perceber os estados dos sumários e do GIAE',
    summary: 'Confirme se a aula está apenas planeada ou se já foi registada e submetida.',
    keywords: [
      'sumário',
      'giae',
      'planeada',
      'registada',
      'submetida'
    ],
    steps: [
      'Abra Sumários / GIAE.',
      'Localize a aula e confirme o estado apresentado.',
      'Se necessário, abra a aula para rever o sumário e os indicadores de submissão.'
    ]
  },
  {
    id: 'ufcd-completion-forecast',
    categoryId: 'planning',
    title: 'A previsão de conclusão de uma UFCD aparece como indisponível',
    summary: 'A previsão depende do progresso já registado e das aulas futuras que podem ser projetadas.',
    keywords: [
      'ufcd',
      'módulo',
      'uc',
      'previsão',
      'conclusão',
      'sem conclusão prevista'
    ],
    steps: [
      'Abra Planificações e confirme se a UFCD ou módulo tem duração e ordem definidas.',
      'Confirme se o horário futuro contém aulas dessa disciplina.',
      'Verifique se feriados, interrupções ou outras regras de calendário não retiram todas as aulas futuras disponíveis.'
    ],
    note: 'Se a primeira UFCD tiver previsão mas as seguintes não tiverem, reporte o problema para podermos analisar a sequência projetada.'
  },
  {
    id: 'attendance-warning',
    categoryId: 'attendance',
    title: 'Um aviso de faltas ou recuperação não corresponde ao esperado',
    summary: 'Reveja primeiro a aula, a presença registada e o estado da recuperação antes de reportar.',
    keywords: [
      'faltas',
      'assiduidade',
      '10%',
      'recuperação',
      'avisos'
    ],
    steps: [
      'Abra Faltas e recuperações.',
      'Confirme a disciplina e a UFCD ou UC associada ao aviso.',
      'Abra as aulas relevantes e confirme se as faltas e recuperações guardadas correspondem ao que pretende.'
    ]
  },
  {
    id: 'password-and-backup',
    categoryId: 'security',
    title: 'Password, acesso e cópias online',
    summary: 'A password deve ser guardada pelo professor e não deve ser enviada num pedido de suporte.',
    keywords: [
      'password',
      'palavra passe',
      'opaque',
      'backup',
      'cópia online',
      'restauro'
    ],
    steps: [
      'Nunca inclua a sua password numa mensagem de suporte.',
      'Para questões de segurança ou recuperação, abra Definições > Segurança e recuperação.',
      'Antes de restaurar ou apagar dados, leia a confirmação apresentada pela aplicação.'
    ],
    note: 'O apoio técnico não precisa da sua password para diagnosticar um problema.'
  },
  {
    id: 'technical-problem-safe-report',
    categoryId: 'technical',
    title: 'Reportar um problema técnico com segurança',
    summary: 'Envie apenas o contexto necessário e evite incluir dados pessoais ou escolares.',
    keywords: [
      'erro',
      'bug',
      'crash',
      'reportar',
      'suporte',
      'privacidade'
    ],
    steps: [
      'Tente descrever o que esperava que acontecesse e o que aconteceu realmente.',
      'Não inclua nomes de alunos, classificações, emails, números de identificação ou passwords.',
      'Use “Reportar problema técnico” apenas quando a base de ajuda não resolver a situação.'
    ],
    note: 'Nada é enviado automaticamente quando consulta esta base de ajuda.'
  }
]

function normalizeSearchText(
  value: string
) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function searchHelpArticles(
  query: string,
  categoryId: HelpCategoryId | 'all' = 'all'
) {
  const normalizedQuery =
    normalizeSearchText(query)

  const terms =
    normalizedQuery
      .split(/\s+/)
      .filter(Boolean)

  return helpArticles.filter(article => {
    if (
      categoryId !== 'all' &&
      article.categoryId !== categoryId
    ) {
      return false
    }

    if (terms.length === 0) {
      return true
    }

    const searchable =
      normalizeSearchText(
        [
          article.title,
          article.summary,
          ...article.keywords,
          ...article.steps,
          article.note || ''
        ].join(' ')
      )

    return terms.every(term =>
      searchable.includes(term)
    )
  })
}
