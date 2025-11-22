import './App.css'
import Login from './pages/auth/Login.jsx'
import SignUp from './pages/auth/SignUp.jsx'
import Calender from './pages/Calender.jsx'
import { ScheduleProvider } from './context/ScheduleContext.jsx';


function App() {
  return (
    <ScheduleProvider>
      <div className="app-container">
        <Calender />
      </div>
    </ScheduleProvider>
  );
}

export default App;
