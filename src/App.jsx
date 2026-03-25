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

function App() {
  const [file, setFile] = useState(null)
  const [unit, setUnit] = useState('ft')
  const [calibrating, setCalibrating] = useState(false)
  const [calibrationLinePx, setCalibrationLinePx] = useState(null)
  const [pixelsPerFoot, setPixelsPerFoot] = useState(null)

  function startCalibration() {
    setCalibrating(true)
    setCalibrationLinePx(null)
  }

  function handleScaleConfirm(inputValue) {
    const feet = inputValue * UNITS[unit].feetPerUnit
    setPixelsPerFoot(calibrationLinePx / feet)
    setCalibrating(false)
    setCalibrationLinePx(null)
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
        onLineDrawn={setCalibrationLinePx}
        onScaleConfirm={handleScaleConfirm}
      />
      <main className="canvas-area">
        {file
          ? <PdfCanvas file={file} calibrating={calibrating} onLineDrawn={setCalibrationLinePx} />
          : <div className="canvas-placeholder"><p>Upload a blueprint to get started</p></div>
        }
      </main>
    </div>
  )
}

export default App
