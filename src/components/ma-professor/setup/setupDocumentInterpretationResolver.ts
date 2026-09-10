export type SetupInterpretationKind =
  | 'schedule'
  | 'planification'
  | 'criteria'

export type SetupInterpretationConfidence =
  | 'high'
  | 'medium'
  | 'low'

export interface SetupInterpretationProposal {
  kind: SetupInterpretationKind
  baseScore: number
  structuralEvidence: boolean
  explicitEvidence: boolean
  internallyConsistent: boolean
  negativeEvidence: string[]
  evidence: string[]
}

export interface ResolvedSetupInterpretation {
  kind: SetupInterpretationKind | 'unknown'
  confidence: SetupInterpretationConfidence
  evidence: string[]
  warnings: string[]
  ranked: Array<{
    kind: SetupInterpretationKind
    score: number
    structuralEvidence: boolean
    internallyConsistent: boolean
  }>
}

function proposalScore(
  proposal: SetupInterpretationProposal
) {
  let score = proposal.baseScore

  if (proposal.structuralEvidence) {
    score += 3
  }

  if (proposal.internallyConsistent) {
    score += 2
  }

  if (proposal.explicitEvidence) {
    score += 1
  }

  score -= Math.min(
    8,
    proposal.negativeEvidence.length * 3
  )

  return Math.max(0, score)
}

function isViable(
  proposal: SetupInterpretationProposal,
  score: number
) {
  if (score < 6) {
    return false
  }

  return (
    proposal.structuralEvidence ||
    proposal.explicitEvidence
  )
}

export function resolveSetupDocumentInterpretation(
  proposals: SetupInterpretationProposal[]
): ResolvedSetupInterpretation {
  const ranked = proposals
    .map(proposal => ({
      proposal,
      score: proposalScore(proposal)
    }))
    .sort((left, right) =>
      right.score - left.score
    )

  const best = ranked[0]
  const second = ranked[1]

  if (
    !best ||
    !isViable(best.proposal, best.score)
  ) {
    return {
      kind: 'unknown',
      confidence: 'low',
      evidence: [
        'As provas disponíveis não sustentam uma interpretação estrutural segura.'
      ],
      warnings: [
        'Confirme manualmente o tipo de documento antes de continuar.'
      ],
      ranked: ranked.map(item => ({
        kind: item.proposal.kind,
        score: item.score,
        structuralEvidence:
          item.proposal.structuralEvidence,
        internallyConsistent:
          item.proposal.internallyConsistent
      }))
    }
  }

  const secondScore = second?.score ?? 0
  const margin = best.score - secondScore

  if (margin < 2) {
    return {
      kind: 'unknown',
      confidence: 'low',
      evidence: [
        'Há duas interpretações com força semelhante e o sistema não escolheu uma delas automaticamente.'
      ],
      warnings: [
        'Confirme manualmente o tipo de documento antes de continuar.'
      ],
      ranked: ranked.map(item => ({
        kind: item.proposal.kind,
        score: item.score,
        structuralEvidence:
          item.proposal.structuralEvidence,
        internallyConsistent:
          item.proposal.internallyConsistent
      }))
    }
  }

  const confidence: SetupInterpretationConfidence =
    best.score >= 15 &&
    margin >= 5 &&
    best.proposal.structuralEvidence &&
    best.proposal.internallyConsistent
      ? 'high'
      : best.score >= 9 && margin >= 3
        ? 'medium'
        : 'low'

  if (confidence === 'low') {
    return {
      kind: 'unknown',
      confidence,
      evidence: [
        'A interpretação mais provável ainda não tem evidência suficiente para ser aplicada automaticamente.'
      ],
      warnings: [
        'Confirme manualmente o tipo de documento antes de continuar.'
      ],
      ranked: ranked.map(item => ({
        kind: item.proposal.kind,
        score: item.score,
        structuralEvidence:
          item.proposal.structuralEvidence,
        internallyConsistent:
          item.proposal.internallyConsistent
      }))
    }
  }

  const warnings = [
    ...best.proposal.negativeEvidence
  ]

  return {
    kind: best.proposal.kind,
    confidence,
    evidence: best.proposal.evidence,
    warnings,
    ranked: ranked.map(item => ({
      kind: item.proposal.kind,
      score: item.score,
      structuralEvidence:
        item.proposal.structuralEvidence,
      internallyConsistent:
        item.proposal.internallyConsistent
    }))
  }
}
