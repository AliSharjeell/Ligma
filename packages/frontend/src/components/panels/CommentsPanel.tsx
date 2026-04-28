'use client';

import React, { useState } from 'react';
import { useCanvasStore } from '@/store/canvas-store';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MessageCircle, ChevronLeft, Check, Trash2 } from 'lucide-react';

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

interface CommentsPanelProps {
  onBack: () => void;
}

export function CommentsPanel({ onBack }: CommentsPanelProps) {
  const { comments, activeCommentId, hoveredCommentId, setActiveCommentId, setHoveredCommentId, setIsCommentMode, resolveComment, deleteComment, viewportPosition, viewportZoom } = useCanvasStore();
  const [filter, setFilter] = useState<'all' | 'resolved'>('all');

  const filteredComments = filter === 'all'
    ? comments.filter(c => !c.resolved)
    : comments.filter(c => c.resolved);

  const handleCommentClick = (commentId: string) => {
    setActiveCommentId(commentId);
    setHoveredCommentId(commentId);
  };

  const handlePinClick = (commentId: string) => {
    const comment = comments.find(c => c.id === commentId);
    if (comment) {
      // Pan to the comment location
      useCanvasStore.getState().setViewportPosition({
        x: -comment.canvasX + window.innerWidth / 2 / viewportZoom,
        y: -comment.canvasY + window.innerHeight / 2 / viewportZoom,
      });
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack}>
          <ChevronLeft className="size-4" />
        </Button>
        <h3 className="text-sm font-semibold">Comments</h3>
        {comments.length > 0 && (
          <span className="text-xs text-muted-foreground ml-auto">
            {comments.filter(c => !c.resolved).length} open
          </span>
        )}
      </div>

      {/* Filter Toggle */}
      <div className="flex gap-1 mb-3 p-1 bg-muted rounded-lg">
        <button
          onClick={() => setFilter('all')}
          className={cn(
            'flex-1 px-2 py-1 text-xs font-medium rounded transition-colors',
            filter === 'all' ? 'bg-white shadow text-primary' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          All
        </button>
        <button
          onClick={() => setFilter('resolved')}
          className={cn(
            'flex-1 px-2 py-1 text-xs font-medium rounded transition-colors',
            filter === 'resolved' ? 'bg-white shadow text-primary' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Resolved
        </button>
      </div>

      {/* Enter Comment Mode Button */}
      <Button
        variant="outline"
        size="sm"
        className="w-full gap-2 mb-3"
        onClick={() => setIsCommentMode(true)}
      >
        <MessageCircle className="size-4" />
        Add Comment
      </Button>

      <ScrollArea className="flex-1">
        {filteredComments.length > 0 ? (
          <div className="space-y-2">
            {filteredComments.map((comment) => (
              <div
                key={comment.id}
                className={cn(
                  'p-3 rounded-lg border cursor-pointer transition-all',
                  activeCommentId === comment.id
                    ? 'bg-blue-50 border-blue-200 border-l-4 border-l-blue-500'
                    : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50',
                  hoveredCommentId === comment.id && 'border-blue-300 bg-blue-50/50'
                )}
                onClick={() => handleCommentClick(comment.id)}
                onMouseEnter={() => setHoveredCommentId(comment.id)}
                onMouseLeave={() => setHoveredCommentId(null)}
              >
                <div className="flex items-start gap-2">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs text-white font-bold shrink-0"
                    style={{ backgroundColor: comment.authorColor }}
                  >
                    {comment.authorName[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{comment.authorName}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatRelativeTime(comment.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">{comment.content}</p>

                    {/* Reply count */}
                    {comment.replies.length > 0 && (
                      <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
                        <MessageCircle className="size-3" />
                        <span>{comment.replies.length} {comment.replies.length === 1 ? 'reply' : 'replies'}</span>
                        {comment.unreadCount > 0 && (
                          <span className="w-4 h-4 bg-blue-500 rounded-full text-white text-[10px] flex items-center justify-center">
                            {comment.unreadCount}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 mt-2 pt-2 border-t border-gray-100">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePinClick(comment.id);
                    }}
                    title="Jump to pin"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn('h-7 w-7', comment.resolved && 'text-green-600 bg-green-50')}
                    onClick={(e) => {
                      e.stopPropagation();
                      resolveComment(comment.id);
                    }}
                    title={comment.resolved ? 'Unresolve' : 'Resolve'}
                  >
                    <Check className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteComment(comment.id);
                    }}
                    title="Delete"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <MessageCircle className="size-8 mx-auto mb-2 opacity-50" />
            <p>{filter === 'all' ? 'No comments yet' : 'No resolved comments'}</p>
            <p className="text-sm mt-1">
              {filter === 'all' ? 'Click on canvas to add a comment' : 'Comments you resolve will appear here'}
            </p>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
