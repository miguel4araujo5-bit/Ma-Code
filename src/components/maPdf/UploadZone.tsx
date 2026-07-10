import {
  useState,
  type ChangeEvent,
  type DragEvent,
  type RefObject
} from 'react'

type UploadZoneProps = {
  multiple: boolean
  inputRef: RefObject<HTMLInputElement | null>
  onFiles: (files: File[]) => void
}

export default function UploadZone({
  multiple,
  inputRef,
  onFiles
}: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false)

  const processFileList = (fileList: FileList | null) => {
    if (!fileList) {
      return
    }

    onFiles(Array.from(fileList))
  }

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    processFileList(event.target.files)
    event.target.value = ''
  }

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    setIsDragging(true)
  }

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
    processFileList(event.dataTransfer.files)
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`rounded-[2rem] border-2 border-dashed p-6 text-center transition md:p-10 ${
        isDragging
          ? 'border-cyan-200 bg-cyan-300/[0.12]'
          : 'border-cyan-300/20 bg-slate-950/50 hover:border-cyan-200/40 hover:bg-slate-900/60'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        multiple={multiple}
        onChange={handleInputChange}
        className="hidden"
      />

      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-300/10 text-2xl text-cyan-100">
        ↑
      </div>

      <h3 className="mt-5 text-xl font-semibold text-white">
        Arraste {multiple ? 'os ficheiros PDF' : 'o ficheiro PDF'} para aqui
      </h3>

      <p className="mt-2 text-sm leading-6 text-slate-400">
        O processamento acontece no seu navegador. Os ficheiros não são enviados
        para servidores.
      </p>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="btn-primary hightech-button mt-6"
      >
        <span className="btn-shine" />

        <span className="relative z-10">
          {multiple ? 'Escolher ficheiros PDF' : 'Escolher ficheiro PDF'}
        </span>
      </button>

      <p className="mt-4 text-xs text-slate-500">
        Tamanho máximo recomendado: 100 MB por ficheiro
      </p>
    </div>
  )
}
