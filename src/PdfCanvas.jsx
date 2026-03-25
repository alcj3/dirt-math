import { useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString()

const MIN_ZOOM = 0.25
const MAX_ZOOM = 8
const INITIAL_PAN = { x: 24, y: 24 }

function PdfCanvas({ file, calibrating, onLineDrawn }) {
  const containerRef = useRef(null)
  const canvasRef = useRef(null)
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })

  // Use refs for transform so wheel/drag handlers never have stale values
  const zoomRef = useRef(1)
  const panRef = useRef(INITIAL_PAN)
  const [renderTransform, setRenderTransform] = useState({ zoom: 1, pan: INITIAL_PAN })

  function applyTransform(zoom, pan) {
    zoomRef.current = zoom
    panRef.current = pan
    setRenderTransform({ zoom, pan })
  }

  // Calibration line state
  const [line, setLine] = useState(null)
  const drawing = useRef(false)

  // Pan drag state
  const dragging = useRef(false)
  const lastMouse = useRef({ x: 0, y: 0 })

  // Reset zoom/pan when a new file is loaded
  useEffect(() => {
    applyTransform(1, INITIAL_PAN)
  }, [file])

  // Render PDF
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
      canvas.width = scaledViewport.width
      canvas.height = scaledViewport.height
      setCanvasSize({ width: scaledViewport.width, height: scaledViewport.height })

      await page.render({ canvasContext: canvas.getContext('2d'), viewport: scaledViewport }).promise
    }

    render()
    return () => { cancelled = true }
  }, [file])

  // Clear calibration line when a new calibration session starts
  useEffect(() => {
    if (calibrating) setLine(null)
  }, [calibrating])

  // Wheel zoom — must use addEventListener to pass { passive: false }
  useEffect(() => {
    const container = containerRef.current

    function handleWheel(e) {
      e.preventDefault()
      const rect = container.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top

      const factor = Math.pow(0.999, e.deltaY)
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoomRef.current * factor))
      const newPan = {
        x: mx - (mx - panRef.current.x) * (newZoom / zoomRef.current),
        y: my - (my - panRef.current.y) * (newZoom / zoomRef.current),
      }
      applyTransform(newZoom, newPan)
    }

    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => container.removeEventListener('wheel', handleWheel)
  }, [])

  // Pan — mouse drag on the container
  function handleContainerMouseDown(e) {
    if (calibrating) return
    dragging.current = true
    lastMouse.current = { x: e.clientX, y: e.clientY }
    containerRef.current.style.cursor = 'grabbing'
  }

  function handleContainerMouseMove(e) {
    if (!dragging.current) return
    const dx = e.clientX - lastMouse.current.x
    const dy = e.clientY - lastMouse.current.y
    lastMouse.current = { x: e.clientX, y: e.clientY }
    const newPan = { x: panRef.current.x + dx, y: panRef.current.y + dy }
    applyTransform(zoomRef.current, newPan)
  }

  function stopDrag() {
    if (!dragging.current) return
    dragging.current = false
    if (containerRef.current) containerRef.current.style.cursor = 'grab'
  }

  // Calibration line drawing on the SVG overlay
  // Dividing by zoom converts from screen-space to canvas-space coordinates
  function getSVGCoords(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) / zoomRef.current,
      y: (e.clientY - rect.top) / zoomRef.current,
    }
  }

  function handleSVGMouseDown(e) {
    e.stopPropagation()
    const { x, y } = getSVGCoords(e)
    setLine({ x1: x, y1: y, x2: x, y2: y })
    drawing.current = true
  }

  function handleSVGMouseMove(e) {
    if (!drawing.current) return
    const { x, y } = getSVGCoords(e)
    setLine(prev => prev ? { ...prev, x2: x, y2: y } : null)
  }

  function handleSVGMouseUp(e) {
    if (!drawing.current) return
    drawing.current = false
    const { x, y } = getSVGCoords(e)
    setLine(prev => {
      if (!prev) return null
      const final = { ...prev, x2: x, y2: y }
      const dx = final.x2 - final.x1
      const dy = final.y2 - final.y1
      const lengthPx = Math.sqrt(dx * dx + dy * dy)
      if (lengthPx > 5) onLineDrawn(lengthPx)
      return final
    })
  }

  const { zoom, pan } = renderTransform
  const wrapperStyle = {
    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
    transformOrigin: 'top left',
  }

  return (
    <div
      ref={containerRef}
      className="pdf-canvas-container"
      style={{ cursor: calibrating ? 'default' : 'grab' }}
      onMouseDown={handleContainerMouseDown}
      onMouseMove={handleContainerMouseMove}
      onMouseUp={stopDrag}
      onMouseLeave={stopDrag}
    >
      <div className="canvas-wrapper" style={wrapperStyle}>
        <canvas ref={canvasRef} />
        {calibrating && (
          <svg
            className="calibration-overlay"
            width={canvasSize.width}
            height={canvasSize.height}
            onMouseDown={handleSVGMouseDown}
            onMouseMove={handleSVGMouseMove}
            onMouseUp={handleSVGMouseUp}
          >
            {line && (
              <>
                <line
                  x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2}
                  stroke="#f59e0b" strokeWidth={2 / zoom} strokeLinecap="round"
                />
                <circle cx={line.x1} cy={line.y1} r={5 / zoom} fill="#f59e0b" />
                <circle cx={line.x2} cy={line.y2} r={5 / zoom} fill="#f59e0b" />
              </>
            )}
          </svg>
        )}
      </div>
    </div>
  )
}

export default PdfCanvas
