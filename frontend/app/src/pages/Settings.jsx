import React from "react";
import { useThemeSettings } from "../context/ThemeContext";
import { useSchedule } from "../context/ScheduleContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import { Separator } from "../components/ui/separator";
import Sidebar from "../components/Sidebar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../components/ui/alert-dialog";
import {
  Palette,
  Bell,
  CalendarDays,
  AlertTriangle,
} from "lucide-react";


export default function Settings() {


  const {
    theme,
    setTheme,
    notifications,
    setNotifications,
    calendarView,
    setCalendarView,
    weekStart,
    setWeekStart,
  } = useThemeSettings();


  const { setTasks, setEvents } = useSchedule();

  const resetAllData = () => {
    setTasks([]);
    setEvents([]);
    localStorage.removeItem("tasks");
    localStorage.removeItem("events");
  };

  return (
    <div className={`flex min-h-screen ${theme === 'dark' ? 'dark' : ''}`} style={{ backgroundColor: "#F7F8FC" }}>
      <Sidebar />


      {/* Main content */}
      <main className="flex-1 p-8 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-800">
            Settings
          </h1>
        </div>


        {/* Settings Cards */}
        <div className="space-y-6">
          {/* Theme Selection */}
          <div>
            <Card
              className="bg-white border border-gray-200 shadow-md rounded-3xl"
            >
              <CardHeader>
                <CardTitle className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                  <Palette className="h-6 w-6 text-indigo-600" />
                  Theme
                </CardTitle>
                <CardDescription className="text-gray-600">
                  Customize the appearance of your application
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="theme-select" className="text-gray-700">
                    Select Theme
                  </Label>
                  <Select value={theme} onValueChange={setTheme}>
                    <SelectTrigger
                      id="theme-select"
                      className="bg-white border-gray-300 text-gray-800 rounded-xl"
                    >
                      <SelectValue placeholder="Select a theme" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </div>


          {/* Notifications */}
          <div>
            <Card
              className="bg-white border border-gray-200 shadow-md rounded-3xl"
            >
              <CardHeader>
                <CardTitle className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                  <Bell className="h-6 w-6 text-indigo-600" />
                  Notification Preferences
                </CardTitle>
                <CardDescription className="text-gray-600">
                  Manage how you receive notifications
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="task-reminders" className="text-gray-800 font-medium">
                      Task Reminders
                    </Label>
                    <p className="text-sm text-gray-600">
                      Get reminded about upcoming tasks
                    </p>
                  </div>
                  <Switch
                    id="task-reminders"
                    checked={notifications.taskReminders}
                    onCheckedChange={(checked) =>
                      setNotifications({
                        ...notifications,
                        taskReminders: checked,
                      })
                    }
                  />
                </div>


                <Separator className="bg-gray-200" />


                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="email-reminders" className="text-gray-800 font-medium">
                      Email Reminders
                    </Label>
                    <p className="text-sm text-gray-600">
                      Receive email notifications for important events
                    </p>
                  </div>
                  <Switch
                    id="email-reminders"
                    checked={notifications.emailReminders}
                    onCheckedChange={(checked) =>
                      setNotifications({
                        ...notifications,
                        emailReminders: checked,
                      })
                    }
                  />
                </div>


                <Separator className="bg-gray-200" />


                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="daily-summary" className="text-gray-800 font-medium">
                      Daily Summary
                    </Label>
                    <p className="text-sm text-gray-600">
                      Get a daily summary of your tasks and events
                    </p>
                  </div>
                  <Switch
                    id="daily-summary"
                    checked={notifications.dailySummary}
                    onCheckedChange={(checked) =>
                      setNotifications({
                        ...notifications,
                        dailySummary: checked,
                      })
                    }
                  />
                </div>
              </CardContent>
            </Card>
          </div>


          {/* Calendar Settings */}
          <div>
            <Card
              className="bg-white border border-gray-200 shadow-md rounded-3xl"
            >
              <CardHeader>
                <CardTitle className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                  <CalendarDays className="h-6 w-6 text-indigo-600" />
                  Calendar Settings
                </CardTitle>
                <CardDescription className="text-gray-600">
                  Customize your calendar view and preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Default calendar view */}
                <div className="space-y-2">
                  <Label htmlFor="calendar-view" className="text-gray-700">
                    Default Calendar View
                  </Label>
                  <Select value={calendarView} onValueChange={setCalendarView}>
                    <SelectTrigger
                      id="calendar-view"
                      className="bg-white border-gray-300 text-gray-800 rounded-xl"
                    >
                      <SelectValue placeholder="Select view" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Day">Day</SelectItem>
                      <SelectItem value="Week">Week</SelectItem>
                      <SelectItem value="Month">Month</SelectItem>
                    </SelectContent>
                  </Select>
                </div>


                {/* Week start */}
                <div className="space-y-2">
                  <Label htmlFor="week-start" className="text-gray-700">
                    Start Week On
                  </Label>
                  <Select value={weekStart} onValueChange={setWeekStart}>
                    <SelectTrigger
                      id="week-start"
                      className="bg-white border-gray-300 text-gray-800 rounded-xl"
                    >
                      <SelectValue placeholder="Select day" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Monday">Monday</SelectItem>
                      <SelectItem value="Sunday">Sunday</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </div>


          {/* Danger Zone */}
          <div>
            <Card
              className="bg-white border border-red-200 shadow-md rounded-3xl"
            >
              <CardHeader>
                <CardTitle className="text-2xl font-bold text-red-600 flex items-center gap-2">
                  <AlertTriangle className="h-6 w-6" />
                  Danger Zone
                </CardTitle>
                <CardDescription className="text-gray-600">
                  Irreversible actions - proceed with caution
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      className="rounded-xl shadow-lg"
                    >
                      Reset All Tasks & Events
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete all
                        your tasks and events from local storage.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={resetAllData}
                        className="bg-red-500 hover:bg-red-600"
                      >
                        Yes, reset everything
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
