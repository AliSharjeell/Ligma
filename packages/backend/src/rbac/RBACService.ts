// RBAC Implementation for LIMA

export type Role = 'Lead' | 'Contributor' | 'Viewer';

export interface User {
  id: string;
  name: string;
  role: Role;
  canvasPermissions: Map<string, Role>;
}

export interface NodeACL {
  nodeId: string;
  allowedUsers: Map<string, Role>;
  deniedUsers: Set<string>;
  inheritedFrom?: string;
}

export interface Permission {
  canCreate: boolean;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canLock: boolean;
  canGrantAccess: boolean;
}

const ROLE_PERMISSIONS: Record<Role, Permission> = {
  Lead: {
    canCreate: true,
    canRead: true,
    canUpdate: true,
    canDelete: true,
    canLock: true,
    canGrantAccess: true
  },
  Contributor: {
    canCreate: true,
    canRead: true,
    canUpdate: true,
    canDelete: true,
    canLock: true,
    canGrantAccess: false
  },
  Viewer: {
    canCreate: false,
    canRead: true,
    canUpdate: false,
    canDelete: false,
    canLock: false,
    canGrantAccess: false
  }
};

export class RBACService {
  private users: Map<string, User> = new Map();
  private canvasRoles: Map<string, Map<string, Role>> = new Map();
  private nodeACLs: Map<string, Map<string, NodeACL>> = new Map();
  private lockedNodes: Map<string, { lockedBy: string; expiry?: number }> = new Map();

  registerUser(userId: string, name: string, role: Role, canvasId?: string): void {
    const user: User = {
      id: userId,
      name,
      role,
      canvasPermissions: new Map()
    };
    this.users.set(userId, user);

    if (canvasId) {
      this.assignCanvasRole(userId, canvasId, role);
    }
  }

  assignCanvasRole(userId: string, canvasId: string, role: Role): void {
    if (!this.canvasRoles.has(canvasId)) {
      this.canvasRoles.set(canvasId, new Map());
    }
    this.canvasRoles.get(canvasId)!.set(userId, role);
  }

  getUserRole(userId: string, canvasId: string): Role {
    const user = this.users.get(userId);
    if (!user) return 'Viewer';

    const canvasRole = this.canvasRoles.get(canvasId)?.get(userId);
    return canvasRole || user.role;
  }

  getPermissions(userId: string, canvasId: string): Permission {
    const role = this.getUserRole(userId, canvasId);
    return { ...ROLE_PERMISSIONS[role] };
  }

  canPerformAction(
    userId: string,
    canvasId: string,
    action: keyof Permission
  ): boolean {
    const perms = this.getPermissions(userId, canvasId);
    return perms[action];
  }

  setNodeACL(canvasId: string, nodeId: string, userId: string, role: Role): void {
    if (!this.nodeACLs.has(canvasId)) {
      this.nodeACLs.set(canvasId, new Map());
    }

    const canvasACLs = this.nodeACLs.get(canvasId)!;
    let nodeACL = canvasACLs.get(nodeId);

    if (!nodeACL) {
      nodeACL = {
        nodeId,
        allowedUsers: new Map(),
        deniedUsers: new Set()
      };
      canvasACLs.set(nodeId, nodeACL);
    }

    nodeACL.allowedUsers.set(userId, role);
    nodeACL.deniedUsers.delete(userId);
  }

  denyNodeAccess(canvasId: string, nodeId: string, userId: string): void {
    if (!this.nodeACLs.has(canvasId)) return;

    const nodeACL = this.nodeACLs.get(canvasId)!.get(nodeId);
    if (nodeACL) {
      nodeACL.allowedUsers.delete(userId);
      nodeACL.deniedUsers.add(userId);
    }
  }

  getNodePermission(userId: string, canvasId: string, nodeId: string): Permission {
    const nodeACL = this.nodeACLs.get(canvasId)?.get(nodeId);

    if (nodeACL) {
      if (nodeACL.deniedUsers.has(userId)) {
        return {
          canCreate: false,
          canRead: false,
          canUpdate: false,
          canDelete: false,
          canLock: false,
          canGrantAccess: false
        };
      }

      const specificRole = nodeACL.allowedUsers.get(userId);
      if (specificRole) {
        return { ...ROLE_PERMISSIONS[specificRole] };
      }
    }

    return this.getPermissions(userId, canvasId);
  }

  canModifyNode(userId: string, canvasId: string, nodeId: string): boolean {
    const perms = this.getNodePermission(userId, canvasId, nodeId);
    return perms.canUpdate;
  }

  lockNode(nodeId: string, userId: string, canvasId: string, durationMs?: number): boolean {
    if (!this.canPerformAction(userId, canvasId, 'canLock')) {
      return false;
    }

    const existingLock = this.lockedNodes.get(nodeId);
    if (existingLock && existingLock.lockedBy !== userId) {
      if (existingLock.expiry && existingLock.expiry > Date.now()) {
        return false;
      }
    }

    const expiry = durationMs ? Date.now() + durationMs : undefined;
    this.lockedNodes.set(nodeId, { lockedBy: userId, expiry });
    return true;
  }

  unlockNode(nodeId: string, userId: string): boolean {
    const lock = this.lockedNodes.get(nodeId);
    if (!lock) return true;

    if (lock.lockedBy !== userId) {
      return false;
    }

    this.lockedNodes.delete(nodeId);
    return true;
  }

  lockNodes(nodeIds: string[], userId: string, canvasId: string, durationMs?: number): { successful: string[], failed: string[] } {
    const successful: string[] = [];
    const failed: string[] = [];

    for (const nodeId of nodeIds) {
      if (this.lockNode(nodeId, userId, canvasId, durationMs)) {
        successful.push(nodeId);
      } else {
        failed.push(nodeId);
      }
    }

    return { successful, failed };
  }

  unlockNodes(nodeIds: string[], userId: string): { successful: string[], failed: string[] } {
    const successful: string[] = [];
    const failed: string[] = [];

    for (const nodeId of nodeIds) {
      if (this.unlockNode(nodeId, userId)) {
        successful.push(nodeId);
      } else {
        failed.push(nodeId);
      }
    }

    return { successful, failed };
  }

  isNodeLocked(nodeId: string): { locked: boolean; lockedBy?: string; expired?: boolean } {
    const lock = this.lockedNodes.get(nodeId);
    if (!lock) return { locked: false };

    const expired = lock.expiry && lock.expiry < Date.now();
    if (expired) {
      this.lockedNodes.delete(nodeId);
      return { locked: false };
    }

    return { locked: true, lockedBy: lock.lockedBy };
  }

  getLockedNodes(canvasId: string): Map<string, string> {
    const result = new Map<string, string>();
    for (const [nodeId, lock] of this.lockedNodes.entries()) {
      if (!lock.expiry || lock.expiry > Date.now()) {
        result.set(nodeId, lock.lockedBy);
      }
    }
    return result;
  }

  changeRole(userId: string, canvasId: string, targetUserId: string, newRole: Role): boolean {
    if (!this.canPerformAction(userId, canvasId, 'canGrantAccess')) {
      return false;
    }

    this.assignCanvasRole(targetUserId, canvasId, newRole);
    return true;
  }
}