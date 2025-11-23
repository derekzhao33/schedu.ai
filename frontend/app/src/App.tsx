import './App.css'
import { ThemeProvider } from './context/ThemeContext.jsx'
import { ScheduleProvider } from './context/ScheduleContext.jsx'
import Settings from './pages/Settings.jsx'

function App() {
  return (
    <ThemeProvider>
      <ScheduleProvider>
        <div className="app-container">
          <Settings />
        </div>
      </ScheduleProvider>
    </ThemeProvider>
  )
}

export default App;
