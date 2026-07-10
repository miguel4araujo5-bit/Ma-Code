export default function JpgToPdfInfo() {
  return (
    <div className="mt-6 rounded-[1.6rem] border border-amber-300/20 bg-amber-300/[0.06] p-5">
      <strong className="block text-sm text-amber-100">
        Uma imagem por página
      </strong>

      <p className="mt-2 text-sm leading-6 text-slate-300">
        Cada imagem será colocada numa página A4. A orientação muda
        automaticamente entre vertical e horizontal para aproveitar melhor o
        espaço, sem cortar nem deformar a imagem.
      </p>

      <p className="mt-3 text-xs leading-5 text-slate-400">
        As páginas serão criadas pela ordem apresentada acima. Utilize as setas
        para organizar as imagens antes de converter.
      </p>
    </div>
  )
}
