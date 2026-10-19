import { EmmaEntry } from './components/EmmaEntry';
import { JohnNavigationLinks } from './components/JohnNavigationLinks';
import './john-navigation-stage.css';
import { commitEmmaEntrance } from './components/emma-entry-transition';
import { EmmaMobileOnboarding } from './components/EmmaMobileOnboarding';
import { enterpriseScope } from "./domain/profile";
import { resetDemo, resetScope } from "./domain/reset-demo";
import { fixtureViewEnabled, fixtureViewVersion } from "./domain/view-state";
import { onboardingComplete } from "./domain/development-report";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import "./components/emma-menu.css";
import "./operation-notice.css";
import brandLogo from "./assets/darkhorse-technology-logo.png";
import {
  Navigate,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router";
import {
  ArrowRight,
  Menu,
  PanelLeftClose,
  MessageSquare,
  Map,
  Layers,
  BookOpen,
  LayoutDashboard,
  LogOut,
  Settings2,
  X,
} from "lucide-react";
import { ProductProvider, useProduct } from "./product";
import { Badge, Button, Dialog, Empty } from "./components/ui";
import Onboarding from "./pages/Onboarding";
import Workbench from "./pages/Workbench";
import PersonalPath from "./pages/PersonalPath";
import Profile, { PersonalProfile } from "./pages/Profile";
import { ExternalMaterials } from "./components/ExternalMaterials";
import { Blueprint } from "./pages/Blueprint";
import Quests from "./pages/Quests";
import type { Role } from "./domain/types";
function Memories() {
  const { workspace, run, busy } = useProduct();
  const [edit, setEdit] = useState<{ id?: string; text: string } | null>(null);
  return (
    <div className="memory-list">
      {workspace.memories.map((m) => (
        <article className="memory-item" key={m.id}>
          <Badge tone={m.status === "confirmed" ? "success" : "pending"}>
            {m.status === "confirmed"
              ? "已确认"
              : m.status === "stale"
                ? "待复核"
                : "待确认"}
          </Badge>
          <p>{m.text}</p>
          <div className="row">
            <Button
              variant="quiet"
              onClick={() => setEdit({ id: m.id, text: m.text })}
            >
              修改
            </Button>
            {m.status === "candidate" && (
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() =>
                  run({
                    type: "saveMemory",
                    id: m.id,
                    text: m.text,
                    status: "confirmed",
                    sourceIds: m.sourceIds,
                  })
                }
              >
                确认
              </Button>
            )}
          </div>
        </article>
      ))}
      {!workspace.memories.length && <Empty>还没有记忆</Empty>}
      <Button variant="secondary" onClick={() => setEdit({ text: "" })}>
        添加记忆
      </Button>
      {edit && (
        <form
          className="stack memory-editor"
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              await run({
                type: "saveMemory",
                id: edit.id,
                text: edit.text,
                status: "candidate",
              })
            )
              setEdit(null);
          }}
        >
          <label className="field">
            内容
            <textarea
              autoFocus
              value={edit.text}
              onChange={(e) => setEdit({ ...edit, text: e.target.value })}
            />
          </label>
          <div className="row">
            <Button disabled={!edit.text.trim() || busy}>保存</Button>
            <Button type="button" variant="quiet" onClick={() => setEdit(null)}>
              取消
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
function Entry() {
  const { role, workspace } = useProduct();
  const nav = useNavigate();
  return (
    <section className="entry">
      <span className="eyebrow">{role === "emma" ? "EMMA" : "JOHN"}</span>
      <h1>
        {role === "emma" ? "整理经历，想清楚下一步" : "整理项目目标和计划"}
      </h1>
      <div className="entry-orbit" aria-hidden="true">
        <div />
        <div />
        <div />
      </div>
      <Button
        onClick={() =>
          nav(
            onboardingComplete(workspace)
              ? role === "emma"
                ? "/emma/result"
                : "/john/workbench"
              : `/${role}/onboarding`,
          )
        }
      >
        {onboardingComplete(workspace)
          ? "继续工作"
          : Object.keys(workspace.acquisition.answers).length
            ? "继续整理"
            : "开始"}
        <ArrowRight size={18} />
      </Button>
    </section>
  );
}
function Shell() {
  const {
    role,
    workspace,
    snapshot,
    error,
    clearError,
    notice = "",
    clearNotice = () => {},
    pending,
    recover,
    busy,
    setFault,
  } = useProduct();
  const navigate = useNavigate();
  const location = useLocation();
  useLayoutEffect(() => { commitEmmaEntrance(location.pathname); }, [location.pathname]);
  const [menu, setMenu] = useState(false);
  const avatarRef = useRef<HTMLButtonElement>(null);
  const menuContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu || role !== "emma") return;
    menuContainerRef.current?.querySelector<HTMLButtonElement>("nav button")?.focus();
    const dismissOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !menuContainerRef.current?.contains(event.target)) setMenu(false);
    };
    const dismissEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setMenu(false);
      avatarRef.current?.focus();
    };
    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("keydown", dismissEscape);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("keydown", dismissEscape);
    };
  }, [menu, role]);
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  useEffect(() => { setMobileNav(false); setMenu(false); }, [location.pathname]);
  const openHistory = () => {
    setMenu(false); setMobileNav(false);
    if (location.pathname !== home) navigate(home + "?conversations=1");
    else window.dispatchEvent(new Event("dhai-open-conversations"));
  };
  const [modal, setModal] = useState<"memory" | "demo" | "materials" | null>(
    null,
  );
  const [resetConfirm, setResetConfirm] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetting, setResetting] = useState(false);
  const home = role === "emma" ? "/emma/result" : "/john/workbench";
  const isOnboard = /^\/(emma|john)\/onboarding\/?$/.test(location.pathname);
  const fixture=fixtureViewEnabled();const fixtureVersion=fixtureViewVersion();
  useEffect(()=>{if(fixture && new URLSearchParams(location.search).get("fixture")!==fixtureVersion){const params=new URLSearchParams(location.search);params.set("fixture",fixtureVersion!);navigate({pathname:location.pathname,search:params.toString(),hash:location.hash},{replace:true,state:location.state});}},[fixture,fixtureVersion,location.pathname,location.search]);
  const materials = snapshot.attempts
    .filter(
      (a) =>
        a.participant === role ||
        (role === "john" &&
          snapshot.quests.find((q) => q.id === a.questId)?.publisher ===
            "john"),
    )
    .flatMap((a) =>
      role === "john"
        ? snapshot.submissions
            .filter((s) => s.attemptId === a.id)
            .flatMap((s) => s.materials)
        : a.materials,
    );
  const uniqueMaterials = materials.filter(
    (m, i, a) => a.findIndex((x) => x.id === m.id) === i,
  );
  if (role === 'emma' && /^\/emma\/?$/.test(location.pathname)) return <EmmaEntry />;
  return (
    <div className="product-shell" data-role={role} data-surface={isOnboard ? "onboarding" : "workspace"} data-nav-collapsed={!isOnboard && navCollapsed}>
      <header className="app-header">
        <NavLink className="brand" to={`/${role}`} end={role === "john"} aria-label="DHAI 首页">
          <span className="brand-mark" aria-hidden="true"><img src={brandLogo} alt="" /></span>
          <span>DHAI</span>
        </NavLink>
        {role === "john" && !isOnboard && <>
          <button className="john-nav-toggle" aria-label={navCollapsed ? "展开导航" : "收起导航"} aria-expanded={!navCollapsed} onClick={() => setNavCollapsed(!navCollapsed)}>{navCollapsed ? <Menu size={20}/> : <PanelLeftClose size={20}/>}</button>
          <button className="john-mobile-toggle" aria-label="打开导航" aria-expanded={mobileNav} onClick={() => setMobileNav(true)}><Menu size={21}/></button>
          <nav className="main-nav john-navigation" aria-label="功能导航">
            <JohnNavigationLinks icons />
            <div id="john-conversation-slot" />
            <button className="john-history-link" onClick={openHistory} title="历史会话"><MessageSquare size={19}/><span>历史会话</span></button>
          </nav>
        </>}
        {role === "john" && <div className={`shell-object${isOnboard ? " john-acquisition-context" : ""}`} title={enterpriseScope(workspace)}>{isOnboard ? <><span className="john-acquisition-stage" aria-current="step">需求采集</span><span className="john-acquisition-scope"> · {enterpriseScope(workspace)}</span></> : enterpriseScope(workspace)}</div>}
        <div className="header-right">
          <div className="avatar-container" ref={menuContainerRef}>
            <button
              ref={avatarRef}
              className="avatar"
              aria-label="个人菜单"
              aria-expanded={menu}
              aria-controls={menu ? "personal-navigation" : undefined}
              onClick={() => setMenu(!menu)}
            >
              <span>{role === "emma" ? "L" : "J"}</span>
              <span className="avatar-accent" aria-hidden="true" />
            </button>
            {menu && (
              role === "emma" ? <nav className="avatar-menu emma-personal-menu" id="personal-navigation" aria-label="个人导航">
                <section aria-labelledby="emma-menu-work">
                  <h2 id="emma-menu-work">工作与探索</h2>
                  <Button variant="quiet" onClick={() => {navigate(home);setMenu(false);}}><MessageSquare size={19} aria-hidden="true"/>工作台</Button>
                  <Button variant="quiet" onClick={() => {navigate("/emma/path");setMenu(false);}}><Map size={19} aria-hidden="true"/>我的路径</Button>
                  <Button variant="quiet" onClick={() => {navigate("/emma/quest");setMenu(false);}}><Layers size={19} aria-hidden="true"/>Quest</Button>
                  <Button variant="quiet" onClick={openHistory}><MessageSquare size={19} aria-hidden="true"/>历史会话</Button>
                </section>
                <section aria-labelledby="emma-menu-profile">
                  <h2 id="emma-menu-profile">个人</h2>
                  <Button variant="quiet" onClick={() => {navigate(onboardingComplete(workspace) ? "/emma/profile" : "/emma/onboarding");setMenu(false);}}><BookOpen size={19} aria-hidden="true"/>个人画像</Button>
                </section>
                <details className="emma-menu-secondary">
                  <summary>资料与设置</summary>
                  <Button variant="quiet" onClick={() => {setModal("memory");setMenu(false);}}><BookOpen size={19} aria-hidden="true"/>个人记忆</Button>
                  <Button variant="quiet" onClick={() => {navigate("/emma/onboarding?canvas=full");setMenu(false);}}><LayoutDashboard size={19} aria-hidden="true"/>资料画板</Button>
                  <Button variant="quiet" onClick={() => {setModal("materials");setMenu(false);}}><Layers size={19} aria-hidden="true"/>材料</Button>
                  <Button variant="quiet" onClick={() => {setResetConfirm(false);setResetError("");setModal("demo");setMenu(false);}}><Settings2 size={19} aria-hidden="true"/>设置</Button>
                </details>
              </nav> :               <div className="avatar-menu" id="personal-navigation">

                <Button
                  variant="quiet"
                  onClick={() => {
                    navigate(onboardingComplete(workspace) ? `/${role}/profile` : `/${role}/onboarding`);
                    setMenu(false);
                  }}
                >
                  <BookOpen size={17} />
                  企业概览
                </Button>
                <Button
                  variant="quiet"
                  onClick={() => {
                    setModal("memory");
                    setMenu(false);
                  }}
                >
                  <BookOpen size={17} />
                  企业记忆
                </Button>
                <Button
                  variant="quiet"
                  onClick={() => {
                    navigate(`/${role}/onboarding?canvas=full`);
                    setMenu(false);
                  }}
                >
                  <LayoutDashboard size={17} />
                  资料画板
                </Button>
                <Button
                  variant="quiet"
                  onClick={() => {
                    setModal("materials");
                    setMenu(false);
                  }}
                >
                  材料
                </Button>
                <Button
                  variant="quiet"
                  onClick={() => {
                    setResetConfirm(false);
                    setResetError("");
                    setModal("demo");
                    setMenu(false);
                  }}
                >
                  <Settings2 size={17} />
                  设置
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>
      {role === "john" && !isOnboard && mobileNav && <Dialog title="DHAI" onClose={() => setMobileNav(false)}>
        <nav className="john-mobile-links" aria-label="功能导航">
          <JohnNavigationLinks />
          <button onClick={openHistory}>历史会话</button>
        </nav>
      </Dialog>}
      {(error || pending) && (
        <div className="operation-banner" role="alert">
          <span>{pending ? "还不能确定上次操作是否成功，请先查询结果。" : error}</span>
          {pending ? (
            <Button variant="secondary" disabled={busy} onClick={recover}>
              查询结果
            </Button>
          ) : (
            <Button variant="quiet" aria-label="关闭错误" onClick={clearError}>
              <X size={18} />
            </Button>
          )}
        </div>
      )}
      {notice && !error && !pending && (
        <div className="operation-banner operation-notice" role="status">
          <span>{notice}</span>
          <Button variant="quiet" aria-label="关闭提示" onClick={clearNotice}>
            <X size={18} />
          </Button>
        </div>
      )}
      <main className={isOnboard ? "onboarding-main" : ""}>
        <Routes>
          <Route path={`/${role}`} element={<Entry />} />
          <Route path={`/${role}/onboarding`} element={role === 'emma' ? <EmmaMobileOnboarding><Onboarding /></EmmaMobileOnboarding> : <Onboarding />} />
          <Route
            path="/emma/result"
            element={
              onboardingComplete(workspace) ? (
                <Workbench />
              ) : (
                <Navigate to="/emma/onboarding" replace />
              )
            }
          />
          <Route
            path="/emma/path"
            element={
              onboardingComplete(workspace) ? (
                <PersonalPath />
              ) : (
                <Navigate to="/emma/onboarding" replace />
              )
            }
          />
          <Route
            path="/john/workbench"
            element={
              onboardingComplete(workspace) ? (
                <Workbench />
              ) : (
                <Navigate to="/john/onboarding" replace />
              )
            }
          />
          <Route path="/john/personal-profile" element={role === "john" ? <ProductProvider role="emma"><PersonalProfile enterpriseView /></ProductProvider> : <Navigate to="/emma/profile" replace />} />
          <Route path={`/${role}/profile`} element={onboardingComplete(workspace) ? <Profile /> : <Navigate to={`/${role}/onboarding`} replace />} />
          <Route
            path="/john/report"
            element={
              onboardingComplete(workspace) ? (
                <Blueprint />
              ) : (
                <Navigate to="/john/onboarding" replace />
              )
            }
          />
          <Route path={`/${role}/quest`} element={<Quests />} />
          <Route path="*" element={<Navigate to={`/${role}`} replace />} />
        </Routes>
      </main>
      {modal && (
        <Dialog
          returnFocus={avatarRef.current}
          title={
            modal === "memory"
              ? (role === "emma" ? "个人记忆" : "企业记忆")
              : modal === "materials"
                ? "材料"
                : "设置"
          }
          onClose={() => setModal(null)}
        >
          {modal === "memory" ? (
            <Memories />
          ) : modal === "materials" ? (
            <div className="stack">
              <ExternalMaterials owner={role === "emma" ? "personal" : "business"} />
              <h3>已提交附件</h3>
              {uniqueMaterials.length ? (
                uniqueMaterials.map((m) => (
                  <a key={m.id} download={m.name} href={m.dataUrl}>
                    {m.name}
                  </a>
                ))
              ) : (
                <Empty>还没有材料</Empty>
              )}
            </div>
          ) : (
            <div className="stack settings-material-pilot">
              <Badge>
                {snapshot.runtimeProfile === "demo_mock"
                  ? "本机保存"
                  : "真实服务尚未接入"}
              </Badge>
              <div className="row">
                <Button
                  variant={role === "emma" ? "primary" : "secondary"}
                  disabled={pending}
                  onClick={() => {
                    setModal(null);
                    navigate("/emma");
                  }}
                >
                  Emma
                </Button>
                <Button
                  variant={role === "john" ? "primary" : "secondary"}
                  disabled={pending}
                  onClick={() => {
                    setModal(null);
                    navigate("/john");
                  }}
                >
                  John
                </Button>
              </div>
              <a href="/mvp-ui/v2/john/onboarding?fixture=upwork-v1">查看客户报表案例</a>
              <a href="/mvp-ui/v2/emma/result?fixture=v6&overview=1&reopen=1">查看发展分析</a>
              <label className="field">
                下一次保存（本地演练）
                <select
                  defaultValue="none"
                  onChange={(e) =>
                    setFault(
                      e.target.value as "none" | "failure" | "lost_response",
                    )
                  }
                >
                  <option value="none">正常保存</option>
                  <option value="failure">模拟保存失败</option>
                  <option value="lost_response">模拟未收到保存结果</option>
                </select>
              </label>
              <p className="muted">
                资料与任务记录保存在此浏览器。
              </p>
              {snapshot.runtimeProfile === "demo_mock" && (resetConfirm ? <section className="stack" aria-label="确认重置资料">
                <h3>重置当前资料？</h3><p>{resetScope}</p>
                {resetError && <p role="alert">{resetError}</p>}
                <div className="row">
                  <Button variant="secondary" disabled={resetting || busy} onClick={() => {setResetConfirm(false); setResetError("");}}>取消</Button>
                  <Button disabled={resetting || busy} onClick={() => {
                    setResetting(true);
                    try {const target = resetDemo(window.localStorage, role, fixtureVersion); window.location.replace(target);}
                    catch {setResetError("重置未完成，请保留当前页面并重试。没有跳转到新会话。"); setResetting(false);}
                  }}>确认重置</Button>
                </div>
              </section> : <Button variant="secondary" disabled={busy} onClick={() => setResetConfirm(true)}>重置两角色本机资料</Button>)}
              <a href="/mvp-ui/motion/">查看已确认的动效</a>
              <Button
                variant="quiet"
                onClick={() => {
                  setModal(null);
                  navigate(`/${role}`);
                }}
              >
                <LogOut size={16} />
                回到入口
              </Button>
            </div>
          )}
        </Dialog>
      )}
    </div>
  );
}
export default function App() {
  const location = useLocation();
  const role: Role = location.pathname.startsWith("/john") ? "john" : "emma";
  return (
    <ProductProvider key={role} role={role}>
      <Shell />
    </ProductProvider>
  );
}
