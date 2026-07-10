import type { PdfTool } from '../types/maPdf'

export const pdfTools: PdfTool[] = [
  {
    id: 'juntar-pdf',
    title: 'Juntar PDF',
    description: 'Combine vários PDF num único documento de forma simples.',
    badge: 'PDF+',
    accent: 'cyan',
    activeTool: 'merge',
    available: true
  },
  {
    id: 'dividir-pdf',
    title: 'Dividir PDF',
    description: 'Separe páginas ou intervalos de um documento PDF.',
    badge: 'PDF÷',
    accent: 'violet',
    activeTool: 'split',
    available: true
  },
  {
    id: 'comprimir-pdf',
    title: 'Comprimir PDF',
    description: 'Otimize a estrutura do PDF e tente reduzir o seu tamanho.',
    badge: 'ZIP',
    accent: 'cyan',
    activeTool: 'compress',
    available: true
  },
  {
    id: 'pdf-para-word',
    title: 'PDF para Word',
    description:
      'Extraia o texto selecionável do PDF para um documento Word editável.',
    badge: 'W',
    accent: 'blue',
    activeTool: 'pdfToWord',
    available: true
  },
  {
    id: 'word-para-pdf',
    title: 'Word para PDF',
    description: 'Converta documentos Word de forma rápida para PDF.',
    badge: 'W→',
    accent: 'blue',
    available: false
  },
  {
    id: 'pdf-para-doc',
    title: 'PDF para DOC',
    description:
      'Extraia o texto selecionável do PDF para um ficheiro DOC editável.',
    badge: 'DOC',
    accent: 'blue',
    activeTool: 'pdfToDoc',
    available: true
  },
  {
    id: 'doc-para-pdf',
    title: 'DOC para PDF',
    description: 'Converta ficheiros DOC para PDF com qualidade.',
    badge: 'DOC→',
    accent: 'blue',
    available: false
  },
  {
    id: 'pdf-para-jpg',
    title: 'PDF para JPG',
    description: 'Converta cada página do PDF numa imagem JPG.',
    badge: 'JPG',
    accent: 'amber',
    activeTool: 'pdfToJpg',
    available: true
  },
  {
    id: 'jpg-para-pdf',
    title: 'JPG para PDF',
    description: 'Converta uma ou várias imagens JPG num PDF organizado.',
    badge: 'IMG',
    accent: 'amber',
    activeTool: 'jpgToPdf',
    available: true
  },
  {
    id: 'pdf-para-excel',
    title: 'PDF para Excel',
    description:
      'Extraia linhas e tabelas simples do PDF para um ficheiro Excel editável.',
    badge: 'XLS',
    accent: 'emerald',
    activeTool: 'pdfToExcel',
    available: true
  },
  {
    id: 'excel-para-pdf',
    title: 'Excel para PDF',
    description: 'Converta folhas de cálculo Excel para PDF com um clique.',
    badge: 'X→',
    accent: 'emerald',
    available: false
  },
  {
    id: 'pdf-para-powerpoint',
    title: 'PDF para PowerPoint',
    description: 'Converta PDF em apresentações PowerPoint editáveis.',
    badge: 'PPT',
    accent: 'orange',
    available: false
  },
  {
    id: 'powerpoint-para-pdf',
    title: 'PowerPoint para PDF',
    description: 'Transforme apresentações PowerPoint em PDF.',
    badge: 'P→',
    accent: 'orange',
    available: false
  },
  {
    id: 'editar-pdf',
    title: 'Editar PDF',
    description: 'Adicione texto, imagens, formas e anotações com facilidade.',
    badge: '✎',
    accent: 'violet',
    available: false
  },
  {
    id: 'assinar-pdf',
    title: 'Assinar PDF',
    description: 'Adicione uma imagem da sua assinatura ao documento PDF.',
    badge: 'SIG',
    accent: 'cyan',
    activeTool: 'sign',
    available: true
  },
  {
    id: 'marca-de-agua',
    title: 'Marca de água',
    description: 'Adicione uma marca de água de texto às páginas do seu PDF.',
    badge: 'WM',
    accent: 'violet',
    activeTool: 'watermark',
    available: true
  }
]
