import './App.css'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
// @ts-ignore
import { ThemeProvider } from './context/ThemeContext.jsx'
// @ts-ignore
import { ScheduleProvider, useSchedule } from './context/ScheduleContext.jsx'
// @ts-ignore
import { ModalProvider } from './context/ModalContext.jsx'
// @ts-ignore
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
// @ts-ignore
import { SidebarProvider } from './components/Sidebar.jsx'
// @ts-ignore
import Dashboard from './pages/Dashboard.jsx'
// @ts-ignore
import Calendar from './pages/Calendar/index.jsx'
// @ts-ignore
import Tasks from './pages/Tasks.jsx'
// @ts-ignore
import Settings from './pages/Settings.jsx'
// @ts-ignore
import Profile from './pages/Profile.jsx'
// @ts-ignore
import Assistant from './pages/Assistant.jsx'
// @ts-ignore
import Login from './pages/auth/Login.jsx'
// @ts-ignore
import SignUp from './pages/auth/SignUp.jsx'

function AppContent() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#181D27] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Router>
        <div className="app-container">
          {isAuthenticated ? (
            // Authenticated routes with sidebar
            <div className="flex">
              <SidebarProvider>
                <>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/calendar" element={<Calendar />} />
                    <Route path="/tasks" element={<Tasks />} />
                    <Route path="/assistant" element={<Assistant />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </>
              </SidebarProvider>
            </div>
          ) : (
            // Auth routes
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<SignUp />} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          )}
        </div>
      </Router>
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <ScheduleProvider>
          <ModalProvider>
            <AppContent />
          </ModalProvider>
        </ScheduleProvider>
      </ThemeProvider>
    </AuthProvider>
  )
}

export default App;
