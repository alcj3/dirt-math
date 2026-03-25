import { useEffect, useRef } from 'react'
import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString()

function PdfCanvas({ file }) {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    if (!file) return

    let cancelled = false

    async function render() {
      const arrayBuffer = await file.arrayBuffer()
      if (cancelled) return

      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
      if (cancelled) return

      const page = await pdf.getPage(1)
      if (cancelled) return

      const containerWidth = containerRef.current.clientWidth
      const viewport = page.getViewport({ scale: 1 })
      const scale = containerWidth / viewport.width
      const scaledViewport = page.getViewport({ scale })

      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      canvas.width = scaledViewport.width
      canvas.height = scaledViewport.height

      await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise
    }

    render()
    return () => { cancelled = true }
  }, [file])

  return (
    <div ref={containerRef} className="pdf-canvas-container">
      <canvas ref={canvasRef} />
    </div>
  )
}

export default PdfCanvas
