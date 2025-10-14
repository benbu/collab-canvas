import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom'
import Canvas from './components/Canvas/Canvas'
import './App.css'
import { AuthProvider } from './contexts/AuthContext'
import Login from './pages/Login'

 

function Room() { return <Canvas /> }

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/room/:roomId" element={<Room />} />
          <Route path="*" element={<Navigate to="/room/default" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
