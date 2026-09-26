import { db } from '../db/index.ts';
import { auditLogs } from '../db/schema.ts';

export async function logAudit(params: {
  userId?: string | null;
  userName: string;
  userRole: string;
  action: string;
  entity: string;
  entityId?: string | null;
  details: string;
  ipAddress?: string | null;
}) {
  try {
    const id = `aud-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    await db.insert(auditLogs).values({
      id,
      userId: params.userId || null,
      userName: params.userName,
      userRole: params.userRole,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId || null,
      details: params.details,
      ipAddress: params.ipAddress || 'internal',
    });
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}
