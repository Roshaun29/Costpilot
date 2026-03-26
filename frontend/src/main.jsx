import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <Toaster 
        position="bottom-right"
        toastOptions={{
          className: 'font-sans text-sm shadow-2xl rounded-xl',
          style: { background: '#18181D', color: '#F5F5F7', border: '1px solid rgba(255,255,255,0.1)' }
        }} 
      />
    </BrowserRouter>
  </React.StrictMode>
)
