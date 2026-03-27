import { useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString()

const MIN_ZOOM = 0.25
const MAX_ZOOM = 8
const INITIAL_PAN = { x: 24, y: 24 }
// Snap radius in screen pixels — converted to canvas-space on use
const SNAP_SCREEN_PX = 14

function PdfCanvas({ file, calibrating, onLineDrawn, zones, drawingZone, activePoints, onPointAdd, onZoneClose, onPageChange }) {
  const containerRef = useRef(null)
  const canvasRef = useRef(null)
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })

  // Refs for transform so event handlers always have current values
  const zoomRef = useRef(1)
  const panRef = useRef(INITIAL_PAN)
  const [renderTransform, setRenderTransform] = useState({ zoom: 1, pan: INITIAL_PAN })

  // PDF document and page state
  const pdfDocRef = useRef(null)
  const [pageNum, setPageNum] = useState(1)
  const [numPages, setNumPages] = useState(0)
  const [rotation, setRotation] = useState(0)

  function applyTransform(zoom, pan) {
    zoomRef.current = zoom
    panRef.current = pan
    setRenderTransform({ zoom, pan })
  }

  // Calibration line
  const [calibLine, setCalibLine] = useState(null)
  const calibDrawing = useRef(false)

  // Zone drawing cursor preview
  const [cursorPos, setCursorPos] = useState(null)

  // Pan
  const dragging = useRef(false)
  const lastMouse = useRef({ x: 0, y: 0 })

  // Reset transform, page, and rotation when file changes
  useEffect(() => {
    applyTransform(1, INITIAL_PAN)
    setPageNum(1)
    setNumPages(0)
    setRotation(0)
    pdfDocRef.current = null
  }, [file])

  // Load PDF document once when file changes
  useEffect(() => {
    if (!file) return
    let cancelled = false

    async function loadDoc() {
      const arrayBuffer = await file.arrayBuffer()
      if (cancelled) return
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
      if (cancelled) return
      pdfDocRef.current = pdf
      setNumPages(pdf.numPages)
    }

    loadDoc()
    return () => { cancelled = true }
  }, [file])

  // Render current page whenever doc, pageNum, or rotation changes
  useEffect(() => {
    if (!pdfDocRef.current || numPages === 0) return
    let cancelled = false

    async function renderPage() {
      const page = await pdfDocRef.current.getPage(pageNum)
      if (cancelled) return

      const containerWidth = containerRef.current.clientWidth
      const viewport = page.getViewport({ scale: 1, rotation })
      const scale = containerWidth / viewport.width
      const scaledViewport = page.getViewport({ scale, rotation })

      const canvas = canvasRef.current
      canvas.width = scaledViewport.width
      canvas.height = scaledViewport.height
      setCanvasSize({ width: scaledViewport.width, height: scaledViewport.height })

      await page.render({ canvasContext: canvas.getContext('2d'), viewport: scaledViewport }).promise
    }

    renderPage()
    return () => { cancelled = true }
  }, [pageNum, numPages, rotation])

  function goToPrevPage() {
    if (pageNum <= 1) return
    setPageNum(p => p - 1)
    setRotation(0)
    onPageChange?.()
  }

  function goToNextPage() {
    if (pageNum >= numPages) return
    setPageNum(p => p + 1)
    setRotation(0)
    onPageChange?.()
  }

  function rotatePage() {
    setRotation(r => (r + 90) % 360)
  }

  useEffect(() => {
    if (calibrating) setCalibLine(null)
  }, [calibrating])

  // Wheel zoom — must be non-passive to call preventDefault
  useEffect(() => {
    const container = containerRef.current
    function handleWheel(e) {
      e.preventDefault()
      const rect = container.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const factor = Math.pow(0.999, e.deltaY)
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoomRef.current * factor))
      applyTransform(newZoom, {
        x: mx - (mx - panRef.current.x) * (newZoom / zoomRef.current),
        y: my - (my - panRef.current.y) * (newZoom / zoomRef.current),
      })
    }
    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => container.removeEventListener('wheel', handleWheel)
  }, [])

  // Container mouse handlers (pan only — disabled while drawing)
  function handleContainerMouseDown(e) {
    if (calibrating || drawingZone) return
    dragging.current = true
    lastMouse.current = { x: e.clientX, y: e.clientY }
    containerRef.current.style.cursor = 'grabbing'
  }

  function handleContainerMouseMove(e) {
    if (!dragging.current) return
    const dx = e.clientX - lastMouse.current.x
    const dy = e.clientY - lastMouse.current.y
    lastMouse.current = { x: e.clientX, y: e.clientY }
    applyTransform(zoomRef.current, { x: panRef.current.x + dx, y: panRef.current.y + dy })
  }

  function stopDrag() {
    if (!dragging.current) return
    dragging.current = false
    if (containerRef.current) {
      containerRef.current.style.cursor = drawingZone ? 'crosshair' : calibrating ? 'default' : 'grab'
    }
  }

  // Convert screen coords to canvas-space coords via the SVG's transformed bounding rect
  function getSVGCoords(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) / zoomRef.current,
      y: (e.clientY - rect.top) / zoomRef.current,
    }
  }

  // Calibration handlers
  function handleCalibMouseDown(e) {
    e.stopPropagation()
    const { x, y } = getSVGCoords(e)
    setCalibLine({ x1: x, y1: y, x2: x, y2: y })
    calibDrawing.current = true
  }

  function handleCalibMouseUp(e) {
    if (!calibDrawing.current) return
    calibDrawing.current = false
    const { x, y } = getSVGCoords(e)
    setCalibLine(prev => {
      if (!prev) return null
      const final = { ...prev, x2: x, y2: y }
      const dx = final.x2 - final.x1, dy = final.y2 - final.y1
      const len = Math.sqrt(dx * dx + dy * dy)
      if (len > 5) onLineDrawn(len)
      return final
    })
  }

  // SVG mousemove — used for calib drag and zone cursor preview
  function handleSVGMouseMove(e) {
    const { x, y } = getSVGCoords(e)
    if (calibrating && calibDrawing.current) {
      setCalibLine(prev => prev ? { ...prev, x2: x, y2: y } : null)
    }
    if (drawingZone) {
      setCursorPos({ x, y })
    }
  }

  // Zone drawing click
  function handleZoneClick(e) {
    const { x, y } = getSVGCoords(e)
    if (activePoints.length >= 3) {
      const first = activePoints[0]
      const dx = x - first.x, dy = y - first.y
      if (Math.sqrt(dx * dx + dy * dy) <= SNAP_SCREEN_PX / zoomRef.current) {
        onZoneClose()
        return
      }
    }
    onPointAdd({ x, y })
  }

  const { zoom, pan } = renderTransform
  const snapRadius = SNAP_SCREEN_PX / zoom

  // Is cursor near the first zone point (to show snap indicator)?
  const nearFirst = drawingZone && activePoints.length >= 3 && cursorPos && (() => {
    const f = activePoints[0]
    const dx = cursorPos.x - f.x, dy = cursorPos.y - f.y
    return Math.sqrt(dx * dx + dy * dy) <= snapRadius
  })()

  const wrapperStyle = {
    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
    transformOrigin: 'top left',
  }

  const svgActive = calibrating || drawingZone

  return (
    <div
      ref={containerRef}
      className="pdf-canvas-container"
      style={{ cursor: drawingZone ? 'crosshair' : calibrating ? 'default' : 'grab' }}
      onMouseDown={handleContainerMouseDown}
      onMouseMove={handleContainerMouseMove}
      onMouseUp={stopDrag}
      onMouseLeave={stopDrag}
    >
      {numPages > 0 && (
        <div className="page-nav">
          {numPages > 1 && (
            <>
              <button onClick={goToPrevPage} disabled={pageNum <= 1} className="page-nav-btn">&#8592;</button>
              <span className="page-nav-label">{pageNum} / {numPages}</span>
              <button onClick={goToNextPage} disabled={pageNum >= numPages} className="page-nav-btn">&#8594;</button>
              <span className="page-nav-divider" />
            </>
          )}
          <button onClick={rotatePage} className="page-nav-btn" title="Rotate 90°">&#8635;</button>
        </div>
      )}
      <div className="canvas-wrapper" style={wrapperStyle}>
        <canvas ref={canvasRef} />

        <svg
          className="drawing-overlay"
          width={canvasSize.width}
          height={canvasSize.height}
          style={{ pointerEvents: svgActive ? 'all' : 'none', cursor: svgActive ? 'crosshair' : 'default' }}
          onMouseDown={calibrating ? handleCalibMouseDown : undefined}
          onMouseMove={svgActive ? handleSVGMouseMove : undefined}
          onMouseUp={calibrating ? handleCalibMouseUp : undefined}
          onClick={drawingZone ? handleZoneClick : undefined}
          onMouseLeave={() => setCursorPos(null)}
        >
          {/* Completed zones */}
          {zones.map(zone => (
            <polygon
              key={zone.id}
              points={zone.points.map(p => `${p.x},${p.y}`).join(' ')}
              fill={zone.fill}
              stroke={zone.stroke}
              strokeWidth={1.5 / zoom}
              strokeLinejoin="round"
            />
          ))}

          {/* Active zone being drawn */}
          {activePoints.length > 1 && (
            <polyline
              points={activePoints.map(p => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke="white"
              strokeWidth={1.5 / zoom}
              strokeDasharray={`${6 / zoom},${3 / zoom}`}
              strokeLinecap="round"
            />
          )}
          {activePoints.length > 0 && cursorPos && (
            <line
              x1={activePoints[activePoints.length - 1].x}
              y1={activePoints[activePoints.length - 1].y}
              x2={cursorPos.x} y2={cursorPos.y}
              stroke="rgba(255,255,255,0.5)"
              strokeWidth={1.5 / zoom}
              strokeDasharray={`${6 / zoom},${3 / zoom}`}
              strokeLinecap="round"
            />
          )}
          {/* Snap ring on first point when cursor is close */}
          {nearFirst && (
            <circle
              cx={activePoints[0].x} cy={activePoints[0].y}
              r={snapRadius}
              fill="rgba(255,255,255,0.15)"
              stroke="white"
              strokeWidth={1.5 / zoom}
            />
          )}
          {/* Point dots */}
          {activePoints.map((p, i) => (
            <circle
              key={i}
              cx={p.x} cy={p.y}
              r={(i === 0 && nearFirst ? 6 : 4) / zoom}
              fill="#f97316"
              stroke="rgba(0,0,0,0.4)"
              strokeWidth={1 / zoom}
            />
          ))}

          {/* Calibration line */}
          {calibLine && (
            <>
              <line
                x1={calibLine.x1} y1={calibLine.y1} x2={calibLine.x2} y2={calibLine.y2}
                stroke="#f59e0b" strokeWidth={2 / zoom} strokeLinecap="round"
              />
              <circle cx={calibLine.x1} cy={calibLine.y1} r={5 / zoom} fill="#f59e0b" />
              <circle cx={calibLine.x2} cy={calibLine.y2} r={5 / zoom} fill="#f59e0b" />
            </>
          )}
        </svg>
      </div>
    </div>
  )
}

export default PdfCanvas
