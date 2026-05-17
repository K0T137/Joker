import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { LangProvider } from './context/LangContext'
import { PrefsProvider } from './context/PrefsContext'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LangProvider>
      <AuthProvider>
        <PrefsProvider>
          <App />
        </PrefsProvider>
      </AuthProvider>
    </LangProvider>
  </React.StrictMode>,
)
