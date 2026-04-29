'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useCanvasStore } from '@/store/canvas-store';
import { useSocket } from '@/contexts/socket-context';
import { cn } from '@/lib/utils';
import { Check, X, Trash2, AtSign } from 'lucide-react';
import type { Mention, MentionNotification } from '@/types/canvas';

interface CommentPinProps {
  comment: {
    id: string;
    canvasX: number;
    canvasY: number;
    authorId: string;
    authorName: string;
    authorColor: string;
    content: string;
    mentions: Mention[];
    timestamp: number;
    resolved: boolean;
    replies: Array<{
      id: string;
      authorId: string;
      authorName: string;
      content: string;
      mentions: Mention[];
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
  const { resolveComment, deleteComment, users, parseMentions, updateCommentPosition, viewportPosition, viewportZoom } = useCanvasStore();
  const { emitCommentReply, emitCommentDelete, emitCommentUpdate, emitMentionNotification } = useSocket();
  const [showPopover, setShowPopover] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);

  // Get online users for mention autocomplete
  const onlineUsers = Array.from(users.values()).filter(u => u.id !== comment.authorId);

  // Filter users based on mention filter
  const filteredUsers = onlineUsers.filter(u =>
    u.name.toLowerCase().includes(mentionFilter.toLowerCase())
  );

  useEffect(() => {
    if (isActive && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isActive]);

  // Handle @ mention detection in reply
  const handleReplyChange = (text: string) => {
    setReplyText(text);

    // Check for @ mentions
    const lastAtIndex = text.lastIndexOf('@');
    if (lastAtIndex >= 0) {
      const textAfterAt = text.slice(lastAtIndex + 1);
      // Check if we're still in a mention context (no space after @)
      if (!textAfterAt.includes(' ') && textAfterAt.length < 20) {
        setMentionFilter(textAfterAt);
        setShowMentionDropdown(true);
      } else {
        setShowMentionDropdown(false);
      }
    } else {
      setShowMentionDropdown(false);
    }
  };

  const insertMention = (userName: string) => {
    const lastAtIndex = replyText.lastIndexOf('@');
    const newText = replyText.slice(0, lastAtIndex) + '@' + userName + ' ';
    setReplyText(newText);
    setShowMentionDropdown(false);
    setMentionFilter('');
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleReply = () => {
    if (!replyText.trim()) return;
    const mentions = parseMentions(replyText);
    const currentUserId = useCanvasStore.getState().userId;
    const currentUserName = useCanvasStore.getState().userName;
    const replyData = {
      id: crypto.randomUUID(),
      authorId: currentUserId,
      authorName: currentUserName,
      content: replyText.trim(),
      mentions,
      timestamp: Date.now(),
      isRead: false,
    };
    // Use addReply with existing reply to ensure same ID
    const reply = useCanvasStore.getState().addReply(comment.id, replyText.trim(), mentions, [], replyData);
    emitCommentReply(comment.id, reply);

    // Emit mention notifications for each mentioned user
    mentions.forEach(mention => {
      const notification: MentionNotification = {
        id: crypto.randomUUID(),
        commentId: comment.id,
        authorId: currentUserId,
        authorName: currentUserName,
        authorColor: '#3B82F6',
        content: replyText.trim(),
        mentionedUserId: mention.userId,
        timestamp: Date.now(),
        read: false,
      };
      emitMentionNotification(notification);
    });

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

  // Drag handlers for moving comment pin
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    e.stopPropagation();

    // Don't start drag if clicking on popover or inside it
    const target = e.target as HTMLElement;
    if (target.closest('[data-popover]')) return;

    let dragging = true;
    setIsDragging(true);
    const startX = e.clientX;
    const startY = e.clientY;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!dragging) return;
      // Update position in real-time but don't save yet
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      if (!dragging) return;
      dragging = false;
      setIsDragging(false);

      // Only update if actually dragged more than 5 pixels
      const dx = Math.abs(upEvent.clientX - startX);
      const dy = Math.abs(upEvent.clientY - startY);

      if (dx > 5 || dy > 5) {
        // Calculate new canvas position
        const currentScreenX = screenX + (upEvent.clientX - startX);
        const currentScreenY = screenY + (upEvent.clientY - startY);

        // Convert screen coordinates back to canvas coordinates
        const newCanvasX = (currentScreenX - viewportPosition.x) / viewportZoom;
        const newCanvasY = (currentScreenY - viewportPosition.y) / viewportZoom;

        // Update comment position
        updateCommentPosition(comment.id, newCanvasX, newCanvasY);

        // Emit to other users
        emitCommentUpdate(comment.id, { canvasX: newCanvasX, canvasY: newCanvasY });
      }

      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div
      ref={pinRef}
      className="absolute z-50"
      style={{
        left: screenX,
        top: screenY,
        transform: 'translate(-50%, -100%)',
        cursor: isDragging ? 'grabbing' : 'grab',
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onMouseDown={handleMouseDown}
    >
      {/* Pin */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (!isDragging) {
            onClick();
            setShowPopover(true);
          }
        }}
        className={cn(
          'relative flex items-center justify-center rounded-full border-2 border-white shadow-lg transition-all duration-150',
          isHovered && 'scale-110',
          isActive && 'scale-110 ring-2 ring-blue-500',
          comment.resolved && 'opacity-50',
          isDragging && 'scale-110'
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
                  emitCommentDelete(comment.id);
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
              {/* Mention autocomplete dropdown */}
              {showMentionDropdown && filteredUsers.length > 0 && (
                <div className="mb-2 p-2 bg-gray-50 rounded border border-gray-200 max-h-24 overflow-y-auto">
                  {filteredUsers.slice(0, 5).map(user => (
                    <button
                      key={user.id}
                      onClick={() => insertMention(user.name)}
                      className="w-full text-left px-2 py-1 text-sm hover:bg-blue-50 rounded flex items-center gap-2"
                    >
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] text-white font-bold"
                        style={{ backgroundColor: user.color }}
                      >
                        {user.name[0].toUpperCase()}
                      </div>
                      <span>{user.name}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Reply textarea */}
              <textarea
                ref={inputRef}
                value={replyText}
                onChange={(e) => handleReplyChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Add a reply... (use @ to mention)"
                className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded resize-none outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                rows={2}
              />

              <div className="flex items-center justify-end mt-2">
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
  const { comments, isCommentMode, viewportPosition, viewportZoom, activeCommentId, hoveredCommentId, setActiveCommentId, setHoveredCommentId, addComment, setTool, setIsCommentMode, pendingCommentX, pendingCommentY, users, parseMentions, userId, userName } = useCanvasStore();
  const { emitCommentCreate, emitCommentDelete, emitMentionNotification } = useSocket();
  const [newCommentText, setNewCommentText] = useState('');
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Get online users for mention autocomplete
  const onlineUsers = Array.from(users.values());

  // Filter users based on mention filter
  const filteredUsers = onlineUsers.filter(u =>
    u.name.toLowerCase().includes(mentionFilter.toLowerCase())
  );

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

  // Handle @ mention detection in new comment
  const handleCommentChange = (text: string) => {
    setNewCommentText(text);

    const lastAtIndex = text.lastIndexOf('@');
    if (lastAtIndex >= 0) {
      const textAfterAt = text.slice(lastAtIndex + 1);
      if (!textAfterAt.includes(' ') && textAfterAt.length < 20) {
        setMentionFilter(textAfterAt);
        setShowMentionDropdown(true);
      } else {
        setShowMentionDropdown(false);
      }
    } else {
      setShowMentionDropdown(false);
    }
  };

  const insertMention = (userName: string) => {
    const lastAtIndex = newCommentText.lastIndexOf('@');
    const newText = newCommentText.slice(0, lastAtIndex) + '@' + userName + ' ';
    setNewCommentText(newText);
    setShowMentionDropdown(false);
    setMentionFilter('');
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleCreateComment = () => {
    if (!pendingComment || !newCommentText.trim()) return;
    const mentions = parseMentions(newCommentText);
    // Use addComment which generates the ID and returns the comment
    const comment = addComment(pendingComment.x, pendingComment.y, newCommentText.trim(), mentions, []);
    emitCommentCreate(comment);

    // Emit mention notifications for each mentioned user
    mentions.forEach(mention => {
      const notification: MentionNotification = {
        id: crypto.randomUUID(),
        commentId: comment.id,
        authorId: userId,
        authorName: userName,
        authorColor: '#3B82F6',
        content: newCommentText.trim(),
        mentionedUserId: mention.userId,
        timestamp: Date.now(),
        read: false,
      };
      emitMentionNotification(notification);
    });

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
            transform: 'translate(-50%, 0)',
          }}
        >
          <div className="w-72 p-3">
            {/* Mention autocomplete dropdown */}
            {showMentionDropdown && filteredUsers.length > 0 && (
              <div className="mb-2 p-2 bg-gray-50 rounded border border-gray-200 max-h-24 overflow-y-auto">
                {filteredUsers.slice(0, 5).map(user => (
                  <button
                    key={user.id}
                    onClick={() => insertMention(user.name)}
                    className="w-full text-left px-2 py-1 text-sm hover:bg-blue-50 rounded flex items-center gap-2"
                  >
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] text-white font-bold"
                      style={{ backgroundColor: user.color }}
                    >
                      {user.name[0].toUpperCase()}
                    </div>
                    <span>{user.name}</span>
                  </button>
                ))}
              </div>
            )}

            <textarea
              ref={inputRef}
              value={newCommentText}
              onChange={(e) => handleCommentChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleCreateComment();
                }
                if (e.key === 'Escape') {
                  handleCancelComment();
                }
              }}
              placeholder="Add a comment... (use @ to mention)"
              className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded resize-none outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
              rows={3}
              autoFocus
            />

            <div className="flex items-center justify-end mt-2">
              <button
                onClick={handleCancelComment}
                className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700 mr-2"
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