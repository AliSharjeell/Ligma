'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useCanvasStore } from '@/store/canvas-store';
import { useSocket } from '@/contexts/socket-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { Task } from '@/types/canvas';
import { ChevronLeft, Plus, Check, Circle, Clock } from 'lucide-react';

const priorityColors = {
  low: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-red-100 text-red-800',
};

const statusIcons = {
  'pending': <Clock className="size-3" />,
  'in-progress': <Circle className="size-3" />,
  'completed': <Check className="size-3" />,
};

interface TasksPanelProps {
  onBack: () => void;
}

// TasksPanel - inline panel for sidebar
export function TasksPanel({ onBack }: TasksPanelProps) {
  const { tasks, updateTask, deleteTask } = useCanvasStore();
  const { emitTaskCreate, emitTaskUpdate, emitTaskDelete } = useSocket();
  const [isOpen, setIsOpen] = useState(false);
  const [newTask, setNewTask] = useState<{ title: string; description: string; priority: Task['priority'] }>({
    title: '',
    description: '',
    priority: 'medium',
  });

  const handleAddTask = () => {
    if (!newTask.title.trim()) return;
    emitTaskCreate({
      title: newTask.title.trim(),
      description: newTask.description.trim() || undefined,
      priority: newTask.priority,
    });
    setNewTask({ title: '', description: '', priority: 'medium' });
    setIsOpen(false);
  };

  const handleStatusChange = (taskId: string, status: Task['status']) => {
    emitTaskUpdate(taskId, status);
    updateTask(taskId, { status });
  };

  const handleDeleteTask = (taskId: string) => {
    emitTaskDelete(taskId);
    deleteTask(taskId);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack}>
          <ChevronLeft className="size-4" />
        </Button>
        <h3 className="text-sm font-semibold">Tasks</h3>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button className="w-full gap-2 mb-4">
            <Plus className="size-4" />
            Add Task
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
            <DialogDescription>Add a task to track your work</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" value={newTask.title} onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} placeholder="Task title" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input id="description" value={newTask.description} onChange={(e) => setNewTask({ ...newTask, description: e.target.value })} placeholder="Task description" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <select id="priority" value={newTask.priority} onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as Task['priority'] })} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
            <Button onClick={handleAddTask}>Create Task</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ScrollArea className="flex-1">
        <div className="space-y-3 pr-2">
          {tasks.map((task) => (
            <Card key={task.id} className="transition-colors hover:bg-accent/50">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleStatusChange(task.id, task.status === 'completed' ? 'pending' : 'completed')} className={cn('flex items-center justify-center w-5 h-5 rounded border transition-colors', task.status === 'completed' ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 hover:border-green-500')}>
                      {statusIcons[task.status]}
                    </button>
                    <CardTitle className={cn('text-sm font-medium', task.status === 'completed' && 'line-through text-muted-foreground')}>{task.title}</CardTitle>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleDeleteTask(task.id)} className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive">×</Button>
                </div>
              </CardHeader>
              {task.description && <CardContent className="pb-2"><CardDescription className="text-xs">{task.description}</CardDescription></CardContent>}
              <div className="px-4 pb-3 flex items-center justify-between">
                <Badge variant="outline" className={cn('text-xs', priorityColors[task.priority])}>{task.priority}</Badge>
                {task.assignee && <span className="text-xs text-muted-foreground">{task.assignee}</span>}
              </div>
            </Card>
          ))}
          {tasks.length === 0 && <div className="text-center py-8 text-muted-foreground"><p>No tasks yet</p></div>}
        </div>
      </ScrollArea>
    </div>
  );
}

// Re-export as TaskBoard for backwards compatibility (no onBack needed, standalone sheet)
export function TaskBoard() {
  return <TasksPanel onBack={() => {}} />;
}