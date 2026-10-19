import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  Check,
  ChevronDown,
  Expand,
  MoreHorizontal,
  Plus,
  RotateCcw,
  X,
} from "lucide-react";
import { useProduct } from "../product";
import { Button, Badge, Dialog } from "../components/ui";
import { VoiceComposer } from "../components/VoiceComposer";
import { JOHN_VOICE_DEMO_TEXT } from "../domain/voice-demo";
import {
  PersonalPathCanvas,
  PathNodeCard,
  pathLanes,
  pathStages,
  pathStatuses,
  shortDate,
} from "../components/PersonalPathCanvas";
import { getPersonalPath, createPathSuggestion } from "../domain/personal-path";
import { readView, writeView } from "../domain/view-state";
import type { PersonalPath as Path, PathNode } from "../domain/types";
import "./personal-path.css";

const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
function blankNode(): PathNode {
  return {
    id: `path-${crypto.randomUUID()}`,
    title: "",
    laneId: "capability",
    stage: 0,
    status: "planned",
    outcome: "",
    criteria: "",
    dependencies: [],
  };
}
function usePathActions() {
  const product = useProduct();
  const path = getPersonalPath(product.workspace, product.snapshot);
  async function save(next: Path) {
    return !!(await product.run({
      type: "savePersonalPath",
      baseVersion: next.version,
      path: next,
    }));
  }
  return { ...product, path, save, locked: product.busy || product.pending };
}
function NodeEditor({
  node,
  path,
  onSave,
  onClose,
  busy,
}: {
  node: PathNode;
  path: Path;
  onSave: (node: PathNode) => Promise<boolean>;
  onClose: () => void;
  busy: boolean;
}) {
  const { error: saveError } = useProduct();
  const [draft, setDraft] = useState(() => copy(node));
  const [error, setError] = useState("");
  const [discard, setDiscard] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(node);
  function close() {
    if (dirty) setDiscard(true);
    else onClose();
  }
  return (
    <Dialog title={node.title ? "编辑行动" : "添加行动"} onClose={close}>
      <form
        className="path-edit-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!draft.title.trim()) {
            setError("填写行动名称");
            return;
          }
          if (await onSave({ ...draft, title: draft.title.trim() })) onClose();
        }}
      >
        <label className="field">
          行动名称
          <input
            autoFocus
            value={draft.title}
            disabled={!!draft.questId}
            maxLength={120}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />
        </label>
        <div className="path-form-pair">
          <label className="field">
            维度
            <select
              value={draft.laneId}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  laneId: e.target.value as PathNode["laneId"],
                })
              }
            >
              {pathLanes.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            阶段
            <select
              value={draft.stage}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  stage: Number(e.target.value) as PathNode["stage"],
                })
              }
            >
              {pathStages.map((s, i) => (
                <option key={s} value={i}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="field">
          期限
          <input
            type="date"
            disabled={!!draft.questId}
            value={draft.dueAt?.slice(0, 10) || ""}
            onChange={(e) =>
              setDraft({ ...draft, dueAt: e.target.value || undefined })
            }
          />
        </label>
        <label className="field">
          预期成果
          <textarea
            rows={2}
            value={draft.outcome}
            onChange={(e) => setDraft({ ...draft, outcome: e.target.value })}
          />
        </label>
        <label className="field">
          完成标准
          <textarea
            rows={2}
            value={draft.criteria}
            onChange={(e) => setDraft({ ...draft, criteria: e.target.value })}
          />
        </label>
        <fieldset className="path-dependencies">
          <legend>前置行动</legend>
          {path.nodes
            .filter((n) => n.id !== draft.id)
            .map((n) => (
              <label key={n.id}>
                <input
                  type="checkbox"
                  checked={draft.dependencies.includes(n.id)}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      dependencies: e.target.checked
                        ? [...draft.dependencies, n.id]
                        : draft.dependencies.filter((id) => id !== n.id),
                    })
                  }
                />
                <span>{n.title}</span>
              </label>
            ))}
        </fieldset>
        {(error || saveError) && (
          <p role="alert" className="inline-error">
            {error || saveError}
          </p>
        )}
        <div className="path-edit-actions">
          <Button type="button" variant="quiet" onClick={close}>
            取消
          </Button>
          <Button disabled={busy}>保存</Button>
        </div>
      </form>
      {discard && (
        <div className="path-discard" role="alert">
          <span>放弃未保存的修改？</span>
          <Button variant="quiet" onClick={() => setDiscard(false)}>
            继续编辑
          </Button>
          <Button variant="danger" onClick={onClose}>
            放弃
          </Button>
        </div>
      )}
    </Dialog>
  );
}
function GoalEditor({
  path,
  onSave,
  onClose,
  busy,
}: {
  path: Path;
  onSave: (path: Path) => Promise<boolean>;
  onClose: () => void;
  busy: boolean;
}) {
  const { error: saveError } = useProduct();
  const [draft, setDraft] = useState(() => copy(path));
  const [discard, setDiscard] = useState(false);
  function close() {
    if (JSON.stringify(draft) !== JSON.stringify(path)) setDiscard(true);
    else onClose();
  }
  return (
    <Dialog title="调整目标" onClose={close}>
      <form
        className="path-edit-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (
            draft.title.trim() &&
            (await onSave({ ...draft, title: draft.title.trim() }))
          )
            onClose();
        }}
      >
        <label className="field">
          目标
          <input
            autoFocus
            required
            maxLength={160}
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />
        </label>
        <label className="field">
          期望时间
          <input
            type="date"
            value={draft.targetDate?.slice(0, 10) || ""}
            onChange={(e) =>
              setDraft({ ...draft, targetDate: e.target.value || undefined })
            }
          />
        </label>
        {saveError && (
          <p className="inline-error" role="alert">
            {saveError}
          </p>
        )}
        <div className="path-edit-actions">
          <Button type="button" variant="quiet" onClick={close}>
            取消
          </Button>
          <Button disabled={busy || !draft.title.trim()}>保存</Button>
        </div>
      </form>
      {discard && (
        <div className="path-discard" role="alert">
          <span>放弃未保存的修改？</span>
          <Button variant="quiet" onClick={() => setDiscard(false)}>
            继续编辑
          </Button>
          <Button variant="danger" onClick={onClose}>
            放弃
          </Button>
        </div>
      )}
    </Dialog>
  );
}

