import { useState } from 'react'
import Sidebar from './Sidebar'
import PdfCanvas from './PdfCanvas'
import './App.css'

// feetPerUnit: how many feet are in one of this unit
export const UNITS = {
  ft: { label: 'feet', abbr: 'ft', feetPerUnit: 1 },
  in: { label: 'inches', abbr: 'in', feetPerUnit: 1 / 12 },
  yd: { label: 'yards', abbr: 'yd', feetPerUnit: 3 },
  m:  { label: 'meters', abbr: 'm',  feetPerUnit: 1 / 0.3048 },
}

export const ZONE_COLORS = [
  { fill: 'rgba(59,130,246,0.25)',  stroke: 'rgba(37,99,235,0.85)' },
  { fill: 'rgba(34,197,94,0.25)',   stroke: 'rgba(22,163,74,0.85)' },
  { fill: 'rgba(251,146,60,0.25)',  stroke: 'rgba(234,88,12,0.85)' },
  { fill: 'rgba(168,85,247,0.25)',  stroke: 'rgba(126,34,206,0.85)' },
  { fill: 'rgba(236,72,153,0.25)',  stroke: 'rgba(190,24,93,0.85)' },
  { fill: 'rgba(20,184,166,0.25)',  stroke: 'rgba(15,118,110,0.85)' },
]

function App() {
  const [file, setFile] = useState(null)
  const [unit, setUnit] = useState('ft')
  const [calibrating, setCalibrating] = useState(false)
  const [calibrationLinePx, setCalibrationLinePx] = useState(null)
  const [pixelsPerFoot, setPixelsPerFoot] = useState(null)
  const [zones, setZones] = useState([])
  const [drawingZone, setDrawingZone] = useState(false)
  const [activePoints, setActivePoints] = useState([])

  function startCalibration() {
    setDrawingZone(false)
    setActivePoints([])
    setCalibrating(true)
    setCalibrationLinePx(null)
  }

  function handleScaleConfirm(inputValue) {
    const feet = inputValue * UNITS[unit].feetPerUnit
    setPixelsPerFoot(calibrationLinePx / feet)
    setCalibrating(false)
    setCalibrationLinePx(null)
  }

  function toggleDrawZone() {
    if (drawingZone) {
      setDrawingZone(false)
      setActivePoints([])
    } else {
      setCalibrating(false)
      setCalibrationLinePx(null)
      setDrawingZone(true)
      setActivePoints([])
    }
  }

  function addPoint(point) {
    setActivePoints(prev => [...prev, point])
  }

  function closeZone() {
    const color = ZONE_COLORS[zones.length % ZONE_COLORS.length]
    setZones(prev => [...prev, {
      id: Date.now(),
      label: `Zone ${prev.length + 1}`,
      points: activePoints,
      ...color,
    }])
    setActivePoints([])
    // Stay in drawing mode so user can immediately draw another zone
  }

  function deleteZone(id) {
    setZones(prev => {
      const next = prev.filter(z => z.id !== id)
      // Re-number labels to stay sequential
      return next.map((z, i) => ({ ...z, label: `Zone ${i + 1}` }))
    })
  }

  function handlePageChange() {
    setZones([])
    setCalibrating(false)
    setCalibrationLinePx(null)
    setPixelsPerFoot(null)
    setDrawingZone(false)
    setActivePoints([])
  }

  return (
    <div className="layout">
      <Sidebar
        file={file}
        onFileSelect={setFile}
        unit={unit}
        onUnitChange={setUnit}
        calibrating={calibrating}
        calibrationLinePx={calibrationLinePx}
        pixelsPerFoot={pixelsPerFoot}
        onCalibrateStart={startCalibration}
        onScaleConfirm={handleScaleConfirm}
        zones={zones}
        drawingZone={drawingZone}
        onDrawZoneToggle={toggleDrawZone}
        onDeleteZone={deleteZone}
      />
      <main className="canvas-area">
        {file
          ? <PdfCanvas
              file={file}
              calibrating={calibrating}
              onLineDrawn={setCalibrationLinePx}
              zones={zones}
              drawingZone={drawingZone}
              activePoints={activePoints}
              onPointAdd={addPoint}
              onZoneClose={closeZone}
              onPageChange={handlePageChange}
            />
          : <div className="canvas-placeholder"><p>Upload a blueprint to get started</p></div>
        }
      </main>
    </div>
  )
}

export default App
