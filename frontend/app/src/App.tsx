import './App.css'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
// @ts-ignore
import { ThemeProvider } from './context/ThemeContext.jsx'
// @ts-ignore
import { ScheduleProvider, useSchedule } from './context/ScheduleContext.jsx'
// @ts-ignore
import { ModalProvider } from './context/ModalContext.jsx'
// @ts-ignore
import { SidebarProvider } from './components/Sidebar.jsx'
// @ts-ignore
import Dashboard from './pages/Dashboard.jsx'
// @ts-ignore
import Calender from './pages/Calender.jsx'
// @ts-ignore
import Tasks from './pages/Tasks.jsx'
// @ts-ignore
import Settings from './pages/Settings.jsx'
// @ts-ignore
import Profile from './pages/Profile.jsx'
// @ts-ignore
import Assistant from './pages/Assistant.jsx'


function AppContent() {
  return (
    <>
      <Router>
        <div className="app-container">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/calendar" element={<Calender />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/assistant" element={<Assistant />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/profile" element={<Profile />} />
          </Routes>
        </div>
      </Router>
    </>
  );
}

function App() {
  return (
    <ThemeProvider>
      <ScheduleProvider>
        <ModalProvider>
          <SidebarProvider>
            <AppContent />
          </SidebarProvider>
        </ModalProvider>
      </ScheduleProvider>
    </ThemeProvider>
  )
}

export default App;
