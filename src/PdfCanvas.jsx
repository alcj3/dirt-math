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
  // renderZoom: the zoom level at which the canvas is currently rendered
  // zoom may differ during a gesture; cssScale = zoom / renderZoom bridges the gap
  const renderZoomRef = useRef(1)
  const [renderTransform, setRenderTransform] = useState({ zoom: 1, pan: INITIAL_PAN, renderZoom: 1 })

  // Base size of the PDF at zoom=1 (used for SVG viewBox coordinate system)
  const [baseSize, setBaseSize] = useState({ width: 0, height: 0 })
  const rerenderTimerRef = useRef(null)

  // PDF document and page state
  const pdfDocRef = useRef(null)
  const [pageNum, setPageNum] = useState(1)
  const [numPages, setNumPages] = useState(0)
  const [rotation, setRotation] = useState(0)

  function applyTransform(zoom, pan) {
    zoomRef.current = zoom
    panRef.current = pan
    setRenderTransform(prev => ({ ...prev, zoom, pan }))
  }

  function applyRenderZoom(rz) {
    renderZoomRef.current = rz
    setRenderTransform(prev => ({ ...prev, renderZoom: rz }))
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
    applyRenderZoom(1)
    setPageNum(1)
    setNumPages(0)
    setRotation(0)
    setBaseSize({ width: 0, height: 0 })
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

  // Render the current page at a given zoom level for crisp pixels
  const renderPageAtZoom = useRef(null)
  useEffect(() => {
    renderPageAtZoom.current = async function(targetZoom) {
      if (!pdfDocRef.current || numPages === 0) return
      const page = await pdfDocRef.current.getPage(pageNum)

      const containerWidth = containerRef.current.clientWidth
      const viewport = page.getViewport({ scale: 1, rotation })
      const baseScale = containerWidth / viewport.width
      const scale = baseScale * targetZoom
      const scaledViewport = page.getViewport({ scale, rotation })

      const canvas = canvasRef.current
      canvas.width = scaledViewport.width
      canvas.height = scaledViewport.height
      setCanvasSize({ width: scaledViewport.width, height: scaledViewport.height })
      setBaseSize({ width: scaledViewport.width / targetZoom, height: scaledViewport.height / targetZoom })

      await page.render({ canvasContext: canvas.getContext('2d'), viewport: scaledViewport }).promise
      applyRenderZoom(targetZoom)
    }
  })

  // Re-render on page/rotation changes (at current zoom)
  useEffect(() => {
    if (!pdfDocRef.current || numPages === 0) return
    renderPageAtZoom.current(zoomRef.current).catch(() => {})
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
      // Normalize deltaY across deltaMode: mice can report in pixels (mode 0, ~100/notch),
      // lines (mode 1, ~3/notch), or pages (mode 2, ~1/notch). Convert everything to a
      // pixel-equivalent so zoom speed is consistent between trackpads and scroll wheels.
      let delta = e.deltaY
      if (e.deltaMode === 1) delta *= 20   // lines → pixels
      if (e.deltaMode === 2) delta *= 400  // pages → pixels
      // Cap per-event delta so a single mouse notch never causes a huge jump
      delta = Math.max(-100, Math.min(100, delta))
      const factor = Math.pow(0.999, delta)
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoomRef.current * factor))
      applyTransform(newZoom, {
        x: mx - (mx - panRef.current.x) * (newZoom / zoomRef.current),
        y: my - (my - panRef.current.y) * (newZoom / zoomRef.current),
      })
      // Debounce the actual re-render so we get crisp pixels after zooming stops
      clearTimeout(rerenderTimerRef.current)
      rerenderTimerRef.current = setTimeout(() => {
        renderPageAtZoom.current?.(zoomRef.current)
      }, 250)
    }
    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => container.removeEventListener('wheel', handleWheel)
  }, [])

  // Container mouse handlers — left-click pans normally; right-click always pans
  function handleContainerMouseDown(e) {
    if (e.button === 2) {
      // Right-click drag: pan even while drawing/calibrating
      dragging.current = true
      lastMouse.current = { x: e.clientX, y: e.clientY }
      containerRef.current.style.cursor = 'grabbing'
      return
    }
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

  // Convert screen coords to base-scale canvas coords using SVG's own transform
  function getSVGCoords(e) {
    const svg = e.currentTarget
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const svgP = pt.matrixTransform(svg.getScreenCTM().inverse())
    return { x: svgP.x, y: svgP.y }
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

  const { zoom, pan, renderZoom } = renderTransform
  const snapRadius = SNAP_SCREEN_PX / zoom

  // Is cursor near the first zone point (to show snap indicator)?
  const nearFirst = drawingZone && activePoints.length >= 3 && cursorPos && (() => {
    const f = activePoints[0]
    const dx = cursorPos.x - f.x, dy = cursorPos.y - f.y
    return Math.sqrt(dx * dx + dy * dy) <= snapRadius
  })()

  // Canvas is rendered at renderZoom resolution. CSS scale bridges the gap
  // to the current visual zoom so panning feels instant while re-render catches up.
  const cssScale = renderZoom > 0 ? zoom / renderZoom : 1
  const wrapperStyle = {
    transform: `translate(${pan.x}px, ${pan.y}px) scale(${cssScale})`,
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
      onContextMenu={e => e.preventDefault()}
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
          viewBox={`0 0 ${baseSize.width} ${baseSize.height}`}
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
              stroke="#f97316"
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
              stroke="rgba(249,115,22,0.6)"
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
              fill="rgba(249,115,22,0.15)"
              stroke="#f97316"
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
