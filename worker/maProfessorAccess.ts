import { useEffect } from 'react'

import { MAProfessorProduct } from '../components/ma-professor/product/MAProfessorProduct'

const siteUrl = 'https://ma-code.pt'
const productPath = '/produtos/ma-professor'

function updateMeta(
  name: string,
  content: string
) {
  let meta = document.querySelector<HTMLMetaElement>(
    `meta[name="${name}"]`
  )

  if (!meta) {
    meta = document.createElement('meta')
    meta.name = name
    document.head.appendChild(meta)
  }

  meta.content = content
}

function updatePropertyMeta(
  property: string,
  content: string
) {
  let meta = document.querySelector<HTMLMetaElement>(
    `meta[property="${property}"]`
  )

  if (!meta) {
    meta = document.createElement('meta')
    meta.setAttribute('property', property)
    document.head.appendChild(meta)
  }

  meta.content = content
}

function updateCanonical(href: string) {
  let canonical = document.querySelector<HTMLLinkElement>(
    'link[rel="canonical"]'
  )

  if (!canonical) {
    canonical = document.createElement('link')
    canonical.rel = 'canonical'
    document.head.appendChild(canonical)
  }

  canonical.href = href
}

export default function MAProfessorPage() {
  useEffect(() => {
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

    updatePropertyMeta('og:type', 'website')
    updatePropertyMeta('og:locale', 'pt_PT')
    updatePropertyMeta('og:site_name', 'MA-Code')
    updatePropertyMeta('og:url', `${siteUrl}${productPath}`)
    updatePropertyMeta(
      'og:title',
      'MA-Professor | Beta privada'
    )
    updatePropertyMeta(
      'og:description',
      'Aplicação para gestão de sumários, UFCD, avaliações, faltas, horários e recuperações de aprendizagens.'
    )
    updatePropertyMeta('og:image', `${siteUrl}/ma-code.png`)

    updateMeta('twitter:card', 'summary_large_image')
    updateMeta(
      'twitter:title',
      'MA-Professor | Beta privada'
    )
    updateMeta(
      'twitter:description',
      'Gestão de sumários, UFCD, avaliações, horários e faltas para professores.'
    )
    updateMeta('twitter:image', `${siteUrl}/ma-code.png`)

    updateCanonical(`${siteUrl}${productPath}`)
  }, [])

  return <MAProfessorProduct />
}
