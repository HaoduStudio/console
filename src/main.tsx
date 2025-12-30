import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'tdesign-react/es/_util/react-19-adapter'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
