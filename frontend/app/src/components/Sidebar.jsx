import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from './ui/button';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Separator } from './ui/separator';
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
} from 'lucide-react';

export default function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const location = useLocation();

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
          className={`text-white/80 hover:text-white hover:bg-white/10 px-4 py-2 rounded-lg transition cursor-pointer flex items-center gap-3 ${
            isActive ? 'bg-white/10 text-white' : ''
          }`}
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
      } p-6 shadow-xl rounded-r-3xl hidden md:flex flex-col transition-all duration-300 bg-gradient-to-b from-[#355C7D] to-[#725A7A]`}
    >
      {/* Header with collapse button */}
      <div className="flex items-center justify-between mb-6">
        {!isCollapsed && (
          <h2 className="text-xl font-bold bg-gradient-to-r from-[#FF9CA5] to-[#C56C86] bg-clip-text text-transparent">
            FlowScheduler
          </h2>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="text-white/80 hover:text-white hover:bg-white/10"
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
        <Separator className="bg-white/20" />

        {/* Settings Button */}
        <Link to="/settings">
          <Button
            variant="ghost"
            className={`w-full ${
              isCollapsed ? 'justify-center' : 'justify-start'
            } text-white/80 hover:text-white hover:bg-white/10 gap-3 ${
              location.pathname === '/settings' ? 'bg-white/10 text-white' : ''
            }`}
          >
            <SettingsIcon className="h-5 w-5 flex-shrink-0" />
            {!isCollapsed && <span>Settings</span>}
          </Button>
        </Link>

        {/* User Profile */}
        <Link to="/profile">
          <div
            className={`flex items-center gap-3 p-3 rounded-lg hover:bg-white/10 cursor-pointer transition ${
              isCollapsed ? 'justify-center' : ''
            } ${location.pathname === '/profile' ? 'bg-white/10' : ''}`}
          >
            <Avatar className="h-8 w-8 flex-shrink-0">
              <AvatarImage src="" alt="User" />
              <AvatarFallback className="bg-gradient-to-r from-[#FF9CA5] to-[#C56C86] text-white">
                <User className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">John Doe</p>
                <p className="text-xs text-white/60 truncate">john@example.com</p>
              </div>
            )}
          </div>
        </Link>
      </div>
    </aside>
  );
}
