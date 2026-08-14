import {
  useEffect
} from 'react'

import {
  MAProfessorProduct
} from '../components/ma-professor/product/MAProfessorProduct'

import MAProfessorAuthGate from '../components/ma-professor/access/MAProfessorAuthGate'

const siteUrl =
  'https://ma-code.pt'

const productPath =
  '/produtos/ma-professor'

function updateMeta(
  name: string,
  content: string
) {
  let element =
    document.querySelector(
      `meta[name="${name}"]`
    ) as HTMLMetaElement |
      null

  if (
    !element
  ) {
    element =
      document.createElement(
        'meta'
      )

    element.setAttribute(
      'name',
      name
    )

    document.head.appendChild(
      element
    )
  }

  element.setAttribute(
    'content',
    content
  )
}

function updatePropertyMeta(
  property: string,
  content: string
) {
  let element =
    document.querySelector(
      `meta[property="${property}"]`
    ) as HTMLMetaElement |
      null

  if (
    !element
  ) {
    element =
      document.createElement(
        'meta'
      )

    element.setAttribute(
      'property',
      property
    )

    document.head.appendChild(
      element
    )
  }

  element.setAttribute(
    'content',
    content
  )
}

function updateCanonical(
  href: string
) {
  let element =
    document.querySelector(
      'link[rel="canonical"]'
    ) as HTMLLinkElement |
      null

  if (
    !element
  ) {
    element =
      document.createElement(
        'link'
      )

    element.setAttribute(
      'rel',
      'canonical'
    )

    document.head.appendChild(
      element
    )
  }

  element.setAttribute(
    'href',
    href
  )
}

export default function MAProfessorPage() {
  useEffect(
    () => {
      document.title =
        'MA-Professor | Gestão de sumários, UFCD e avaliações'

      updateMeta(
        'description',
        'MA-Professor é uma aplicação da MA-Code para planificar aulas, criar sumários, controlar UFCD, registar avaliações, faltas e recuperações de aprendizagens.'
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
        'MA-Professor'
      )

      updatePropertyMeta(
        'og:description',
        'Aplicação para gestão de sumários, UFCD, avaliações, faltas e recuperações de aprendizagens.'
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
        'MA-Professor'
      )

      updateMeta(
        'twitter:description',
        'Gestão de sumários, UFCD, avaliações e faltas para professores.'
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
    <MAProfessorAuthGate>
      <MAProfessorProduct />
    </MAProfessorAuthGate>
  )
}
