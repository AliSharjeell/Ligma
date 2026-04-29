// Group-Level Access Control - Per-Group Permissions
// Group creator = owner, can promote Contributors to co-owners
// Overall Lead = always has same permissions as group owner
// Contributors = viewers for group (can add content inside, not move group)

import { GroupState } from '../events/types';

export interface GroupPermission {
  canMove: boolean;
  canResize: boolean;
  canEditContent: boolean;
  canDelete: boolean;
  canManageOwners: boolean; // Only owner + global Lead
}

export class GroupACLService {
  // In-memory store: canvasId -> groupId -> GroupState
  private groups: Map<string, Map<string, GroupState>> = new Map();

  // Get or create group map for a canvas
  private getCanvasGroups(canvasId: string): Map<string, GroupState> {
    if (!this.groups.has(canvasId)) {
      this.groups.set(canvasId, new Map());
    }
    return this.groups.get(canvasId)!;
  }

  // Create a new group from selected nodes
  createGroup(canvasId: string, groupId: string, nodeIds: string[], creatorId: string): GroupState {
    const canvasGroups = this.getCanvasGroups(canvasId);

    const group: GroupState = {
      id: groupId,
      canvasId,
      nodeIds: [...nodeIds],
      ownerId: creatorId, // Creator is the owner
      coOwners: [],
      createdAt: Date.now(),
      createdBy: creatorId,
    };

    canvasGroups.set(groupId, group);
    return group;
  }

  // Delete/ungroup a group
  deleteGroup(canvasId: string, groupId: string): boolean {
    const canvasGroups = this.groups.get(canvasId);
    if (!canvasGroups) return false;
    return canvasGroups.delete(groupId);
  }

  // Get group by ID
  getGroup(canvasId: string, groupId: string): GroupState | undefined {
    return this.groups.get(canvasId)?.get(groupId);
  }

  // Get all groups for a canvas
  getCanvasGroupStates(canvasId: string): GroupState[] {
    const canvasGroups = this.groups.get(canvasId);
    if (!canvasGroups) return [];
    return Array.from(canvasGroups.values());
  }

  // Check if user is a group owner (primary or co-owner)
  isGroupOwner(canvasId: string, groupId: string, userId: string, userRole: 'Lead' | 'Contributor' | 'Viewer'): boolean {
    const group = this.getGroup(canvasId, groupId);
    if (!group) return false;

    // Global Lead always has owner permissions
    if (userRole === 'Lead') return true;

    // Primary owner
    if (group.ownerId === userId) return true;

    // Co-owner
    if (group.coOwners.includes(userId)) return true;

    return false;
  }

  // Add a co-owner to a group
  addCoOwner(canvasId: string, groupId: string, requesterId: string, targetUserId: string, requesterRole: 'Lead' | 'Contributor' | 'Viewer'): boolean {
    const group = this.getGroup(canvasId, groupId);
    if (!group) return false;

    // Check if requester has permission
    if (!this.isGroupOwner(canvasId, groupId, requesterId, requesterRole)) {
      return false;
    }

    // Target must be at least Contributor globally
    // This check happens at socket level before calling

    if (!group.coOwners.includes(targetUserId)) {
      group.coOwners.push(targetUserId);
    }

    return true;
  }

  // Remove a co-owner from a group
  removeCoOwner(canvasId: string, groupId: string, requesterId: string, targetUserId: string, requesterRole: 'Lead' | 'Contributor' | 'Viewer'): boolean {
    const group = this.getGroup(canvasId, groupId);
    if (!group) return false;

    // Check if requester has permission
    if (!this.isGroupOwner(canvasId, groupId, requesterId, requesterRole)) {
      return false;
    }

    // Cannot remove primary owner
    if (group.ownerId === targetUserId) {
      return false;
    }

    const idx = group.coOwners.indexOf(targetUserId);
    if (idx !== -1) {
      group.coOwners.splice(idx, 1);
    }

    return true;
  }

  // Get effective permissions for a user on a specific group
  getGroupPermissions(
    canvasId: string,
    groupId: string,
    userId: string,
    userRole: 'Lead' | 'Contributor' | 'Viewer'
  ): GroupPermission {
    const isOwner = this.isGroupOwner(canvasId, groupId, userId, userRole);

    if (isOwner) {
      return {
        canMove: true,
        canResize: true,
        canEditContent: true,
        canDelete: true,
        canManageOwners: true,
      };
    }

    // Non-owners are viewers only - cannot move, edit, or delete
    // They can only VIEW the group's content
    return {
      canMove: false,
      canResize: false,
      canEditContent: false, // Viewers only - even Contributors can't edit unless promoted to co-owner
      canDelete: false,
      canManageOwners: false,
    };
  }

  // Check if user can move a specific node (considering group membership)
  canMoveNode(
    canvasId: string,
    nodeId: string,
    userId: string,
    userRole: 'Lead' | 'Contributor' | 'Viewer',
    getNodeGroupId: (nodeId: string) => string | undefined
  ): boolean {
    const groupId = getNodeGroupId(nodeId);

    // No group = normal permissions
    if (!groupId) {
      return userRole !== 'Viewer';
    }

    // Has group = check group permissions
    const perms = this.getGroupPermissions(canvasId, groupId, userId, userRole);
    return perms.canMove;
  }

  // Add node to existing group
  addNodeToGroup(canvasId: string, groupId: string, nodeId: string): boolean {
    const group = this.getGroup(canvasId, groupId);
    if (!group) return false;

    if (!group.nodeIds.includes(nodeId)) {
      group.nodeIds.push(nodeId);
    }

    return true;
  }

  // Remove node from group (ungroup single node)
  removeNodeFromGroup(canvasId: string, groupId: string, nodeId: string): boolean {
    const group = this.getGroup(canvasId, groupId);
    if (!group) return false;

    const idx = group.nodeIds.indexOf(nodeId);
    if (idx !== -1) {
      group.nodeIds.splice(idx, 1);
    }

    // If group is empty, delete it
    if (group.nodeIds.length === 0) {
      this.deleteGroup(canvasId, groupId);
    }

    return true;
  }

  // Transfer primary ownership
  transferOwnership(canvasId: string, groupId: string, currentOwnerId: string, newOwnerId: string, userRole: 'Lead' | 'Contributor' | 'Viewer'): boolean {
    const group = this.getGroup(canvasId, groupId);
    if (!group) return false;

    // Only current owner or global Lead can transfer
    if (userRole !== 'Lead' && group.ownerId !== currentOwnerId) {
      return false;
    }

    // Move old owner to co-owner
    if (!group.coOwners.includes(group.ownerId)) {
      group.coOwners.push(group.ownerId);
    }

    // Remove new owner from co-owners if present
    const newIdx = group.coOwners.indexOf(newOwnerId);
    if (newIdx !== -1) {
      group.coOwners.splice(newIdx, 1);
    }

    group.ownerId = newOwnerId;
    return true;
  }

  // Clear all groups (for testing or reset)
  clearCanvasGroups(canvasId: string): void {
    this.groups.delete(canvasId);
  }

  // Restore from persisted state (for reconnection)
  restoreGroups(canvasId: string, groupStates: GroupState[]): void {
    const canvasGroups = this.getCanvasGroups(canvasId);
    for (const group of groupStates) {
      canvasGroups.set(group.id, group);
    }
  }
}

export const groupACL = new GroupACLService();