export function PathPreview() {
  const { path, workspace, snapshot, save, locked } = usePathActions();
  const [edit, setEdit] = useState<{ node: PathNode; path: Path } | null>(null);
  const [goal, setGoal] = useState<Path | null>(null);
  const [refresh, setRefresh] = useState<Path | null>(null);
  const preview = path.nodes.filter((n) => n.stage === 0).slice(0, 4);
  const suggested = getPersonalPath(
    { ...workspace, personalPath: undefined },
    snapshot,
  );
  return (
    <section className="personal-path-preview" aria-label="初始路径预览">
      <div className="path-preview-heading">
        <span className="eyebrow">MY PATH</span>
        <Button variant="quiet" onClick={() => setGoal(copy(path))}>
          调整目标
        </Button>
      </div>
      <h2>{path.title}</h2>
      <div className="path-preview-line">
        <i />
        <span>现在</span>
        <ArrowRight size={15} />
        <span>下一阶段</span>
      </div>
      <div className="path-preview-nodes">
        {preview.map((node) => (
          <PathNodeCard
            key={node.id}
            node={node}
            selected={false}
            onSelect={() => setEdit({ node: copy(node), path: copy(path) })}
            mobile
          />
        ))}
      </div>
      {workspace.personalPath && suggested.title !== path.title && (
        <Button
          variant="quiet"
          onClick={() => setRefresh({ ...copy(path), title: suggested.title })}
        >
          <RotateCcw size={15} />
          按画板更新目标
        </Button>
      )}
      {edit && (
        <NodeEditor
          node={edit.node}
          path={edit.path}
          busy={locked}
          onClose={() => setEdit(null)}
          onSave={(node) =>
            save({
              ...edit.path,
              nodes: edit.path.nodes.map((n) => (n.id === node.id ? node : n)),
            })
          }
        />
      )}
      {goal && (
        <GoalEditor
          path={goal}
          onSave={save}
          busy={locked}
          onClose={() => setGoal(null)}
        />
      )}
      {refresh && (
        <Dialog title="更新目标" onClose={() => setRefresh(null)}>
          <div className="path-change">
            <span>{path.title}</span>
            <ArrowDown size={16} />
            <strong>{refresh.title}</strong>
          </div>
          <div className="path-edit-actions">
            <Button variant="quiet" onClick={() => setRefresh(null)}>
              取消
            </Button>
            <Button
              disabled={locked}
              onClick={async () => {
                if (await save(refresh)) setRefresh(null);
              }}
            >
              应用
            </Button>
          </div>
        </Dialog>
      )}
    </section>
  );
}

