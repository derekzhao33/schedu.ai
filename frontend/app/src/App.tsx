import './App.css'
import { ThemeProvider } from './context/ThemeContext.jsx'
import { ScheduleProvider } from './context/ScheduleContext.jsx'
import { ModalProvider } from './context/ModalContext.jsx'
import Settings from './pages/Settings.jsx'
import Calender from './pages/Calender.jsx'
import Dashboard from './pages/Dashboard.jsx'

function App() {
  return (
    <ThemeProvider>
      <ScheduleProvider>
        <ModalProvider>
          <div className="app-container">
            <Calender />
          </div>
        </ModalProvider>
      </ScheduleProvider>
    </ThemeProvider>
  )
}

export default App;
