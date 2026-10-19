import { useEffect, useRef, useState, type PointerEvent } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronDown,
  Maximize2,
  Plus,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { useProduct } from "../product";
import type { ContextNode } from "../domain/types";
import { ExternalMaterialsCanvas, useExternalMaterials } from "./ExternalMaterials";
import "./onboarding-materials-v12.css";
import { Badge, Button, Dialog, Empty } from "./ui";
function EditableContextCanvas({
  sheet = "half",
  setSheet,
}: {
  sheet?: "closed" | "half" | "full";
  setSheet?: (value: "closed" | "half" | "full") => void;
}) {
  const { workspace, role, run, busy, pending } = useProduct();
  const external = useExternalMaterials();
  const materialCount = external.materials.filter(m => role === "john" || m.owner === "personal").length;
  const nodes = workspace.context.filter((n) => !n.deleted);
  const liveIds = new Set(nodes.map((n) => n.id));
  const edges = workspace.edges.filter(
    (e) => liveIds.has(e.from) && liveIds.has(e.to),
  );
  const [arranging, setArranging] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [edit, setEdit] = useState<ContextNode | null>(null);
  const [newKind, setNewKind] = useState<ContextNode["kind"]>("fact");
  const [newTitle, setNewTitle] = useState<string | null>(null);
  const [edgeTarget, setEdgeTarget] = useState("");
  const [relation, setRelation] = useState("相关");
  const [last, setLast] = useState<{
    id: string;
    patch: Partial<ContextNode>;
  } | null>(null);
  const [transform, setTransform] = useState<"merge" | "split" | null>(null);
  const [transformText, setTransformText] = useState("");
  const [mergeTarget, setMergeTarget] = useState("");
  const gripStart = useRef<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(
    null,
  );
  const dragStart = useRef<{
    id: string;
    px: number;
    py: number;
    x: number;
    y: number;
  } | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const n = nodes.find((n) => n.id === selected);
  const boardWidth = Math.max(820, ...nodes.map((n) => n.x + 260));
  const boardHeight = Math.max(560, ...nodes.map((n) => n.y + 160));
  useEffect(() => {
    if (sheet !== "full") return;
    const previousOverflow = document.body.style.overflow;
    if (matchMedia("(max-width: 760px)").matches)
      document.body.style.overflow = "hidden";
    opener.current = document.activeElement as HTMLElement;
    const first = panel.current?.querySelector<HTMLElement>("button");
    first?.focus();
    const listener = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector("dialog[open]")) {
        e.preventDefault();
        setSheet?.("half");
      }
      if (e.key === "Tab" && matchMedia("(max-width: 760px)").matches) {
        const items = Array.from(
          panel.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled),input,select,textarea,[tabindex="0"]',
          ) || [],
        );
        if (!items.length) return;
        if (e.shiftKey && document.activeElement === items[0]) {
          e.preventDefault();
          items.at(-1)?.focus();
        } else if (!e.shiftKey && document.activeElement === items.at(-1)) {
          e.preventDefault();
          items[0].focus();
        }
      }
    };
    document.addEventListener("keydown", listener);
    return () => {
      document.removeEventListener("keydown", listener);
      document.body.style.overflow = previousOverflow;
      opener.current?.focus();
    };
  }, [sheet, setSheet]);
  function start(e: PointerEvent<HTMLButtonElement>, node: ContextNode) {
    if (
      busy ||
      pending ||
      (!arranging && matchMedia("(max-width: 760px)").matches)
    )
      return;
    dragStart.current = {
      id: node.id,
      px: e.clientX,
      py: e.clientY,
      x: node.x,
      y: node.y,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    setSelected(node.id);
  }
  function move(e: PointerEvent<HTMLButtonElement>) {
    const s = dragStart.current;
    if (!s) return;
    setDrag({
      id: s.id,
      x: Math.max(16, s.x + (e.clientX - s.px) / zoom),
      y: Math.max(16, s.y + (e.clientY - s.py) / zoom),
    });
  }
  async function end() {
    const s = dragStart.current;
    dragStart.current = null;
    if (s && drag && Math.abs(drag.x - s.x) + Math.abs(drag.y - s.y) > 3) {
      setLast({ id: s.id, patch: { x: s.x, y: s.y } });
      await run({
        type: "editContext",
        id: s.id,
        patch: { x: Math.round(drag.x), y: Math.round(drag.y) },
      });
    }
    setDrag(null);
  }
  async function patch(node: ContextNode, p: Partial<ContextNode>) {
    const previous = Object.fromEntries(
      Object.keys(p).map((key) => [key, node[key as keyof ContextNode]]),
    );
    const result = await run({ type: "editContext", id: node.id, patch: p });
    if (result) setLast({ id: node.id, patch: previous });
    return result;
  }
  async function changeEdges(next: typeof workspace.edges) {
    if (await run({ type: "setEdges", edges: next })) setLast(null);
  }
  return (
    <>
      <div
        ref={panel}
        className={`context-panel sheet-${sheet} ${arranging ? "arranging" : ""}`}
        role={sheet === "full" ? "region" : undefined}
        aria-label="资料画板"
      >
        <div
          className="sheet-grip"
          onPointerDown={(e) => {
            gripStart.current = e.clientY;
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerUp={(e) => {
            const delta = e.clientY - (gripStart.current ?? e.clientY);
            gripStart.current = null;
            if (delta < -35) setSheet?.("full");
            if (delta > 35) setSheet?.(sheet === "full" ? "half" : "closed");
          }}
        />
        <header className="canvas-heading">
          <h2>我的画板</h2>
          <div className="row">
            {sheet === "full" && (
              <Button
                variant="quiet"
                className="mobile-only"
                onClick={() => setArranging(!arranging)}
              >
                {arranging ? "完成整理" : "整理"}
              </Button>
            )}
            <Button
              variant="quiet"
              aria-label="添加节点"
              onClick={() => setNewTitle("")}
            >
              <Plus size={20} />
            </Button>
            {setSheet && (
              <>
                <Button
                  variant="quiet"
                  aria-label={sheet === "full" ? "半展开画板" : "展开画板"}
                  onClick={() => setSheet(sheet === "full" ? "half" : "full")}
                >
                  {sheet === "full" ? (
                    <ChevronDown size={20} />
                  ) : (
                    <Maximize2 size={20} />
                  )}
                </Button>
                <Button
                  variant="quiet"
                  className="mobile-only"
                  aria-label="收起画板"
                  onClick={() => setSheet("closed")}
                >
                  <X size={20} />
                </Button>
              </>
            )}
          </div>
        </header>
        <div className="canvas-viewport">
          <ExternalMaterialsCanvas />
          <div
            className="canvas-space"
            style={{ width: boardWidth * zoom, height: boardHeight * zoom }}
          >
            <div
              style={{
                width: boardWidth,
                height: boardHeight,
                transform: `scale(${zoom})`,
                transformOrigin: "0 0",
              }}
              className="canvas-world"
            >
              <svg
                width={boardWidth}
                height={boardHeight}
                aria-label="节点关系"
              >
                {edges.map((edge) => {
                  const from = nodes.find((n) => n.id === edge.from), to = nodes.find((n) => n.id === edge.to);
                  const a = from && (drag?.id === from.id ? { ...from, ...drag } : from);
                  const b = to && (drag?.id === to.id ? { ...to, ...drag } : to);
                  if (!a || !b) return null;
                  const horizontal = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y);
                  const forward = horizontal ? b.x >= a.x : b.y >= a.y;
                  const ax = a.x + (horizontal ? (forward ? 220 : 0) : 110);
                  const ay = a.y + (horizontal ? 72 : (forward ? 144 : 0));
                  const bx = b.x + (horizontal ? (forward ? 0 : 220) : 110);
                  const by = b.y + (horizontal ? 72 : (forward ? 0 : 144));
                  const bend = forward ? 40 : -40;
                  return (
                    <g key={edge.id} className={selected === edge.from || selected === edge.to ? "context-edge-active" : selected ? "context-edge-muted" : ""}>
                      <path
                        d={horizontal ? `M${ax},${ay} C${ax + bend},${ay} ${bx - bend},${by} ${bx},${by}` : `M${ax},${ay} C${ax},${ay + bend} ${bx},${by - bend} ${bx},${by}`}
                      />
                      <text x={(ax + bx) / 2} y={(ay + by) / 2 - 10} textAnchor="middle">
                        {edge.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
              {nodes.map((node) => (
                <button
                  key={node.id}
                  className={`context-node context-kind-${node.kind} ${selected === node.id ? "selected" : ""} ${node.status}`}
                  style={{
                    left: drag?.id === node.id ? drag.x : node.x,
                    top: drag?.id === node.id ? drag.y : node.y,
                  }}
                  onPointerDown={(e) => start(e, node)}
                  onPointerMove={move}
                  onPointerUp={end}
                  onPointerCancel={() => {
                    dragStart.current = null;
                    setDrag(null);
                  }}
                  onClick={() => {
                    setSelected(node.id);
                    if (
                      sheet === "half" &&
                      matchMedia("(max-width: 760px)").matches
                    )
                      setEdit({ ...node });
                  }}
                  aria-pressed={selected === node.id}
                >
                  <span className="context-node-kind">{{ fact: "材料", goal: "目标", constraint: "限制", direction: "方向", action: "行动" }[node.kind]}</span>
                  <strong>{node.title}</strong>
                  <span>
                    {node.status === "confirmed"
                      ? "已确认"
                      : node.status === "stale"
                        ? "原回答已改，请重新核对"
                        : "待确认"}
                  </span>
                </button>
              ))}
            </div>
            {!nodes.length && <div className="canvas-empty"><Empty>你填写的资料会显示在这里。</Empty></div>}
          </div>
        </div>
        {n && (
          <div className="node-tools">
            <div className="row">
              <Button
                disabled={busy || n.status === "stale" || pending}
                onClick={() => patch(n, { status: "confirmed" })}
              >
                <Check size={16} />
                确认
              </Button>
              <Button variant="secondary" onClick={() => setEdit({ ...n })}>
                修改
              </Button>
              <Button
                variant="quiet"
                aria-label="删除节点"
                onClick={() => patch(n, { deleted: true })}
              >
                <Trash2 size={18} />
              </Button>
            </div>
            <div className="row move-tools" aria-label="移动节点">
              {[
                ["左", -40, 0, ArrowLeft],
                ["上", 0, -40, ArrowUp],
                ["下", 0, 40, ArrowDown],
                ["右", 40, 0, ArrowRight],
              ].map(([label, x, y, Icon]) => {
                const I = Icon as typeof ArrowLeft;
                return (
                  <Button
                    key={String(label)}
                    variant="quiet"
                    aria-label={`向${label}移动`}
                    disabled={busy || pending}
                    onClick={() =>
                      patch(n, {
                        x: Math.max(16, n.x + Number(x)),
                        y: Math.max(16, n.y + Number(y)),
                      })
                    }
                  >
                    <I size={16} />
                  </Button>
                );
              })}
            </div>
            <details>
              <summary>关系与来源</summary>
              <div className="row">
                <Button
                  variant="quiet"
                  disabled={nodes.length < 2 || busy || pending}
                  onClick={() => {
                    setTransform("merge");
                    setTransformText(n.title);
                    setMergeTarget("");
                  }}
                >
                  合并
                </Button>
                <Button
                  variant="quiet"
                  disabled={busy || pending}
                  onClick={() => {
                    setTransform("split");
                    setTransformText(n.title + "\n");
                  }}
                >
                  拆分
                </Button>
              </div>
              <p className="muted">
                {(n.sourceIds || [n.sourceId])
                  .map(
                    (id) =>
                      workspace.acquisition.answers[id]?.value || "手动添加",
                  )
                  .join(" / ")}
              </p>
              <div className="row">
                <select
                  aria-label="连接到"
                  value={edgeTarget}
                  onChange={(e) => setEdgeTarget(e.target.value)}
                >
                  <option value="">选择节点</option>
                  {nodes
                    .filter((x) => x.id !== n.id)
                    .map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.title}
                      </option>
                    ))}
                </select>
                <select
                  aria-label="关系类型"
                  value={relation}
                  onChange={(e) => setRelation(e.target.value)}
                >
                  {["相关", "支持", "先于", "备选"].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
                <Button
                  variant="secondary"
                  disabled={!edgeTarget || busy}
                  onClick={() =>
                    changeEdges([
                      ...edges,
                      {
                        id: crypto.randomUUID(),
                        from: n.id,
                        to: edgeTarget,
                        label: relation,
                      },
                    ])
                  }
                >
                  连接
                </Button>
              </div>
              {edges
                .filter((e) => e.from === n.id || e.to === n.id)
                .map((edge) => (
                  <div className="row" key={edge.id}>
                    <span>
                      {
                        nodes.find(
                          (x) =>
                            x.id === (edge.from === n.id ? edge.to : edge.from),
                        )?.title
                      }{" "}
                      · {edge.label}
                    </span>
                    <Button
                      variant="quiet"
                      aria-label="删除关系"
                      onClick={() =>
                        changeEdges(edges.filter((x) => x.id !== edge.id))
                      }
                    >
                      <X size={16} />
                    </Button>
                  </div>
                ))}
            </details>
          </div>
        )}
        <footer className="canvas-footer">
          <label className="row">
            <span className="muted">缩放</span>
            <input
              type="range"
              aria-label="画板缩放"
              min="0.5"
              max="1.5"
              step="0.1"
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
            />
          </label>
          {last && (
            <Button
              variant="quiet"
              aria-label="撤销画板修改"
              onClick={async () => {
                if (
                  await run({
                    type: "editContext",
                    id: last.id,
                    patch: last.patch,
                  })
                )
                  setLast(null);
              }}
            >
              <Undo2 size={18} />
              撤销
            </Button>
          )}
          <Badge>{nodes.length + materialCount} 项</Badge>
        </footer>
      </div>
      {sheet === "closed" && setSheet && (
        <button className="canvas-tray" onClick={() => setSheet("half")}>
          我的画板 <Badge>{nodes.length + materialCount}</Badge>
          <ChevronDown size={18} />
        </button>
      )}
      {edit && (
        <Dialog title="修改节点" onClose={() => setEdit(null)}>
          <form
            className="stack"
            onSubmit={async (e) => {
              e.preventDefault();
              const original = workspace.context.find(
                (node) => node.id === edit.id,
              );
              if (
                original &&
                (await patch(original, {
                  title: edit.title,
                  kind: edit.kind,
                  status: "candidate",
                }))
              )
                setEdit(null);
            }}
          >
            <label className="field">
              内容
              <textarea
                autoFocus
                value={edit.title}
                onChange={(e) => setEdit({ ...edit, title: e.target.value })}
                required
              />
            </label>
            <label className="field">类型<select value={edit.kind} onChange={e => setEdit({ ...edit, kind: e.target.value as ContextNode["kind"] })}>{Object.entries({fact:"材料",goal:"目标",constraint:"限制",direction:"方向",action:"行动"}).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>
            <Button disabled={busy || !edit.title.trim()}>保存</Button>
          </form>
        </Dialog>
      )}
      {transform && n && (
        <Dialog
          title={transform === "merge" ? "合并节点" : "拆分节点"}
          onClose={() => setTransform(null)}
        >
          <form
            className="stack"
            onSubmit={async (e) => {
              e.preventDefault();
              const result = await run(
                transform === "merge"
                  ? {
                      type: "mergeContext",
                      ids: [n.id, mergeTarget],
                      title: transformText,
                    }
                  : {
                      type: "splitContext",
                      id: n.id,
                      titles: transformText
                        .split("\n")
                        .map((x) => x.trim())
                        .filter(Boolean),
                    },
              );
              if (result) {
                setTransform(null);
                setSelected(null);
                setLast(null);
              }
            }}
          >
            {transform === "merge" && (
              <label className="field">
                合并到一起
                <select
                  value={mergeTarget}
                  onChange={(e) => setMergeTarget(e.target.value)}
                  required
                >
                  <option value="">选择节点</option>
                  {nodes
                    .filter((x) => x.id !== n.id)
                    .map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.title}
                      </option>
                    ))}
                </select>
              </label>
            )}
            <label className="field">
              {transform === "merge" ? "合并后的内容" : "每行一个节点"}
              <textarea
                autoFocus
                value={transformText}
                onChange={(e) => setTransformText(e.target.value)}
                required
              />
            </label>
            <Button
              disabled={
                busy ||
                pending ||
                !transformText.trim() ||
                (transform === "merge"
                  ? !mergeTarget
                  : transformText.split("\n").filter((x) => x.trim()).length <
                    2)
              }
            >
              确认{transform === "merge" ? "合并" : "拆分"}
            </Button>
          </form>
        </Dialog>
      )}
      {newTitle !== null && (
        <Dialog title="添加节点" onClose={() => setNewTitle(null)}>
          <form
            className="stack"
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await run({ type: "addContext", title: newTitle, kind: newKind })
              ) {
                setNewTitle(null);
                setLast(null);
              }
            }}
          >
            <label className="field">
              内容
              <input
                autoFocus
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                required
              />
            </label>
            <label className="field">类型<select value={newKind} onChange={e => setNewKind(e.target.value as ContextNode["kind"])}>{Object.entries({fact:"材料",goal:"目标",constraint:"限制",direction:"方向",action:"行动"}).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>
            <Button disabled={busy || !newTitle.trim()}>添加</Button>
          </form>
        </Dialog>
      )}
    </>
  );
}

