import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom'
import Canvas from './components/Canvas/Canvas'
import './App.css'

function Login() {
  return (
    <div style={{ padding: 24 }}>
      <h1>Login</h1>
      <p>This is a placeholder login page.</p>
    </div>
  )
}

function Room() { return <Canvas /> }

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/room/default" element={<Room />} />
        <Route path="*" element={<Navigate to="/room/default" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
