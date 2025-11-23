import './App.css'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext.jsx'
import { ScheduleProvider } from './context/ScheduleContext.jsx'
import { ModalProvider } from './context/ModalContext.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Calender from './pages/Calender.jsx'
import Tasks from './pages/Tasks.jsx'
import Settings from './pages/Settings.jsx'
import Profile from './pages/Profile.jsx'

function App() {
  return (
    <ThemeProvider>
      <ScheduleProvider>
        <ModalProvider>
          <Router>
            <div className="app-container">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/calendar" element={<Calender />} />
                <Route path="/tasks" element={<Tasks />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/profile" element={<Profile />} />
              </Routes>
            </div>
          </Router>
        </ModalProvider>
      </ScheduleProvider>
    </ThemeProvider>
  )
}

export default App;
