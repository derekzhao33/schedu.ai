import React, { useState } from "react";
import { useModal } from "../context/ModalContext";
import { useSchedule } from "../context/ScheduleContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { format } from "date-fns";

const PASTEL_COLORS = {
  red: "#FFB3BA",
  blue: "#BAE1FF",
  yellow: "#FFFFBA",
  orange: "#FFDFBA",
  green: "#BAFFC9",
  purple: "#E0BBE4",
};

const PRIORITIES = ["high", "medium", "low"];

export default function AddTaskModal() {
  const { addTaskModalOpen, closeAddTaskModal } = useModal();
  const { addTask } = useSchedule();

  const [taskName, setTaskName] = useState("");
  const [label, setLabel] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [priority, setPriority] = useState("medium");
  const [selectedColor, setSelectedColor] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!taskName || !startTime || !endTime) {
      alert("Please fill in all required fields");
      return;
    }

    const color = selectedColor || Object.keys(PASTEL_COLORS)[Math.floor(Math.random() * 6)];

    const newTask = {
      name: taskName,
      label: label || "General",
      startTime,
      endTime,
      priority,
      color,
      date: format(new Date(), "yyyy-MM-dd"),
    };

    addTask(newTask);

    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
      resetForm();
      closeAddTaskModal();
    }, 1500);
  };

  const resetForm = () => {
    setTaskName("");
    setLabel("");
    setStartTime("");
    setEndTime("");
    setPriority("medium");
    setSelectedColor("");
  };

  const handleClose = () => {
    resetForm();
    closeAddTaskModal();
  };

  return (
    <Dialog open={addTaskModalOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        {showSuccess ? (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="text-6xl mb-4">✓</div>
            <div className="text-xl font-semibold text-green-600">
              Task successfully created!
            </div>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold">Add New Task</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="task-name">Task Name *</Label>
                <Input
                  id="task-name"
                  placeholder="Enter task name"
                  value={taskName}
                  onChange={(e) => setTaskName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="label">Label/Type</Label>
                <Input
                  id="label"
                  placeholder="e.g., Work, Personal, Study"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start-time">Start Time *</Label>
                  <Input
                    id="start-time"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end-time">End Time *</Label>
                  <Input
                    id="end-time"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger id="priority">
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Color (optional)</Label>
                <div className="flex gap-3 flex-wrap">
                  {Object.entries(PASTEL_COLORS).map(([name, hex]) => (
                    <button
                      key={name}
                      type="button"
                      className={`w-10 h-10 rounded-full border-2 transition-all ${
                        selectedColor === name
                          ? "border-gray-800 scale-110"
                          : "border-gray-300 hover:scale-105"
                      }`}
                      style={{ backgroundColor: hex }}
                      onClick={() => setSelectedColor(name)}
                      title={name}
                    />
                  ))}
                </div>
                {!selectedColor && (
                  <p className="text-xs text-gray-500">
                    No color selected - a random color will be assigned
                  </p>
                )}
              </div>

              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-[#181D27] hover:bg-[#181D27]/90">
                  Add Task
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
