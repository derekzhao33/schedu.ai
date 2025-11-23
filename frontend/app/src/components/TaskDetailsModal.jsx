import React, { useState, useEffect } from "react";
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
import { Pencil, Trash2 } from "lucide-react";

const PASTEL_COLORS = {
  red: "#FFB3BA",
  blue: "#BAE1FF",
  yellow: "#FFFFBA",
  orange: "#FFDFBA",
  green: "#BAFFC9",
  purple: "#E0BBE4",
};

const PRIORITIES = ["high", "medium", "low"];

export default function TaskDetailsModal() {
  const {
    taskDetailsModalOpen,
    closeTaskDetailsModal,
    selectedTask,
    selectedTaskIndex,
    isEditMode,
    setEditMode,
  } = useModal();
  const { updateTask, deleteTask } = useSchedule();

  const [taskName, setTaskName] = useState("");
  const [label, setLabel] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [priority, setPriority] = useState("medium");
  const [selectedColor, setSelectedColor] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (selectedTask) {
      setTaskName(selectedTask.name || "");
      setLabel(selectedTask.label || "");
      setStartTime(selectedTask.startTime || "");
      setEndTime(selectedTask.endTime || "");
      setPriority(selectedTask.priority || "medium");
      setSelectedColor(selectedTask.color || "");
    }
  }, [selectedTask]);

  const handleUpdate = (e) => {
    e.preventDefault();

    if (!taskName || !startTime || !endTime) {
      alert("Please fill in all required fields");
      return;
    }

    const updatedTask = {
      ...selectedTask,
      name: taskName,
      label: label || "General",
      startTime,
      endTime,
      priority,
      color: selectedColor,
    };

    updateTask(selectedTaskIndex, updatedTask);

    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
      setEditMode(false);
      closeTaskDetailsModal();
    }, 1500);
  };

  const handleDelete = () => {
    if (window.confirm("Are you sure you want to delete this task?")) {
      deleteTask(selectedTaskIndex);
      closeTaskDetailsModal();
    }
  };

  const handleClose = () => {
    setEditMode(false);
    closeTaskDetailsModal();
  };

  if (!selectedTask) return null;

  return (
    <Dialog open={taskDetailsModalOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        {showSuccess ? (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="text-6xl mb-4">✓</div>
            <div className="text-xl font-semibold text-green-600">
              Task updated successfully!
            </div>
          </div>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle className="text-2xl font-bold">
                  {isEditMode ? "Edit Task" : "Task Details"}
                </DialogTitle>
                {!isEditMode && (
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditMode(true)}
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleDelete}
                      title="Delete"
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </DialogHeader>

            {isEditMode ? (
              <form onSubmit={handleUpdate} className="space-y-4">
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
                  <Label>Color</Label>
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
                </div>

                <DialogFooter className="gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditMode(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="bg-[#181D27] hover:bg-[#181D27]/90">
                    Update Task
                  </Button>
                </DialogFooter>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-6 h-6 rounded-full border-2 border-gray-300"
                      style={{
                        backgroundColor: PASTEL_COLORS[selectedTask.color] || "#E0E7FF",
                      }}
                    />
                    <div>
                      <div className="text-sm text-gray-500">Task Name</div>
                      <div className="text-lg font-semibold">{selectedTask.name}</div>
                    </div>
                  </div>

                  {selectedTask.label && (
                    <div>
                      <div className="text-sm text-gray-500">Label</div>
                      <div className="text-base">{selectedTask.label}</div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-gray-500">Start Time</div>
                      <div className="text-base font-medium">{selectedTask.startTime}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">End Time</div>
                      <div className="text-base font-medium">{selectedTask.endTime}</div>
                    </div>
                  </div>

                  <div>
                    <div className="text-sm text-gray-500">Priority</div>
                    <div className="text-base">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                          selectedTask.priority === "high"
                            ? "bg-red-100 text-red-700"
                            : selectedTask.priority === "medium"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-green-100 text-green-700"
                        }`}
                      >
                        {selectedTask.priority?.charAt(0).toUpperCase() +
                          selectedTask.priority?.slice(1)}
                      </span>
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={handleClose}>
                    Close
                  </Button>
                </DialogFooter>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
