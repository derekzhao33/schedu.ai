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
import Confetti from 'react-confetti'
import { useEffect, useState } from 'react'

function ConfettiWrapper() {
  const { showConfetti } = useSchedule();
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!showConfetti) return null;

  return (
    <Confetti
      width={windowSize.width}
      height={windowSize.height}
      recycle={false}
      numberOfPieces={500}
      gravity={0.3}
    />
  );
}

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
