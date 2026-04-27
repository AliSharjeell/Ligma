// Node-Level RBAC - Per-Node Access Control

export type Role = 'Lead' | 'Contributor' | 'Viewer';
export type Permission = 'read' | 'write' | 'delete' | 'lock' | 'unlock';

interface NodeACL {
  nodeId: string;
  permissions: Map<string, Set<Permission>>;
  lockedBy?: string;
  lockExpiry?: number;
}

const ROLE_HIERARCHY: Record<Role, number> = {
  Lead: 3,
  Contributor: 2,
  Viewer: 1
};

export class NodeACLManager {
  private acls: Map<string, NodeACL> = new Map();
  private globalRoles: Map<string, Role> = new Map();

  setGlobalRole(userId: string, role: Role): void {
    this.globalRoles.set(userId, role);
  }

  getGlobalRole(userId: string): Role {
    return this.globalRoles.get(userId) || 'Viewer';
  }

  initializeNodeACL(nodeId: string): void {
    if (!this.acls.has(nodeId)) {
      this.acls.set(nodeId, {
        nodeId,
        permissions: new Map()
      });
    }
  }

  setNodePermission(
    nodeId: string,
    userId: string,
    permissions: Permission[]
  ): void {
    this.initializeNodeACL(nodeId);
    const acl = this.acls.get(nodeId)!;
    acl.permissions.set(userId, new Set(permissions));
  }

  grantRolePermission(
    nodeId: string,
    role: Role,
    permissions: Permission[]
  ): void {
    this.initializeNodeACL(nodeId);
    const acl = this.acls.get(nodeId)!;
    acl.permissions.set(role, new Set(permissions));
  }

  canPerform(userId: string, nodeId: string, action: Permission): boolean {
    // Check if node is locked by someone else
    const acl = this.acls.get(nodeId);
    if (acl?.lockedBy && acl.lockedBy !== userId) {
      if (acl.lockExpiry && Date.now() > acl.lockExpiry) {
        // Lock expired
        acl.lockedBy = undefined;
        acl.lockExpiry = undefined;
      } else if (action !== 'read') {
        // Only the lock holder can write
        return false;
      }
    }

    // Check specific permissions for this user on this node
    const nodeSpecific = acl?.permissions.get(userId);
    if (nodeSpecific?.has(action)) {
      return true;
    }

    // Fall back to role-based permissions
    const role = this.getGlobalRole(userId);
    const rolePermissions = acl?.permissions.get(role);

    if (rolePermissions?.has(action)) {
      return true;
    }

    // Default permissions based on role hierarchy
    return this.hasDefaultPermission(role, action);
  }

  private hasDefaultPermission(role: Role, action: Permission): boolean {
    switch (role) {
      case 'Lead':
        return true; // Lead can do everything
      case 'Contributor':
        return action !== 'lock' && action !== 'unlock';
      case 'Viewer':
        return action === 'read';
      default:
        return false;
    }
  }

  lockNode(nodeId: string, userId: string, durationMs?: number): boolean {
    const role = this.getGlobalRole(userId);

    if (role !== 'Lead' && role !== 'Contributor') {
      return false;
    }

    this.initializeNodeACL(nodeId);
    const acl = this.acls.get(nodeId)!;

    // Check if already locked by someone else
    if (acl.lockedBy && acl.lockedBy !== userId) {
      if (acl.lockExpiry && Date.now() < acl.lockExpiry) {
        return false; // Can't override another user's lock
      }
    }

    acl.lockedBy = userId;
    acl.lockExpiry = durationMs ? Date.now() + durationMs : undefined;

    return true;
  }

  unlockNode(nodeId: string, userId: string): boolean {
    const acl = this.acls.get(nodeId);

    if (!acl?.lockedBy) {
      return true; // Not locked
    }

    const role = this.getGlobalRole(userId);

    // Only the lock holder or Lead can unlock
    if (acl.lockedBy !== userId && role !== 'Lead') {
      return false;
    }

    acl.lockedBy = undefined;
    acl.lockExpiry = undefined;

    return true;
  }

  isLocked(nodeId: string): { locked: boolean; lockedBy?: string } {
    const acl = this.acls.get(nodeId);

    if (!acl?.lockedBy) {
      return { locked: false };
    }

    // Check if lock expired
    if (acl.lockExpiry && Date.now() > acl.lockExpiry) {
      acl.lockedBy = undefined;
      acl.lockExpiry = undefined;
      return { locked: false };
    }

    return { locked: true, lockedBy: acl.lockedBy };
  }

  removeNodeACL(nodeId: string): void {
    this.acls.delete(nodeId);
  }

  getUserNodes(userId: string): string[] {
    const userNodes: string[] = [];
    for (const [nodeId, acl] of this.acls) {
      if (acl.permissions.has(userId)) {
        userNodes.push(nodeId);
      }
    }
    return userNodes;
  }
}

export const aclManager = new NodeACLManager();
