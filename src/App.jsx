import Sidebar from './Sidebar'
import './App.css'

function App() {
  return (
    <div className="layout">
      <Sidebar />
      <main className="canvas-area">
        <div className="canvas-placeholder">
          <p>Blueprint canvas</p>
        </div>
      </main>
    </div>
  )
}

export default App
