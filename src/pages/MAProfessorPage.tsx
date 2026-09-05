import {
  useEffect
} from 'react'

import {
  MAProfessorProduct
} from '../components/ma-professor/product/MAProfessorProduct'

import AccessVerificationNotice from '../components/ma-professor/access/AccessVerificationNotice'
import MAProfessorActivationLinkGate from '../components/ma-professor/access/MAProfessorActivationLinkGate'
import MAProfessorAuthGate from '../components/ma-professor/access/MAProfessorAuthGate'
import SnapshotCapacityNotice from '../components/ma-professor/sync/SnapshotCapacityNotice'
import SyncStatePersistenceNotice from '../components/ma-professor/sync/SyncStatePersistenceNotice'

const siteUrl =
  'https://ma-code.pt'

const productPath =
  '/produtos/ma-professor'

function updateMeta(
  name: string,
  content: string
) {
  let meta =
    document.querySelector<HTMLMetaElement>(
      `meta[name="${name}"]`
    )

  if (!meta) {
    meta =
      document.createElement(
        'meta'
      )

    meta.name =
      name

    document.head.appendChild(
      meta
    )
  }

  meta.content =
    content
}

function updatePropertyMeta(
  property: string,
  content: string
) {
  let meta =
    document.querySelector<HTMLMetaElement>(
      `meta[property="${property}"]`
    )

  if (!meta) {
    meta =
      document.createElement(
        'meta'
      )

    meta.setAttribute(
      'property',
      property
    )

    document.head.appendChild(
      meta
    )
  }

  meta.content =
    content
}

function updateCanonical(
  href: string
) {
  let canonical =
    document.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]'
    )

  if (!canonical) {
    canonical =
      document.createElement(
        'link'
      )

    canonical.rel =
      'canonical'

    document.head.appendChild(
      canonical
    )
  }

  canonical.href =
    href
}

export default function MAProfessorPage() {
  useEffect(
    () => {
      document.title =
        'MA-Professor | Fase piloto para docentes'

      updateMeta(
        'description',
        'MA-Professor é um ambiente digital para organização do trabalho docente. A fase piloto tem acesso gratuito e vagas limitadas, mediante pedido de acesso.'
      )

      updateMeta(
        'keywords',
        'MA-Professor, gestão de sumários, UFCD, cursos profissionais, planificação de aulas, avaliações de alunos, faltas, recuperação de aprendizagens'
      )

      updateMeta(
        'robots',
        'noindex, nofollow, noarchive, nosnippet, noimageindex'
      )

      updatePropertyMeta(
        'og:type',
        'website'
      )

      updatePropertyMeta(
        'og:locale',
        'pt_PT'
      )

      updatePropertyMeta(
        'og:site_name',
        'MA-Code'
      )

      updatePropertyMeta(
        'og:url',
        `${siteUrl}${productPath}`
      )

      updatePropertyMeta(
        'og:title',
        'MA-Professor | Fase piloto'
      )

      updatePropertyMeta(
        'og:description',
        'Ambiente digital para organização do trabalho docente, atualmente em fase piloto com acesso gratuito e vagas limitadas.'
      )

      updatePropertyMeta(
        'og:image',
        `${siteUrl}/ma-code.png`
      )

      updateMeta(
        'twitter:card',
        'summary_large_image'
      )

      updateMeta(
        'twitter:title',
        'MA-Professor | Fase piloto'
      )

      updateMeta(
        'twitter:description',
        'MA-Professor em fase piloto: organização de aulas, sumários, turmas, assiduidade e avaliação para docentes.'
      )

      updateMeta(
        'twitter:image',
        `${siteUrl}/ma-code.png`
      )

      updateCanonical(
        `${siteUrl}${productPath}`
      )
    },
    []
  )

  return (
    <MAProfessorActivationLinkGate>
      <MAProfessorAuthGate>
        <>
          <AccessVerificationNotice />
          <SyncStatePersistenceNotice />
          <SnapshotCapacityNotice />
          <MAProfessorProduct />
        </>
      </MAProfessorAuthGate>
    </MAProfessorActivationLinkGate>
  )
}
