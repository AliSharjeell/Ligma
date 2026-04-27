'use client';

import React, { useState } from 'react';
import { useCanvasStore } from '@/store/canvas-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import type { Task } from '@/types/canvas';
import { SummaryExport } from './SummaryExport';
import { Plus, Check, Circle, Clock, AlertCircle, FileDown } from 'lucide-react';

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

export function TaskBoard() {
  const { tasks, addTask, updateTask, deleteTask } = useCanvasStore();
  const [isOpen, setIsOpen] = useState(false);
  const [newTask, setNewTask] = useState<{ title: string; description: string; priority: Task['priority'] }>({
    title: '',
    description: '',
    priority: 'medium',
  });

  const handleAddTask = () => {
    if (!newTask.title.trim()) return;
    addTask({
      ...newTask,
      status: 'pending',
    });
    setNewTask({ title: '', description: '', priority: 'medium' });
    setIsOpen(false);
  };

  const handleStatusChange = (taskId: string, status: Task['status']) => {
    updateTask(taskId, { status });
  };

  const handleDeleteTask = (taskId: string) => {
    deleteTask(taskId);
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <AlertCircle className="size-4" />
          Tasks
          {tasks.length > 0 && (
            <Badge variant="secondary" className="ml-1">
              {tasks.length}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle>AI-Extracted Tasks</SheetTitle>
          <SheetDescription>
            Tasks automatically extracted from canvas content
          </SheetDescription>
          <div className="mt-2">
            <SummaryExport />
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button className="w-full gap-2">
                <Plus className="size-4" />
                Add Task
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Task</DialogTitle>
                <DialogDescription>
                  Add a task to track your work on the canvas
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={newTask.title}
                    onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                    placeholder="Task title"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={newTask.description}
                    onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                    placeholder="Task description"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <select
                    id="priority"
                    value={newTask.priority}
                    onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as Task['priority'] })}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddTask}>Create Task</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <ScrollArea className="h-[calc(100vh-200px)]">
            <div className="space-y-3">
              {tasks.map((task) => (
                <Card key={task.id} className="transition-colors hover:bg-accent/50">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleStatusChange(task.id, task.status === 'completed' ? 'pending' : 'completed')}
                          className={cn(
                            'flex items-center justify-center w-5 h-5 rounded border transition-colors',
                            task.status === 'completed'
                              ? 'bg-green-500 border-green-500 text-white'
                              : 'border-gray-300 hover:border-green-500'
                          )}
                        >
                          {statusIcons[task.status]}
                        </button>
                        <CardTitle className={cn(
                          'text-sm font-medium',
                          task.status === 'completed' && 'line-through text-muted-foreground'
                        )}>
                          {task.title}
                        </CardTitle>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteTask(task.id)}
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                      >
                        ×
                      </Button>
                    </div>
                  </CardHeader>
                  {task.description && (
                    <CardContent className="pb-2">
                      <CardDescription className="text-xs">
                        {task.description}
                      </CardDescription>
                    </CardContent>
                  )}
                  <div className="px-4 pb-3 flex items-center justify-between">
                    <Badge variant="outline" className={cn('text-xs', priorityColors[task.priority])}>
                      {task.priority}
                    </Badge>
                    {task.assignee && (
                      <span className="text-xs text-muted-foreground">{task.assignee}</span>
                    )}
                  </div>
                </Card>
              ))}

              {tasks.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No tasks yet</p>
                  <p className="text-sm">Add tasks to track your work</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}