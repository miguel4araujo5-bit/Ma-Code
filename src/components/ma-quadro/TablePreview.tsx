import {
  createMAQuadroTablePreviewUrl
} from '../../lib/maQuadro/tableSvg'

export default function TablePreview({
  svg
}: {
  svg: string
}) {
  return (
    <div
      className="mq-table-preview"
      aria-label="Pré-visualização da tabela"
    >
      <img
        src={
          createMAQuadroTablePreviewUrl(
            svg
          )
        }
        alt="Pré-visualização da tabela"
      />
    </div>
  )
}