export default function PersonalPath() {
  const { path, workspace, snapshot, save, locked, role } = usePathActions();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const selected = path.nodes.find((n) => n.id === params.get("node"));
  const [edit, setEdit] = useState<{ node: PathNode; path: Path } | null>(null);
  const [goal, setGoal] = useState<Path | null>(null);
  const [remove, setRemove] = useState<PathNode | null>(null);
  const [more, setMore] = useState(false);
  const [discussion, setDiscussion] = useState(false);
  const [contextId, setContextId] = useState<string | undefined>();
  const [full, setFull] = useState(false);
  const [message, setMessage] = useState(() =>
    readView(snapshot.runtimeProfile, role, "path-message", ""),
  );
  const [suggestion, setSuggestion] = useState<ReturnType<
    typeof createPathSuggestion
  > | null>(null);
  const [hint, setHint] = useState("");
  const [notice, setNotice] = useState("");
  const [changed, setChanged] = useState<string[]>([]);
  const panel = useRef<HTMLElement>(null);
  const dragY = useRef<number | null>(null);
  const dragged = useRef(false);
  const lastTrigger = useRef<HTMLElement | null>(null);
  const displayPath = suggestion?.path || path;
  const panelOpen = discussion || !!selected;
  useEffect(() => {
    writeView(snapshot.runtimeProfile, role, "path-message", message);
  }, [message, role, snapshot.runtimeProfile]);
  useEffect(() => {
    if (panelOpen) panel.current?.focus();
  }, [selected?.id, discussion]);
  useEffect(() => {
    if (!changed.length) return;
    const t = setTimeout(() => setChanged([]), 1600);
    return () => clearTimeout(t);
  }, [changed]);
  function select(id: string) {
    lastTrigger.current = document.activeElement as HTMLElement;
    setDiscussion(false);
    setSuggestion(null);
    setMore(false);
    setFull(false);
    const next = new URLSearchParams(params);
    next.set("node", id);
    setParams(next);
  }
  function close() {
    setDiscussion(false);
    setSuggestion(null);
    setMore(false);
    const next = new URLSearchParams(params);
    next.delete("node");
    setParams(next);
    requestAnimationFrame(() => lastTrigger.current?.focus());
  }
  function discuss(nodeId?: string) {
    lastTrigger.current = document.activeElement as HTMLElement;
    setContextId(nodeId);
    setDiscussion(true);
    setSuggestion(null);
    setHint("");
    setFull(false);
  }
  function generate(kind: "delay" | "split") {
    if (snapshot.runtimeProfile !== "demo_mock") {
      setHint("生成服务尚未连接");
      return;
    }
    const subject =
      path.nodes.find((n) => n.id === contextId) ||
      path.nodes.find((n) => !n.questId && n.status !== "completed");
    if (!subject || subject.questId || subject.status === "completed") {
      setHint("请选择尚未完成的自主行动");
      return;
    }
    try {
      setSuggestion(createPathSuggestion(copy(path), kind, subject.id));
      setHint("");
    } catch (error) {
      setHint(error instanceof Error ? error.message : "暂时无法生成建议");
    }
  }
  async function apply() {
    if (!suggestion) return;
    const ids = suggestion.path.nodes
      .filter(
        (n) =>
          JSON.stringify(n) !==
          JSON.stringify(path.nodes.find((p) => p.id === n.id)),
      )
      .map((n) => n.id);
    if (await save(suggestion.path)) {
      setChanged(ids);
      setSuggestion(null);
      setNotice("路径已更新");
    }
  }
  async function updateStatus(node: PathNode) {
    const next = copy(path);
    next.nodes = next.nodes.map((n) =>
      n.id === node.id
        ? {
            ...n,
            status: node.status === "planned" ? "in_progress" : "completed",
          }
        : n,
    );
    if (await save(next))
      setNotice(node.status === "planned" ? "行动已开始" : "行动已完成");
  }
  function openQuest(node: PathNode, result = false) {
    if (node.questId)
      navigate(
        `/emma/quest?quest=${encodeURIComponent(node.questId)}&view=${result ? "result" : "detail"}`,
      );
  }
  const completed = path.nodes.filter((n) => n.status === "completed").length;
  const contextNode = path.nodes.find((n) => n.id === contextId);
  return (
    <div className={`personal-path-page ${panelOpen ? "has-panel" : ""}`}>
      <header className="path-page-heading">
        <div>
          <span className="eyebrow">MY PATH</span>
          <h1>我的路径</h1>
        </div>
        <Button variant="secondary" onClick={() => setGoal(copy(path))}>
          调整目标
          <ArrowUpRight size={15} />
        </Button>
      </header>
      <section className="path-goal-strip">
        <div>
          <span className="path-goal-mark">
            <CompassMark />
          </span>
          <div>
            <h2>{path.title}</h2>
            <span>
              {path.targetDate
                ? `期望时间 · ${shortDate(path.targetDate)}`
                : "现在 · 下一阶段 · 后续"}
            </span>
          </div>
        </div>
        <div className="path-completion">
          <span>
            <strong>{String(completed).padStart(2, "0")}</strong> /{" "}
            {String(path.nodes.length).padStart(2, "0")}
          </span>
          <span>行动已完成</span>
        </div>
      </section>
      <div className="path-workspace">
        <section className="path-board-area" aria-label="路径总览">
          <div className="path-board-toolbar">
            <div>
              <span className="path-live-dot" />
              成长路线
            </div>
            <div>
              <Button
                variant="quiet"
                onClick={() => setEdit({ node: blankNode(), path: copy(path) })}
              >
                <Plus size={16} />
                添加行动
              </Button>
            </div>
          </div>
          {params.get("node") && !selected && (
            <div role="status" className="path-inline-notice">
              该行动已移出路径{" "}
              <Button variant="quiet" onClick={close}>
                返回总览
              </Button>
            </div>
          )}
          <PersonalPathCanvas
            path={displayPath}
            selectedId={selected?.id}
            onSelect={select}
            changedIds={
              suggestion
                ? suggestion.path.nodes
                    .filter(
                      (n) =>
                        JSON.stringify(n) !==
                        JSON.stringify(path.nodes.find((p) => p.id === n.id)),
                    )
                    .map((n) => n.id)
                : changed
            }
          />
          <div className="path-discuss-dock">
            <button onClick={() => discuss()}>
              <span>
                <AudioLines size={20} />
              </span>
              与 Emma 讨论
              <ArrowUpRight size={15} />
            </button>
          </div>
        </section>
        {panelOpen && (
          <aside
            ref={panel}
            tabIndex={-1}
            className={`path-inspector ${full ? "full" : "half"}`}
            aria-label={discussion ? "与 Emma 讨论" : "行动详情"}
            onKeyDown={(e) => {
              if (e.key === "Escape") close();
            }}
          >
            <button
              className="path-sheet-handle"
              aria-label={full ? "半展开" : "全展开"}
              onClick={() => {
                if (!dragged.current) setFull(!full);
                dragged.current = false;
              }}
              onPointerDown={(e) => {
                dragged.current = false;
                dragY.current = e.clientY;
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerUp={(e) => {
                if (dragY.current !== null) {
                  const delta = e.clientY - dragY.current;
                  dragged.current = Math.abs(delta) > 20;
                  if (delta > 55) {
                    if (full) setFull(false);
                    else close();
                  } else if (delta < -35) setFull(true);
                }
                dragY.current = null;
              }}
            >
              <span />
            </button>
            <div className="path-inspector-head">
              <span>
                {discussion
                  ? "与 Emma 讨论"
                  : pathLanes.find((l) => l.id === selected?.laneId)?.title}
              </span>
              <div>
                <Button
                  className="path-expand"
                  variant="quiet"
                  aria-label={full ? "半展开详情" : "全展开详情"}
                  onClick={() => setFull(!full)}
                >
                  {full ? <ChevronDown size={18} /> : <Expand size={17} />}
                </Button>
                <Button variant="quiet" aria-label="关闭面板" onClick={close}>
                  <X size={19} />
                </Button>
              </div>
            </div>
            {discussion ? (
              <div className="path-conversation">
                {contextNode && (
                  <button
                    className="path-context-chip"
                    onClick={() => setContextId(undefined)}
                  >
                    {contextNode.title}
                    <X size={13} />
                  </button>
                )}
                <h2>让下一步更合适。</h2>
                <div className="path-quick-prompts">
                  <Button
                    variant="secondary"
                    disabled={locked}
                    onClick={() => generate("delay")}
                  >
                    调整时间
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={locked}
                    onClick={() => generate("split")}
                  >
                    拆分行动
                  </Button>
                </div>
                {suggestion && (
                  <section className="path-suggestion">
                    <Badge>建议</Badge>
                    <h3>{suggestion.summary}</h3>
                    <div className="path-change-list">
                      {suggestion.path.nodes
                        .filter(
                          (n) =>
                            JSON.stringify(n) !==
                            JSON.stringify(
                              path.nodes.find((p) => p.id === n.id),
                            ),
                        )
                        .map((n) => {
                          const before = path.nodes.find((p) => p.id === n.id);
                          const onlyDependencies =
                            before &&
                            before.title === n.title &&
                            before.dueAt === n.dueAt;
                          const labels = (ids: string[], nodes: PathNode[]) =>
                            ids
                              .map(
                                (id) =>
                                  nodes.find((x) => x.id === id)?.title || id,
                              )
                              .join("、") || "无";
                          return (
                            <div key={n.id}>
                              {onlyDependencies ? (
                                <>
                                  <b>{n.title}</b>
                                  <span>
                                    前置：
                                    {labels(before.dependencies, path.nodes)}
                                  </span>
                                  <ArrowDown size={14} />
                                  <strong>
                                    前置：
                                    {labels(
                                      n.dependencies,
                                      suggestion.path.nodes,
                                    )}
                                  </strong>
                                </>
                              ) : (
                                <>
                                  <span>
                                    {before?.title || "新增行动"}
                                    {before?.dueAt
                                      ? ` · ${shortDate(before.dueAt)}`
                                      : ""}
                                  </span>
                                  <ArrowDown size={14} />
                                  <strong>
                                    {n.title}
                                    {n.dueAt ? ` · ${shortDate(n.dueAt)}` : ""}
                                  </strong>
                                </>
                              )}
                            </div>
                          );
                        })}
                    </div>
                    <div className="row">
                      <Button disabled={locked} onClick={apply}>
                        应用
                      </Button>
                      <Button
                        variant="quiet"
                        onClick={() => setSuggestion(null)}
                      >
                        取消
                      </Button>
                    </div>
                  </section>
                )}
                {hint && (
                  <p className="inline-error" role="status">
                    {hint}
                  </p>
                )}
                <div className="path-conversation-input">
                  <VoiceComposer demoText={role === "john" ? JOHN_VOICE_DEMO_TEXT : undefined} variant="studio"
                    value={message}
                    onChange={setMessage}
                    disabled={locked}
                    label="说说你的想法"
                    onSubmit={() => {
                      if (/拆|步骤|细化/.test(message)) generate("split");
                      else if (/时间|延期|推迟|延后/.test(message))
                        generate("delay");
                      else setHint("原型支持「调整时间」和「拆分行动」");
                    }}
                  />
                </div>
              </div>
            ) : (
              selected && (
                <>
                  <div className="path-detail-body">
                    <div className="path-detail-title">
                      <h2>{selected.title}</h2>
                      <Button
                        variant="quiet"
                        aria-label="更多行动操作"
                        aria-expanded={more}
                        onClick={() => setMore(!more)}
                      >
                        <MoreHorizontal size={20} />
                      </Button>
                    </div>
                    {more && (
                      <div className="path-more-menu">
                        <Button
                          variant="quiet"
                          onClick={() => {
                            setMore(false);
                            setRemove(selected);
                          }}
                        >
                          移出路径
                        </Button>
                      </div>
                    )}
                    <div className="row">
                      <Badge
                        tone={
                          selected.status === "completed"
                            ? "success"
                            : "neutral"
                        }
                      >
                        {pathStatuses[selected.status]}
                      </Badge>
                      {selected.dueAt && (
                        <time>{shortDate(selected.dueAt)}</time>
                      )}
                    </div>
                    <section>
                      <span className="path-detail-label">预期成果</span>
                      <p>{selected.outcome || "待补充"}</p>
                    </section>
                    <section>
                      <span className="path-detail-label">完成标准</span>
                      <p>{selected.criteria || "待补充"}</p>
                    </section>
                    <section className="path-relations">
                      <span className="path-detail-label">行动关系</span>
                      {selected.dependencies.map((id) => {
                        const n = path.nodes.find((n) => n.id === id);
                        return (
                          n && (
                            <button key={id} onClick={() => select(id)}>
                              <span>前置</span>
                              {n.title}
                              <ArrowUpRight size={13} />
                            </button>
                          )
                        );
                      })}
                      <div className="path-relation-current">
                        <i />
                        {selected.title}
                      </div>
                      {path.nodes
                        .filter((n) => n.dependencies.includes(selected.id))
                        .map((n) => (
                          <button key={n.id} onClick={() => select(n.id)}>
                            <span>后续</span>
                            {n.title}
                            <ArrowUpRight size={13} />
                          </button>
                        ))}
                    </section>
                    {selected.questId && (
                      <button
                        className="path-quest-link"
                        onClick={() => openQuest(selected)}
                      >
                        <span>关联 Quest</span>
                        <strong>
                          {snapshot.quests.find(
                            (q) => q.id === selected.questId,
                          )?.title || "查看任务"}
                        </strong>
                        <ArrowUpRight size={16} />
                      </button>
                    )}
                    {selected.status === "completed" && !selected.questId && (
                      <section>
                        <span className="path-detail-label">成果记录</span>
                        <p>{selected.outcome || selected.title}</p>
                      </section>
                    )}
                  </div>
                  <div className="path-detail-actions">
                    <div>
                      {selected.questId ? (
                        <Button
                          onClick={() =>
                            openQuest(selected, selected.status === "completed")
                          }
                        >
                          {selected.status === "completed"
                            ? "查看成果"
                            : "查看 Quest"}
                          <ArrowUpRight size={16} />
                        </Button>
                      ) : selected.status !== "completed" ? (
                        <Button
                          disabled={locked}
                          onClick={() => updateStatus(selected)}
                        >
                          {selected.status === "planned" ? "开始" : "标记完成"}
                          <Check size={16} />
                        </Button>
                      ) : (
                        <Button
                          variant="secondary"
                          onClick={() => setFull(true)}
                        >
                          查看成果
                        </Button>
                      )}
                      <Button
                        variant="quiet"
                        onClick={() =>
                          setEdit({ node: copy(selected), path: copy(path) })
                        }
                      >
                        编辑
                      </Button>
                    </div>
                    <Button
                      variant="quiet"
                      onClick={() => discuss(selected.id)}
                    >
                      <AudioLines size={16} />
                      讨论这个行动
                    </Button>
                  </div>
                </>
              )
            )}
          </aside>
        )}
      </div>
      <div className="sr-only" role="status">
        {notice}
      </div>
      {edit && (
        <NodeEditor
          node={edit.node}
          path={edit.path}
          busy={locked}
          onClose={() => setEdit(null)}
          onSave={async (node) => {
            const exists = edit.path.nodes.some((n) => n.id === node.id);
            const ok = await save({
              ...edit.path,
              nodes: exists
                ? edit.path.nodes.map((n) => (n.id === node.id ? node : n))
                : [...edit.path.nodes, node],
            });
            if (ok) {
              setChanged([node.id]);
              select(node.id);
            }
            return ok;
          }}
        />
      )}
      {goal && (
        <GoalEditor
          path={goal}
          onSave={save}
          busy={locked}
          onClose={() => setGoal(null)}
        />
      )}
      {remove && (
        <Dialog title="移出路径" onClose={() => setRemove(null)}>
          <p>{remove.title}</p>
          <p className="muted">关联任务与已有成果会保留。</p>
          <div className="path-edit-actions">
            <Button variant="quiet" onClick={() => setRemove(null)}>
              取消
            </Button>
            <Button
              variant="danger"
              disabled={locked}
              onClick={async () => {
                const next = {
                  ...copy(path),
                  nodes: path.nodes
                    .filter((n) => n.id !== remove.id)
                    .map((n) => ({
                      ...n,
                      dependencies: n.dependencies.filter(
                        (id) => id !== remove.id,
                      ),
                    })),
                };
                if (await save(next)) {
                  setRemove(null);
                  close();
                }
              }}
            >
              移出
            </Button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
function CompassMark() {
  return (
    <svg
      viewBox="0 0 32 32"
      width="28"
      height="28"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="16" cy="16" r="13" stroke="currentColor" opacity=".4" />
      <path
        d="m21 11-3 7-7 3 3-7 7-3Z"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <circle cx="16" cy="16" r="1.5" fill="currentColor" />
    </svg>
  );
}
