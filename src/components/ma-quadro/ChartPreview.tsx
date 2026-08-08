import {
  createMAQuadroChartPreviewUrl
} from '../../lib/maQuadro/chartSvg'

export default function ChartPreview({
  svg
}: {
  svg: string
}) {
  return (
    <div
      className="mq-chart-preview"
      aria-label="Pré-visualização do gráfico"
    >
      <img
        src={
          createMAQuadroChartPreviewUrl(
            svg
          )
        }
        alt="Pré-visualização do gráfico"
      />
    </div>
  )
}
