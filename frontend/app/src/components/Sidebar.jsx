import React, { useState, createContext, useContext } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Separator } from './ui/separator';
import { useAuth } from '../context/AuthContext';
import {
  Calendar,
  LayoutDashboard,
  ListTodo,
  Bot,
  BarChart3,
  Settings as SettingsIcon,
  User,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from 'lucide-react';

// Create a context for sidebar state
const SidebarContext = createContext();

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    return { isCollapsed: false };
  }
  return context;
};

export function SidebarProvider({ children }) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <SidebarContext.Provider value={{ isCollapsed, setIsCollapsed }}>
      {children}
    </SidebarContext.Provider>
  );
}

export default function Sidebar() {
  const { isCollapsed, setIsCollapsed } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/calendar', icon: Calendar, label: 'Calendar' },
    { to: '/tasks', icon: ListTodo, label: 'Tasks' },
    { to: '/assistant', icon: Bot, label: 'Assistant' },
    { to: '/stats', icon: BarChart3, label: 'Stats' },
  ];

  const NavLink = ({ to, icon: Icon, children }) => {
    const isActive = location.pathname === to;
    return (
      <Link to={to}>
        <div
          className={`text-slate-600 hover:text-slate-900 hover:bg-blue-50/60 px-4 py-2 rounded-lg transition-colors duration-200 cursor-pointer flex items-center gap-3 ${
            isActive ? 'bg-blue-100 text-blue-900 font-semibold' : ''
          } ${isCollapsed ? 'justify-center' : ''}`}
        >
          <Icon className="h-5 w-5 flex-shrink-0" />
          {!isCollapsed && <span>{children}</span>}
        </div>
      </Link>
    );
  };

  return (
    <aside
      className={`${
        isCollapsed ? 'w-20' : 'w-64'
      } p-6 shadow-lg hidden md:flex flex-col transition-all duration-300 bg-white border-r border-slate-200 fixed left-0 top-0 h-screen z-50`}
    >
      {/* Header with collapse button */} 
      <div className={`flex items-center mb-6 ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
        {!isCollapsed && (
          <h2 className="text-2xl font-bold text-slate-900">
            Flowify
          </h2>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="text-slate-600 hover:text-slate-900 hover:bg-slate-100/60"
        >
          {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="space-y-2 flex-1">
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to} icon={item.icon}>
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Bottom Section */}
      <div className="space-y-3 mt-6">
        <Separator className="bg-slate-200" />

        {/* Settings Button */}
        <Link to="/settings">
          <Button
            variant="ghost"
            className={`w-full ${
              isCollapsed ? 'justify-center' : 'justify-start'
            } text-slate-600 hover:text-slate-900 hover:bg-blue-50/60 gap-3 transition-colors duration-200 ${
              location.pathname === '/settings' ? 'bg-blue-100 text-blue-900 font-semibold' : ''
            }`}
          >
            <SettingsIcon className="h-5 w-5 flex-shrink-0" />
            {!isCollapsed && <span>Settings</span>}
          </Button>
        </Link>

        {/* User Profile */}
        <Link to="/profile">
          <div
            className={`flex items-center gap-3 p-3 rounded-lg hover:bg-blue-50/60 cursor-pointer transition-colors duration-200 ${
              isCollapsed ? 'justify-center' : ''
            } ${location.pathname === '/profile' ? 'bg-blue-100 text-slate-900' : ''}`}
          >
            <Avatar className="h-8 w-8 flex-shrink-0">
              <AvatarImage src="" alt="User" />
              <AvatarFallback className="bg-blue-500 text-white">
                {user ? `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase() : 'U'}
              </AvatarFallback>
            </Avatar>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">
                  {user ? `${user.first_name} ${user.last_name}` : 'User'}
                </p>
              </div>
            )}
          </div>
        </Link>

        {/* Logout Button */}
        <Button
          onClick={handleLogout}
          variant="ghost"
          className={`w-full ${
            isCollapsed ? 'justify-center' : 'justify-start'
          } text-slate-600 hover:text-red-600 hover:bg-red-50/60 gap-3 transition-colors duration-200`}
        >
          <LogOut className="h-5 w-5 flex-shrink-0" />
          {!isCollapsed && <span>Logout</span>}
        </Button>
      </div>
    </aside>
  );
}
