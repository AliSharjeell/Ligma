'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useCanvasStore } from '@/store/canvas-store';
import { cn } from '@/lib/utils';
import { Check, X, Trash2, AtSign, Paperclip, Image as ImageIcon, XCircle } from 'lucide-react';
import type { Mention, CommentAttachment } from '@/types/canvas';

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
    attachments: CommentAttachment[];
    timestamp: number;
    resolved: boolean;
    replies: Array<{
      id: string;
      authorId: string;
      authorName: string;
      content: string;
      mentions: Mention[];
      attachments: CommentAttachment[];
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
  const { resolveComment, deleteComment, users, parseMentions, fileToDataUrl } = useCanvasStore();
  const [showPopover, setShowPopover] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [attachments, setAttachments] = useState<CommentAttachment[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      try {
        const url = await fileToDataUrl(file);
        setAttachments(prev => [...prev, {
          id: crypto.randomUUID(),
          name: file.name,
          url,
          type: file.type,
          size: file.size,
        }]);
      } catch (error) {
        console.error('Failed to attach file:', error);
      }
    }
    // Reset input
    e.target.value = '';
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const handleReply = () => {
    if (!replyText.trim() && attachments.length === 0) return;
    const mentions = parseMentions(replyText);
    useCanvasStore.getState().addReply(comment.id, replyText.trim(), mentions, attachments);
    setReplyText('');
    setAttachments([]);
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

              {/* Attachments preview */}
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {attachments.map(attachment => (
                    <div key={attachment.id} className="relative group">
                      {attachment.type.startsWith('image/') ? (
                        <img
                          src={attachment.url}
                          alt={attachment.name}
                          className="w-12 h-12 object-cover rounded border border-gray-200"
                        />
                      ) : (
                        <div className="w-12 h-12 flex items-center justify-center bg-gray-100 rounded border border-gray-200">
                          <Paperclip className="size-4 text-gray-500" />
                        </div>
                      )}
                      <button
                        onClick={() => removeAttachment(attachment.id)}
                        className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <XCircle className="size-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between mt-2">
                <div className="flex gap-1">
                  <label className="p-1 rounded hover:bg-gray-100 cursor-pointer" title="Attach file">
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      onChange={handleFileSelect}
                      accept="image/*,.pdf,.doc,.docx"
                    />
                    <Paperclip className="size-4 text-gray-500" />
                  </label>
                </div>
                <button
                  onClick={handleReply}
                  disabled={!replyText.trim() && attachments.length === 0}
                  className={cn(
                    'px-3 py-1 text-xs font-medium rounded transition-colors',
                    replyText.trim() || attachments.length > 0
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
  const { comments, isCommentMode, viewportPosition, viewportZoom, activeCommentId, hoveredCommentId, setActiveCommentId, setHoveredCommentId, addComment, setTool, setIsCommentMode, pendingCommentX, pendingCommentY, users, parseMentions, fileToDataUrl } = useCanvasStore();
  const [newCommentText, setNewCommentText] = useState('');
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [attachments, setAttachments] = useState<CommentAttachment[]>([]);
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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      try {
        const url = await fileToDataUrl(file);
        setAttachments(prev => [...prev, {
          id: crypto.randomUUID(),
          name: file.name,
          url,
          type: file.type,
          size: file.size,
        }]);
      } catch (error) {
        console.error('Failed to attach file:', error);
      }
    }
    e.target.value = '';
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const handleCreateComment = () => {
    if (!pendingComment || (!newCommentText.trim() && attachments.length === 0)) return;
    const mentions = parseMentions(newCommentText);
    addComment(pendingComment.x, pendingComment.y, newCommentText.trim(), mentions, attachments);
    useCanvasStore.setState({ pendingCommentX: null, pendingCommentY: null });
    setNewCommentText('');
    setAttachments([]);
    setIsCommentMode(false);
    setTool('select');
  };

  const handleCancelComment = () => {
    useCanvasStore.setState({ pendingCommentX: null, pendingCommentY: null });
    setNewCommentText('');
    setAttachments([]);
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

            {/* Attachments preview */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {attachments.map(attachment => (
                  <div key={attachment.id} className="relative group">
                    {attachment.type.startsWith('image/') ? (
                      <img
                        src={attachment.url}
                        alt={attachment.name}
                        className="w-12 h-12 object-cover rounded border border-gray-200"
                      />
                    ) : (
                      <div className="w-12 h-12 flex items-center justify-center bg-gray-100 rounded border border-gray-200">
                        <Paperclip className="size-4 text-gray-500" />
                      </div>
                    )}
                    <button
                      onClick={() => removeAttachment(attachment.id)}
                      className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <XCircle className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between mt-2">
              <label className="p-1 rounded hover:bg-gray-100 cursor-pointer" title="Attach file">
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                  accept="image/*,.pdf,.doc,.docx"
                />
                <Paperclip className="size-4 text-gray-500" />
              </label>
              <div className="flex gap-2">
                <button
                  onClick={handleCancelComment}
                  className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateComment}
                  disabled={!newCommentText.trim() && attachments.length === 0}
                  className={cn(
                    'px-3 py-1 text-xs font-medium rounded transition-colors',
                    newCommentText.trim() || attachments.length > 0
                      ? 'bg-blue-500 text-white hover:bg-blue-600'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  )}
                >
                  Post
                </button>
              </div>
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