export function ContextCanvas({readOnly=false,sheet="half",setSheet}:{readOnly?:boolean;sheet?:"closed"|"half"|"full";setSheet?:(value:"closed"|"half"|"full")=>void}) {
 const {workspace}=useProduct();
 if(!readOnly)return <EditableContextCanvas sheet={sheet} setSheet={setSheet}/>;
 return <>
  <section className={`context-panel sheet-${sheet}`} aria-label="本次对话线索">
   <header className="canvas-heading"><h2>本次对话线索</h2><div className="row">
    {setSheet && <><Button variant="quiet" aria-label="展开或收起线索" onClick={()=>setSheet(sheet==="full"?"half":"full")}><Maximize2 size={20}/></Button><Button variant="quiet" className="mobile-only" aria-label="收起线索" onClick={()=>setSheet("closed")}><X size={20}/></Button></>}
   </div></header>
   <div className="conversation-clues"><ExternalMaterialsCanvas /><p>这里显示你提供的资料。需要修改时，请打开个人中心。</p>{workspace.context.filter(n=>!n.deleted).map(n=><article key={n.id}><p>{n.title}</p><Badge tone="pending">你提供的资料 · {n.status==="stale"?"来源已变化":"尚未向其他来源核实"}</Badge></article>)}{!workspace.context.length&&<Empty>尚未收集到信息</Empty>}</div>
  </section>
  {sheet==="closed" && setSheet && <button className="canvas-tray" onClick={()=>setSheet("half")}>本次对话线索 <Badge>{workspace.context.filter(n=>!n.deleted).length}</Badge><ChevronDown size={18}/></button>}
 </>;
}
