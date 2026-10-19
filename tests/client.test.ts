import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient, type Journal } from "../src/domain/client";
import { createMockService, setDemoFault } from "../src/domain/service";
import type { Command, ProductService, Request } from "../src/domain/types";

const journalKey = "emma-john-v2-pending-demo_mock";
function memoryStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
  };
}
const draft: Command = {
  type: "saveDraft",
  questionId: "goal",
  value: "A recoverable draft",
};
beforeEach(() => setDemoFault("none"));

describe("mutation journal and recovery", () => {
  it("restores a noncritical lost-response request after reloading both client and service without replaying it", async () => {
    const storage = memoryStorage();
    const firstService = createMockService(storage);
    const first = createClient(firstService, storage);
    setDemoFault("lost_response");
    await expect(
      first.execute("emma", {
        type: "addContext",
        title: "Only once",
        kind: "fact",
      }),
    ).rejects.toMatchObject({ code: "OUTCOME_UNKNOWN" });
    const originalId = JSON.parse(storage.getItem(journalKey)!).operationId;
    const restoredService = createMockService(storage);
    const execute = vi.spyOn(restoredService, "execute");
    const getOperation = vi.spyOn(restoredService, "getOperation");
    const restored = createClient(restoredService, storage);
    expect(restored.hasPending()).toBe(true);
    const revision = restoredService.getSnapshot().revision;
    await expect(restored.recover()).resolves.toBe("succeeded");
    expect(getOperation).toHaveBeenCalledWith(originalId);
    expect(execute).not.toHaveBeenCalled();
    expect(restoredService.getSnapshot().revision).toBe(revision);
    expect(
      restoredService
        .getSnapshot()
        .workspaces.emma.context.filter((n) => n.title === "Only once"),
    ).toHaveLength(1);
    expect(storage.getItem(journalKey)).toBeNull();
    await expect(restored.recover()).resolves.toBe("none");
    expect(execute).not.toHaveBeenCalled();
  });

  it("blocks a new operation while a previous draft save is unresolved", async () => {
    const storage = memoryStorage();
    const service = createMockService(storage);
    const execute = vi.spyOn(service, "execute");
    const client = createClient(service, storage);
    setDemoFault("lost_response");
    await expect(client.execute("emma", draft)).rejects.toMatchObject({
      code: "OUTCOME_UNKNOWN",
    });
    const request = storage.getItem(journalKey);
    await expect(
      client.execute("john", { type: "createQuestDraft" }),
    ).rejects.toMatchObject({ code: "PENDING_OPERATION" });
    expect(storage.getItem(journalKey)).toBe(request);
    expect(execute).toHaveBeenCalledTimes(1);
    await client.recover();
    await client.execute("john", { type: "createQuestDraft" });
    expect(client.hasPending()).toBe(false);
  });

  it("does not turn a missing receipt or failed lookup into success or execute a retry", async () => {
    const storage = memoryStorage();
    const request: Request = {
      operationId: "uncertain",
      role: "emma",
      command: draft,
    };
    storage.setItem(journalKey, JSON.stringify(request));
    const service = createMockService();
    const execute = vi.spyOn(service, "execute");
    const query = vi.spyOn(service, "getOperation");
    const client = createClient(service, storage);
    await expect(client.recover()).resolves.toBe("unknown");
    expect(client.hasPending()).toBe(true);
    query.mockRejectedValueOnce(new Error("Network offline"));
    await expect(client.recover()).rejects.toThrow("Network offline");
    expect(client.hasPending()).toBe(true);
    expect(execute).not.toHaveBeenCalled();
    expect(JSON.parse(storage.getItem(journalKey)!).operationId).toBe(
      "uncertain",
    );
  });

  it("removes a confirmed failure journal and leaves business data intact", async () => {
    const storage = memoryStorage();
    const service = createMockService(storage);
    const client = createClient(service, storage);
    setDemoFault("failure");
    await expect(client.execute("emma", draft)).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
    });
    expect(client.hasPending()).toBe(false);
    expect(
      service.getSnapshot().workspaces.emma.acquisition.drafts.goal,
    ).toBeUndefined();
    await client.execute("emma", draft);
    expect(service.getSnapshot().workspaces.emma.acquisition.drafts.goal).toBe(
      draft.value,
    );
  });

  it("serializes mutations at entry, retaining busy until the original request settles", async () => {
    const storage = memoryStorage();
    const real = createMockService();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const execute = vi.fn(async (request: Request) => {
      await gate;
      return real.execute(request);
    });
    const service: ProductService = { ...real, execute };
    const client = createClient(service, storage);
    const first = client.execute("emma", draft);
    expect(client.status().busy).toBe(true);
    await expect(
      client.execute("john", { type: "createQuestDraft" }),
    ).rejects.toMatchObject({ code: "CLIENT_BUSY" });
    await expect(client.recover()).rejects.toMatchObject({
      code: "CLIENT_BUSY",
    });
    expect(client.status().busy).toBe(true);
    expect(execute).toHaveBeenCalledTimes(1);
    release();
    await first;
    expect(client.status()).toEqual({ busy: false, pending: false, error: "" });
  });
});

