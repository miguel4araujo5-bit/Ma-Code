import { useEffect, useState } from 'react'
import PdfBenefits from '../components/maPdf/PdfBenefits'
import PdfHero from '../components/maPdf/PdfHero'
import PdfToolGrid from '../components/maPdf/PdfToolGrid'
import PdfWorkbench from '../components/maPdf/PdfWorkbench'
import { setupMaPdfSeo } from '../lib/maPdf/seo'
import type { ActiveTool, PdfTool } from '../types/maPdf'

export default function MAPdfPage() {
  const [mounted, setMounted] = useState(false)
  const [activeTool, setActiveTool] = useState<ActiveTool>('merge')
  const [workbenchKey, setWorkbenchKey] = useState(0)

  useEffect(() => {
    setMounted(true)
    setupMaPdfSeo()
  }, [])

  const selectTool = (tool: PdfTool) => {
    if (!tool.available || !tool.activeTool) {
      return
    }

    setActiveTool(tool.activeTool)
    setWorkbenchKey((currentKey) => currentKey + 1)

    window.setTimeout(() => {
      document.getElementById('utilizar-ferramenta')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      })
    }, 50)
  }

  return (
    <main className="site-shell">
      <div className="site-bg-orb site-bg-orb-one" />
      <div className="site-bg-orb site-bg-orb-two" />
      <div className="site-bg-orb site-bg-orb-three" />
      <div className="site-grid" />
      <div className="site-noise" />

      <PdfHero mounted={mounted} />

      <PdfToolGrid
        mounted={mounted}
        activeTool={activeTool}
        onSelect={selectTool}
      />

      <PdfWorkbench
        key={`${activeTool}-${workbenchKey}`}
        activeTool={activeTool}
      />

      <PdfBenefits />
    </main>
  )
}
