import { useState } from 'react'
import Sidebar from './Sidebar'
import './App.css'

function App() {
  const [file, setFile] = useState(null)

  return (
    <div className="layout">
      <Sidebar onFileSelect={setFile} />
      <main className="canvas-area">
        <div className="canvas-placeholder">
          {file ? <p>{file.name}</p> : <p>Blueprint canvas</p>}
        </div>
      </main>
    </div>
  )
}

export default App
