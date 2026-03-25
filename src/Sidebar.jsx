import { useRef, useState, useEffect } from 'react'
import { UNITS } from './App'

function Sidebar({
  file, onFileSelect,
  unit, onUnitChange,
  calibrating, calibrationLinePx, pixelsPerFoot,
  onCalibrateStart, onScaleConfirm,
}) {
  const fileInputRef = useRef(null)
  const [lengthInput, setLengthInput] = useState('')

  useEffect(() => {
    if (!calibrating) setLengthInput('')
  }, [calibrating])

  function handleFileChange(e) {
    const f = e.target.files[0]
    if (f) onFileSelect(f)
  }

  function handleConfirm() {
    const value = parseFloat(lengthInput)
    if (value > 0) onScaleConfirm(value)
  }

  // Display the stored scale in the current unit
  function scaleLabel() {
    if (!pixelsPerFoot) return null
    const pxPerUnit = pixelsPerFoot * UNITS[unit].feetPerUnit
    return `${pxPerUnit.toFixed(1)} px / ${UNITS[unit].abbr}`
  }

  return (
    <aside className="sidebar">
      <h1 className="sidebar-title">dirt math</h1>

      <div className="sidebar-section">
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
        <button className="btn-primary" onClick={() => fileInputRef.current.click()}>
          Upload blueprint
        </button>
      </div>

      <div className="sidebar-section">
        <span className="sidebar-label">Units</span>
        <div className="unit-selector">
          {Object.entries(UNITS).map(([key, { abbr }]) => (
            <button
              key={key}
              className={`unit-btn${unit === key ? ' active' : ''}`}
              onClick={() => onUnitChange(key)}
            >
              {abbr}
            </button>
          ))}
        </div>
      </div>

      {file && (
        <div className="sidebar-section">
          {!calibrating ? (
            <>
              <button className="btn-secondary" onClick={onCalibrateStart}>
                Calibrate scale
              </button>
              {pixelsPerFoot && (
                <p className="sidebar-hint">Scale: {scaleLabel()}</p>
              )}
            </>
          ) : calibrationLinePx ? (
            <>
              <label className="sidebar-label">
                What is this length in {UNITS[unit].label}?
              </label>
              <input
                className="sidebar-input"
                type="number"
                min="0"
                step="any"
                placeholder="e.g. 10"
                value={lengthInput}
                onChange={e => setLengthInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleConfirm()}
                autoFocus
              />
              <button
                className="btn-primary"
                onClick={handleConfirm}
                disabled={!lengthInput || parseFloat(lengthInput) <= 0}
              >
                Confirm
              </button>
              <button className="btn-ghost" onClick={onCalibrateStart}>
                Redraw line
              </button>
            </>
          ) : (
            <p className="sidebar-hint">
              Click and drag on the blueprint to mark a known distance.
            </p>
          )}
        </div>
      )}
    </aside>
  )
}

export default Sidebar
