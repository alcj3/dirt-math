import { useRef } from 'react'

function Sidebar({ onFileSelect }) {
  const inputRef = useRef(null)

  function handleChange(e) {
    const file = e.target.files[0]
    if (file) onFileSelect(file)
  }

  return (
    <aside className="sidebar">
      <h1 className="sidebar-title">dirt math</h1>
      <div className="sidebar-section">
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          onChange={handleChange}
          style={{ display: 'none' }}
        />
        <button className="upload-btn" onClick={() => inputRef.current.click()}>
          Upload blueprint
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
