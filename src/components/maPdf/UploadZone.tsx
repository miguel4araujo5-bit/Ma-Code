import {
  useState,
  type ChangeEvent,
  type DragEvent,
  type RefObject
} from 'react'

type UploadFileType =
  | 'pdf'
  | 'jpg'
  | 'docx'

type UploadZoneProps = {
  multiple: boolean
  fileType: UploadFileType
  inputRef: RefObject<HTMLInputElement | null>
  onFiles: (files: File[]) => void
}

type UploadFileConfig = {
  acceptedTypes: string
  singularDropLabel: string
  pluralDropLabel: string
  singularButtonLabel: string
  pluralButtonLabel: string
}

const uploadFileConfigs: Record<
  UploadFileType,
  UploadFileConfig
> = {
  pdf: {
    acceptedTypes:
      '.pdf,application/pdf',
    singularDropLabel:
      'o ficheiro PDF',
    pluralDropLabel:
      'os ficheiros PDF',
    singularButtonLabel:
      'ficheiro PDF',
    pluralButtonLabel:
      'ficheiros PDF'
  },

  jpg: {
    acceptedTypes:
      '.jpg,.jpeg,image/jpeg',
    singularDropLabel:
      'a imagem JPG',
    pluralDropLabel:
      'as imagens JPG',
    singularButtonLabel:
      'imagem JPG',
    pluralButtonLabel:
      'imagens JPG'
  },

  docx: {
    acceptedTypes:
      '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    singularDropLabel:
      'o documento Word',
    pluralDropLabel:
      'os documentos Word',
    singularButtonLabel:
      'documento Word',
    pluralButtonLabel:
      'documentos Word'
  }
}

export default function UploadZone({
  multiple,
  fileType,
  inputRef,
  onFiles
}: UploadZoneProps) {
  const [isDragging, setIsDragging] =
    useState(false)

  const {
    acceptedTypes,
    singularDropLabel,
    pluralDropLabel,
    singularButtonLabel,
    pluralButtonLabel
  } = uploadFileConfigs[fileType]

  const processFileList = (
    fileList: FileList | null
  ) => {
    if (!fileList) {
      return
    }

    onFiles(
      Array.from(fileList)
    )
  }

  const handleInputChange = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    processFileList(
      event.target.files
    )

    event.target.value = ''
  }

  const handleDragOver = (
    event: DragEvent<HTMLDivElement>
  ) => {
    event.preventDefault()

    event.dataTransfer.dropEffect =
      'copy'

    setIsDragging(true)
  }

  const handleDragLeave = (
    event: DragEvent<HTMLDivElement>
  ) => {
    event.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (
    event: DragEvent<HTMLDivElement>
  ) => {
    event.preventDefault()
    setIsDragging(false)

    processFileList(
      event.dataTransfer.files
    )
  }

  return (
    <div
      onDragOver={
        handleDragOver
      }
      onDragLeave={
        handleDragLeave
      }
      onDrop={
        handleDrop
      }
      className={`rounded-[2rem] border-2 border-dashed p-6 text-center transition md:p-10 ${
        isDragging
          ? 'border-cyan-200 bg-cyan-300/[0.12]'
          : 'border-cyan-300/20 bg-slate-950/50 hover:border-cyan-200/40 hover:bg-slate-900/60'
      }`}
    >
      <input
        ref={
          inputRef
        }
        type="file"
        accept={
          acceptedTypes
        }
        multiple={
          multiple
        }
        onChange={
          handleInputChange
        }
        className="hidden"
      />

      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-300/10 text-2xl text-cyan-100">
        ↑
      </div>

      <h3 className="mt-5 text-xl font-semibold text-white">
        Arraste{' '}
        {multiple
          ? pluralDropLabel
          : singularDropLabel}{' '}
        para aqui
      </h3>

      <p className="mt-2 text-sm leading-6 text-slate-400">
        O processamento acontece no seu navegador.
        Os ficheiros não são enviados para servidores.
      </p>

      <button
        type="button"
        onClick={() =>
          inputRef.current?.click()
        }
        className="btn-primary hightech-button mt-6"
      >
        <span className="btn-shine" />

        <span className="relative z-10">
          {multiple
            ? `Escolher ${pluralButtonLabel}`
            : `Escolher ${singularButtonLabel}`}
        </span>
      </button>

      <p className="mt-4 text-xs text-slate-500">
        Tamanho máximo recomendado: 100 MB por ficheiro
      </p>
    </div>
  )
}
