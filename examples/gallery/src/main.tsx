import { createRoot } from 'react-dom/client'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <HashRouter>
    <Routes>
      <Route path="/:exampleId" element={<App />} />
      <Route path="*" element={<Navigate to="/hello-triangle" replace />} />
    </Routes>
  </HashRouter>
)
