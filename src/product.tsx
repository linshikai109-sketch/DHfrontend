import { retainRuntimeSearch } from "./domain/runtime-routing";
import { createHttpTransport } from "./domain/http-transport";
import { watchRestoredPage } from "./domain/restored-page";
import { seedSnapshot } from "./domain/fixtures";
import { upworkFixture } from "./domain/upwork-fixture";
import { uiError } from "./domain/ui-copy";
import { reportV6Fixture } from "./domain/report-v6-fixture";
import { fixtureStorage } from "./domain/report-v5-fixture";
import { setFixtureViewNamespace } from "./domain/view-state";
import {
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type {
  Command,
  ProductService,
  Role,
  Snapshot,
  Workspace,
} from "./domain/types";
import {
  createMockService,
  createConnectedService,
  setDemoFault,
} from "./domain/service";
import { createClient } from "./domain/client";
import {Context} from "./context";

interface Runtime {
  refresh?: () => Promise<void>;
  service: ProductService;
  client: ReturnType<typeof createClient>;
}
let runtime: Runtime | undefined;
function initialize(): { value?: Runtime; error: string } {
  try {
    if (runtime) {
      const current = runtime.client.status();
      if (current.error) throw new Error(current.error);
      return { value: runtime, error: "" };
    }
    // Accessing localStorage itself can throw under browser privacy restrictions.
    const runtimeParams = new URLSearchParams(retainRuntimeSearch(window.location.search, ""));
    const fixtureVersion=runtimeParams.get("fixture");
    const isFixture=(fixtureVersion==="fresh" || fixtureVersion==="v5" || fixtureVersion==="v6" || fixtureVersion==="upwork-v1") && runtimeParams.get("mode")!=="connected";
    setFixtureViewNamespace(isFixture,fixtureVersion==="fresh"?"fresh":fixtureVersion==="upwork-v1"?"upwork-v1":fixtureVersion==="v6"?"v6":"v5");
    const storage = isFixture?fixtureStorage(window.localStorage,fixtureVersion==="fresh"?"fresh":fixtureVersion==="upwork-v1"?"upwork-v1":fixtureVersion==="v6"?"v6":"v5",fixtureVersion==="fresh"?seedSnapshot:fixtureVersion==="upwork-v1"?upworkFixture:fixtureVersion==="v6"?reportV6Fixture:undefined):window.localStorage;
    const http = runtimeParams.get("mode") === "connected" && import.meta.env.VITE_ENABLE_LOCAL_HTTP === "true"
      ? createHttpTransport({baseUrl: import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8933/api/"}) : undefined;
    const service =
      runtimeParams.get("mode") === "connected"
        ? createConnectedService(http)
        : createMockService(storage);
    const client = createClient(service, storage);
    const current = client.status();
    if (current.error) throw new Error(current.error);
    runtime = { service, client, refresh: http?.refresh };
    return { value: runtime, error: "" };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "无法读取本机数据。",
    };
  }
}


export function ProductProvider({
  role,
  children,
}: {
  role: Role;
  children: ReactNode;
}) {
  const [boot, setBoot] = useState(initialize);
  useEffect(() => watchRestoredPage(window, () => window.location.reload()), []);
  if (!boot.value)
    return (
      <main
        className="page-heading"
        style={{ maxWidth: 620, margin: "12vh auto", padding: 24 }}
      >
        <section className="card" role="alert" style={{ padding: 28 }}>
          <h1>暂时无法打开工作区</h1>
          <p>{uiError(boot.error)}</p>
          <p className="muted">已有数据保留，尚未创建新会话或覆盖原记录。</p>
          <button
            className="button primary"
            onClick={() => setBoot(initialize())}
          >
            重试读取
          </button>
        </section>
      </main>
    );
  if (boot.value.refresh) return <ConnectedProvider role={role} runtime={boot.value}>{children}</ConnectedProvider>;
  return <ReadyProvider role={role} active={boot.value}>{children}</ReadyProvider>;
}

function ConnectedProvider({
  role,
  children,
  runtime: active,
}: {
  role: Role;
  children: ReactNode;
  runtime: Runtime;
}) {
  const { service, client } = active;
  const [loaded, setLoaded] = useState(!active.refresh);
  const [loadError, setLoadError] = useState("");
  const reload = async () => {
    try { setLoadError(""); await active.refresh?.(); setLoaded(true); }
    catch (e) { setLoadError((e as Error).message); }
  };
  useEffect(() => {
    if (!active.refresh) return;
    void reload();
    const online = () => { void reload(); };
    const offline = () => setLoadError("连接已断开，请恢复连接后重试读取或查询原操作。");
    window.addEventListener("online",online); window.addEventListener("offline",offline);
    return () => {window.removeEventListener("online",online);window.removeEventListener("offline",offline);};
  },[active]);
  if (!loaded) return <main className="page-heading" aria-busy={!loadError}><h1>{loadError ? "暂时无法打开工作区" : "正在读取工作区"}</h1><p role="status">{loadError}</p>{loadError && <button className="button primary" onClick={() => void reload()}>重试读取</button>}</main>;
  return <ReadyProvider role={role} active={active} connectionError={loadError} reload={reload}>{children}</ReadyProvider>;
}
function ReadyProvider({role,active,children,connectionError,reload}: {role:Role;active:Runtime;children:ReactNode;connectionError?:string;reload?:()=>Promise<void>}) {
  const {service,client}=active;
  const snapshot = useSyncExternalStore(service.subscribe, service.getSnapshot);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(() => client.hasPending());
  const [notice, setNotice] = useState("");
  const inFlight = useRef(false);
  const duplicateAttempt = useRef(false);

  function enter() {
    if (inFlight.current || client.status().busy) {
      duplicateAttempt.current = true;
      setError("当前操作正在处理中，请稍候。");
      return false;
    }
    inFlight.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    return true;
  }
  function leave(succeeded: boolean) {
    const current = client.status();
    setPending(current.pending);
    if (current.error) setError(uiError(current.error));
    else if (succeeded && duplicateAttempt.current && !current.pending) {
      setError("");
      setNotice("上次操作已完成，没有重复执行。");
    }
    duplicateAttempt.current = false;
    inFlight.current = false;
    setBusy(false);
  }
  async function run(command: Command) {
    if (!enter()) return null;
    let succeeded = false;
    try {
      const result = await client.execute(role, command);
      succeeded = true;
      return result;
    } catch (e) {
      setError(uiError(e instanceof Error ? e.message : "操作未完成"));
      return null;
    } finally {
      leave(succeeded);
    }
  }
  async function retryPending() {
    if (!enter()) return;
    let succeeded = false;
    try {
      const result = await client.retryPending();
      succeeded = result === "succeeded";
      if (result === "failed") setError("上次操作没有成功。请查看错误提示，修改后再试。");
      else if (succeeded) setNotice("上次操作已完成，没有重复执行。");
    }
    catch (e) { setError(uiError((e as Error).message)); }
    finally { leave(succeeded); }
  }
  async function recover() {
    if (!enter()) return;
    let succeeded = false;
    try {
      const result = await client.recover();
      succeeded = result === "succeeded";
      setError(
        result === "failed"
          ? "上次操作没有成功。请查看错误提示，修改后再试。"
          : result === "unknown"
            ? "还不能确定上次操作是否成功，请稍后再查询结果。"
            : "",
      );
    } catch (e) {
      setError(uiError(e instanceof Error ? e.message : "查询失败"));
    } finally {
      leave(succeeded);
    }
  }
  return (
    <Context.Provider
      value={{
        snapshot,
        workspace: snapshot.workspaces[role],
        role,
        run,
        busy,
        error,
        pending,
        notice,
        clearNotice: () => setNotice(""),
        clearError: () => setError(""),
        recover,
        setFault: setDemoFault,
      }}
    >
      {pending && service.profile === "connected" && <div role="status">上次操作结果待确认。<button disabled={busy} onClick={() => void retryPending()}>重试原操作</button></div>}
      {connectionError && <div role="alert">{connectionError}<button onClick={() => void reload?.()}>重试读取</button></div>}
      {children}
    </Context.Provider>
  );
}
export function useProduct() {
  const value = useContext(Context);
  if (!value) throw new Error("ProductProvider is required");
  return value;
}