describe("storage failure boundaries", () => {
  it("retains corrupt operation records and blocks sends rather than treating them as no pending operation", async () => {
    for (const raw of ["{broken", "{}", "null", "[]", ""]) {
      const storage = memoryStorage();
      storage.setItem(journalKey, raw);
      const service = createMockService();
      const execute = vi.spyOn(service, "execute");
      const client = createClient(service, storage);
      expect(client.status().error).not.toBe("");
      expect(client.hasPending()).toBe(true);
      await expect(client.execute("emma", draft)).rejects.toMatchObject({
        code: "JOURNAL_INVALID",
      });
      await expect(client.recover()).rejects.toMatchObject({
        code: "JOURNAL_INVALID",
      });
      expect(storage.getItem(journalKey)).toBe(raw);
      expect(execute).not.toHaveBeenCalled();
    }
  });

  it("exposes read failure without writes and can recover after storage access returns", async () => {
    const backing = memoryStorage();
    let unavailable = true;
    const storage: Journal = {
      ...backing,
      getItem: (key) => {
        if (unavailable) throw Error("Denied");
        return backing.getItem(key);
      },
    };
    const service = createMockService();
    const execute = vi.spyOn(service, "execute");
    const client = createClient(service, storage);
    expect(client.status()).toMatchObject({ pending: true, busy: false });
    await expect(client.execute("emma", draft)).rejects.toMatchObject({
      code: "JOURNAL_READ_FAILED",
    });
    expect(backing.data.size).toBe(0);
    expect(execute).not.toHaveBeenCalled();
    unavailable = false;
    expect(client.status()).toEqual({ pending: false, busy: false, error: "" });
    await client.execute("emma", draft);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("never sends a mutation if its durable journal write fails or is ignored", async () => {
    for (const throwOnWrite of [true, false]) {
      const backing = memoryStorage();
      const storage: Journal = {
        ...backing,
        setItem: () => {
          if (throwOnWrite) throw Error("Quota");
        },
      };
      const service = createMockService();
      const execute = vi.spyOn(service, "execute");
      const client = createClient(service, storage);
      await expect(client.execute("emma", draft)).rejects.toMatchObject({
        code: "JOURNAL_WRITE_FAILED",
      });
      expect(execute).not.toHaveBeenCalled();
      expect(
        service.getSnapshot().workspaces.emma.acquisition.drafts.goal,
      ).toBeUndefined();
      expect(client.status().busy).toBe(false);
    }
  });

  it("preserves the original identity when clearing a successful operation fails", async () => {
    const backing = memoryStorage();
    let denyClear = true;
    const storage: Journal = {
      ...backing,
      removeItem: (key) => {
        if (denyClear) throw Error("Denied");
        backing.removeItem(key);
      },
    };
    const service = createMockService(backing);
    const execute = vi.spyOn(service, "execute");
    const client = createClient(service, storage);
    await expect(client.execute("emma", draft)).rejects.toMatchObject({
      code: "JOURNAL_CLEAR_FAILED",
    });
    const oldId = JSON.parse(backing.getItem(journalKey)!).operationId;
    expect(client.hasPending()).toBe(true);
    const revision = service.getSnapshot().revision;
    const restored = createClient(service, storage);
    await expect(restored.execute("emma", draft)).rejects.toMatchObject({
      code: "PENDING_OPERATION",
    });
    denyClear = false;
    await expect(restored.recover()).resolves.toBe("succeeded");
    expect((await service.getOperation(oldId))?.state).toBe("succeeded");
    expect(service.getSnapshot().revision).toBe(revision);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("does not report success when business persistence fails after journal creation", async () => {
    const storage = memoryStorage();
    const serviceStorage = {
      getItem: storage.getItem,
      setItem: () => {
        throw Error("Quota");
      },
    };
    const service = createMockService(serviceStorage);
    const before = service.getSnapshot();
    const client = createClient(service, storage);
    await expect(client.execute("emma", draft)).rejects.toMatchObject({
      code: "STORAGE_FAILED",
    });
    expect(service.getSnapshot()).toBe(before);
    expect(client.hasPending()).toBe(false);
  });
});
