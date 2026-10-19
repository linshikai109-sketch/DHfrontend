import type { Command, ProductService, Request, Role } from "./types";

export interface Journal {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
export interface ClientStatus {
  pending: boolean;
  busy: boolean;
  error: string;
}
export type Recovery = "succeeded" | "failed" | "unknown" | "none";
function problem(code: string, message: string): Error & { code: string } {
  return Object.assign(new Error(message), { code });
}
function validRequest(value: unknown): value is Request {
  if (!value || typeof value !== "object") return false;
  const r = value as Partial<Request>;
  return (
    typeof r.operationId === "string" &&
    r.operationId.trim().length > 0 &&
    (r.role === "emma" || r.role === "john") &&
    !!r.command &&
    typeof r.command === "object" &&
    !Array.isArray(r.command) &&
    typeof r.command.type === "string" &&
    r.command.type.length > 0
  );
}

export function createClient(service: ProductService, storage: Journal) {
  const key = "emma-john-v2-pending-" + service.profile;
  let busy = false;
  // Also retain the request in memory if clearing its durable journal fails.
  let unsettled: Request | undefined;

  function pending(): Request | undefined {
    let raw: string | null;
    try {
      raw = storage.getItem(key);
    } catch {
      throw problem(
        "JOURNAL_READ_FAILED",
        "无法读取操作记录，请恢复浏览器存储后重试；原记录未被覆盖。",
      );
    }
    if (raw === null) return unsettled;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw problem(
        "JOURNAL_INVALID",
        "操作记录已损坏，无法确认上次结果；请保留原数据后重试。",
      );
    }
    if (!validRequest(parsed))
      throw problem(
        "JOURNAL_INVALID",
        "操作记录格式不完整，无法确认上次结果；原记录未被覆盖。",
      );
    return parsed;
  }

  function status(): ClientStatus {
    try {
      return { pending: !!pending(), busy, error: "" };
    } catch (error) {
      return { pending: true, busy, error: (error as Error).message };
    }
  }

  function write(request: Request) {
    try {
      storage.setItem(key, JSON.stringify(request));
    } catch {
      throw problem(
        "JOURNAL_WRITE_FAILED",
        "无法保存操作记录，本次操作尚未发送；请恢复存储空间后重试。",
      );
    }
    // A denied or silently ignored write must never send an untracked mutation.
    const stored = pending();
    if (stored?.operationId !== request.operationId) {
      throw problem(
        "JOURNAL_WRITE_FAILED",
        "操作记录未保存，本次操作尚未发送。",
      );
    }
    unsettled = request;
  }

  function clear(request: Request) {
    const stored = pending();
    if (stored?.operationId !== request.operationId) {
      throw problem(
        "JOURNAL_CONFLICT",
        "操作记录已变化，请重新查询结果；没有覆盖其他操作。",
      );
    }
    try {
      storage.removeItem(key);
      if (storage.getItem(key) !== null) throw new Error("Journal retained");
    } catch {
      throw problem(
        "JOURNAL_CLEAR_FAILED",
        "结果已有回执，但操作记录清理失败；请查询原操作后再继续。",
      );
    }
    unsettled = undefined;
  }

  function acquire() {
    if (busy) throw problem("CLIENT_BUSY", "当前操作正在处理中，请稍候。");
    busy = true;
  }

  return {
    status,
    hasPending: () => status().pending,
    async execute(role: Role, command: Command) {
      acquire();
      try {
        if (pending())
          throw problem(
            "PENDING_OPERATION",
            "上次操作结果待确认，请先查询结果。",
          );
        // All mutations, including drafts and edits, need the same recovery identity.
        const request: Request = JSON.parse(
          JSON.stringify({ operationId: crypto.randomUUID(), role, command }),
        );
        write(request);
        let result;
        try {
          result = await service.execute(request);
        } catch (error) {
          const code = (error as { code?: string })?.code;
          if (code === "OUTCOME_UNKNOWN") throw error;
          // These service errors explicitly guarantee that no business write happened.
          if (code === "STORAGE_FAILED" || code === "CAPABILITY_UNAVAILABLE" || code === "CLIENT_BUSY") {
            clear(request);
          } else {
            let receipt;
            try {
              receipt = await service.getOperation(request.operationId);
            } catch {
              /* Keep the journal when receipt lookup is unavailable. */
            }
            if (receipt?.state === "failed") clear(request);
          }
          throw error;
        }
        clear(request);
        return result;
      } finally {
        busy = false;
      }
    },
    async retryPending(): Promise<Recovery> {
      acquire();
      try {
        const request = pending();
        if (!request) return "none";
        // Explicit retry reuses the durable envelope; never creates a new identity.
        const receipt = await service.getOperation(request.operationId);
        if (receipt) { clear(request); return receipt.state; }
        await service.execute(request);
        clear(request);
        return "succeeded";
      } finally { busy = false; }
    },
    async recover(): Promise<Recovery> {
      acquire();
      try {
        const request = pending();
        if (!request) return "none";
        const receipt = await service.getOperation(request.operationId);
        if (receipt?.state === "succeeded" || receipt?.state === "failed") {
          clear(request);
          return receipt.state;
        }
        return "unknown";
      } finally {
        busy = false;
      }
    },
  };
}
