import { useState } from 'react'
import Sidebar from './Sidebar'
import PdfCanvas from './PdfCanvas'
import './App.css'

function App() {
  const [file, setFile] = useState(null)

  return (
    <div className="layout">
      <Sidebar onFileSelect={setFile} />
      <main className="canvas-area">
        {file
          ? <PdfCanvas file={file} />
          : <div className="canvas-placeholder"><p>Upload a blueprint to get started</p></div>
        }
      </main>
    </div>
  )
}

export default App
