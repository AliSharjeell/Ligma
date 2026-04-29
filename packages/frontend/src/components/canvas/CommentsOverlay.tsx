'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useCanvasStore } from '@/store/canvas-store';
import { cn } from '@/lib/utils';
import { Check, X, Trash2 } from 'lucide-react';

interface CommentPinProps {
  comment: {
    id: string;
    canvasX: number;
    canvasY: number;
    authorId: string;
    authorName: string;
    authorColor: string;
    content: string;
    timestamp: number;
    resolved: boolean;
    replies: Array<{
      id: string;
      authorId: string;
      authorName: string;
      content: string;
      timestamp: number;
      isRead: boolean;
    }>;
    unreadCount: number;
  };
  screenX: number;
  screenY: number;
  isActive: boolean;
  isHovered: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

export function CommentPin({
  comment,
  screenX,
  screenY,
  isActive,
  isHovered,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: CommentPinProps) {
  const { resolveComment, deleteComment } = useCanvasStore();
  const [showPopover, setShowPopover] = useState(false);
  const [replyText, setReplyText] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isActive && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isActive]);

  const handleReply = () => {
    if (!replyText.trim()) return;
    useCanvasStore.getState().addReply(comment.id, replyText.trim());
    setReplyText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleReply();
    }
    if (e.key === 'Escape') {
      setShowPopover(false);
      useCanvasStore.getState().setActiveCommentId(null);
    }
  };

  return (
    <div
      className="absolute z-50"
      style={{
        left: screenX,
        top: screenY,
        transform: 'translate(-50%, -100%)',
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Pin */}
      <button
        onClick={() => {
          onClick();
          setShowPopover(true);
        }}
        className={cn(
          'relative flex items-center justify-center rounded-full border-2 border-white shadow-lg transition-all duration-150',
          isHovered && 'scale-110',
          isActive && 'scale-110 ring-2 ring-blue-500',
          comment.resolved && 'opacity-50'
        )}
        style={{
          width: 32,
          height: 32,
          backgroundColor: comment.authorColor,
        }}
      >
        <span className="text-xs text-white font-bold">
          {comment.authorName[0].toUpperCase()}
        </span>
        {/* Unread indicator */}
        {comment.unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-white"
            style={{ fontSize: 8 }}
          />
        )}
      </button>

      {/* Popover */}
      {showPopover && (
        <div
          className="absolute left-0 top-2 w-72 bg-white rounded-lg border border-gray-200 shadow-xl z-50"
          style={{ minWidth: 280 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs text-white font-bold"
                style={{ backgroundColor: comment.authorColor }}
              >
                {comment.authorName[0].toUpperCase()}
              </div>
              <div>
                <span className="text-sm font-medium">{comment.authorName}</span>
                <span className="text-xs text-gray-400 ml-2">
                  {formatRelativeTime(comment.timestamp)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => resolveComment(comment.id)}
                className={cn(
                  'p-1.5 rounded hover:bg-gray-100 transition-colors',
                  comment.resolved && 'text-green-600 bg-green-50'
                )}
                title={comment.resolved ? 'Unresolve' : 'Resolve'}
              >
                <Check className="size-4" />
              </button>
              <button
                onClick={() => {
                  deleteComment(comment.id);
                  setShowPopover(false);
                }}
                className="p-1.5 rounded hover:bg-red-50 hover:text-red-500 transition-colors"
                title="Delete"
              >
                <Trash2 className="size-4" />
              </button>
              <button
                onClick={() => {
                  setShowPopover(false);
                }}
                className="p-1.5 rounded hover:bg-gray-100 text-gray-500 transition-colors"
                title="Close"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="px-3 py-2 max-h-40 overflow-y-auto">
            <p className="text-sm text-gray-700">{comment.content}</p>

            {/* Replies */}
            {comment.replies.map((reply) => (
              <div key={reply.id} className="mt-2 pt-2 border-t border-gray-100">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-medium">{reply.authorName}</span>
                  <span className="text-xs text-gray-400">
                    {formatRelativeTime(reply.timestamp)}
                  </span>
                </div>
                <p className="text-sm text-gray-600">{reply.content}</p>
              </div>
            ))}
          </div>

          {/* Reply Input */}
          {!comment.resolved && (
            <div className="px-3 py-2 border-t border-gray-100">
              <textarea
                ref={inputRef}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Add a reply..."
                className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded resize-none outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                rows={2}
              />
              <div className="flex justify-end mt-1">
                <button
                  onClick={handleReply}
                  disabled={!replyText.trim()}
                  className={cn(
                    'px-3 py-1 text-xs font-medium rounded transition-colors',
                    replyText.trim()
                      ? 'bg-blue-500 text-white hover:bg-blue-600'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  )}
                >
                  Reply
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function CommentsOverlay() {
  const { comments, isCommentMode, viewportPosition, viewportZoom, activeCommentId, hoveredCommentId, setActiveCommentId, setHoveredCommentId, addComment, setTool, setIsCommentMode, pendingCommentX, pendingCommentY } = useCanvasStore();
  const [newCommentText, setNewCommentText] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Sync pending comment from store
  const pendingComment = (pendingCommentX !== null && pendingCommentY !== null)
    ? { x: pendingCommentX, y: pendingCommentY }
    : null;

  // Convert canvas coordinates to screen coordinates
  const canvasToScreen = useCallback(
    (canvasX: number, canvasY: number) => {
      const screenX = (canvasX + viewportPosition.x) * viewportZoom;
      const screenY = (canvasY + viewportPosition.y) * viewportZoom;
      return { screenX, screenY };
    },
    [viewportPosition, viewportZoom]
  );

  // Mark replies as read when comment is opened
  useEffect(() => {
    if (activeCommentId) {
      useCanvasStore.getState().markRepliesAsRead(activeCommentId);
    }
  }, [activeCommentId]);

  // Only show when there are comments or in comment mode
  const shouldShow = comments.length > 0 || isCommentMode || pendingComment;

  if (!shouldShow) {
    return null;
  }

  const handleCreateComment = () => {
    if (!pendingComment || !newCommentText.trim()) return;
    addComment(pendingComment.x, pendingComment.y, newCommentText.trim());
    useCanvasStore.setState({ pendingCommentX: null, pendingCommentY: null });
    setNewCommentText('');
    setIsCommentMode(false);
    setTool('select');
  };

  const handleCancelComment = () => {
    useCanvasStore.setState({ pendingCommentX: null, pendingCommentY: null });
    setNewCommentText('');
    setIsCommentMode(false);
    setTool('select');
  };

  return (
    <>
      {/* Pending comment popover */}
      {pendingComment && (
        <div
          className="fixed z-50 bg-white rounded-lg border border-gray-200 shadow-xl pointer-events-auto"
          style={{
            left: canvasToScreen(pendingComment.x, pendingComment.y).screenX,
            top: canvasToScreen(pendingComment.x, pendingComment.y).screenY,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="w-72 p-3">
            <textarea
              ref={inputRef}
              value={newCommentText}
              onChange={(e) => setNewCommentText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleCreateComment();
                }
                if (e.key === 'Escape') {
                  handleCancelComment();
                }
              }}
              placeholder="Add a comment..."
              className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded resize-none outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
              rows={3}
              autoFocus
            />
            <div className="flex justify-end gap-2 mt-2">
              <button
                onClick={handleCancelComment}
                className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateComment}
                disabled={!newCommentText.trim()}
                className={cn(
                  'px-3 py-1 text-xs font-medium rounded transition-colors',
                  newCommentText.trim()
                    ? 'bg-blue-500 text-white hover:bg-blue-600'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                )}
              >
                Post
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comment pins - always show if there are comments */}
      {comments.map((comment) => {
        const { screenX, screenY } = canvasToScreen(comment.canvasX, comment.canvasY);
        return (
          <div key={comment.id} className="pointer-events-auto absolute">
            <CommentPin
              comment={comment}
              screenX={screenX}
              screenY={screenY}
              isActive={activeCommentId === comment.id}
              isHovered={hoveredCommentId === comment.id}
              onClick={() => setActiveCommentId(comment.id)}
              onMouseEnter={() => setHoveredCommentId(comment.id)}
              onMouseLeave={() => setHoveredCommentId(null)}
            />
          </div>
        );
      })}
    </>
  );
}