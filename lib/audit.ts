import { AuditLog } from "@/lib/models";

type CreateAuditLogOptions = {
  adminId: string;

  action: string;

  targetType: string;

  targetId?: string;

  description: string;

  previousValue?: unknown;

  newValue?: unknown;

  ipAddress?: string;

  userAgent?: string;

  metadata?: Record<string, unknown>;
};

export async function createAuditLog(
  options: CreateAuditLogOptions
) {
  try {
    await AuditLog.create({
      adminId: options.adminId,

      action: options.action,

      targetType:
        options.targetType,

      targetId:
        options.targetId,

      description:
        options.description,

      previousValue:
        options.previousValue,

      newValue:
        options.newValue,

      ipAddress:
        options.ipAddress,

      userAgent:
        options.userAgent,

      metadata:
        options.metadata,
    });
  } catch (error) {
    /*
     * Audit logging should never be allowed
     * to crash the main business operation.
     */
    console.error(
      "AUDIT LOG ERROR:",
      error
    );
  }
}
