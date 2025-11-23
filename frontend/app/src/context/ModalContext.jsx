import { createContext, useContext, useState } from "react";

const ModalContext = createContext();

export function ModalProvider({ children }) {
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [addTaskModalOpen, setAddTaskModalOpen] = useState(false);
  const [taskDetailsModalOpen, setTaskDetailsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedTaskIndex, setSelectedTaskIndex] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);

  return (
    <ModalContext.Provider
      value={{
        taskModalOpen,
        openTaskModal: () => setTaskModalOpen(true),
        closeTaskModal: () => setTaskModalOpen(false),

        addTaskModalOpen,
        openAddTaskModal: () => setAddTaskModalOpen(true),
        closeAddTaskModal: () => setAddTaskModalOpen(false),

        taskDetailsModalOpen,
        selectedTask,
        selectedTaskIndex,
        isEditMode,
        openTaskDetailsModal: (task, index) => {
          setSelectedTask(task);
          setSelectedTaskIndex(index);
          setIsEditMode(false);
          setTaskDetailsModalOpen(true);
        },
        closeTaskDetailsModal: () => {
          setTaskDetailsModalOpen(false);
          setSelectedTask(null);
          setSelectedTaskIndex(null);
          setIsEditMode(false);
        },
        setEditMode: (value) => setIsEditMode(value),
      }}
    >
      {children}
    </ModalContext.Provider>
  );
}

export function useModal() {
  return useContext(ModalContext);
}
