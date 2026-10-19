import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  ArrowLeft,
  ArrowUpRight,
  ChevronRight,
  MoreHorizontal,
  X,
} from "lucide-react";
import { useProduct } from "../product";
import type { BlueprintNode, Proposal } from "../domain/types";
import { Badge, Button, Dialog, Empty, formatDate } from "../components/ui";
import "./blueprint.css";
import { BlueprintRoadmap } from "../components/BlueprintRoadmap";
import { enterpriseScope } from "../domain/profile";

const lanes = [
  { id: "customer", title: "客户与需求", full: "客户与需求验证" },
  { id: "product", title: "产品与技术", full: "产品与技术开发" },
  { id: "marketing", title: "品牌与市场", full: "品牌与市场推广" },
  { id: "sales", title: "销售与商业模式", full: "销售与商业模式" },
  { id: "operations", title: "运营与交付", full: "运营与交付" },
  { id: "team", title: "团队与合作", full: "团队与合作资源" },
  { id: "finance", title: "财务与投融资", full: "财务与投融资" },
  { id: "governance", title: "治理与合规", full: "治理与合规" },
];
const stages = ["当前", "接下来", "未来"];
const kinds: Record<BlueprintNode["kind"], string> = {
  fact: "事实",
  hypothesis: "待验证假设",
  action: "行动",
};
const statuses: Record<BlueprintNode["status"], string> = {
  planned: "待推进",
  in_progress: "进行中",
  completed: "已完成",
};
const decisionLabels: Record<string, string> = {
  revision_requested: "需修改",
  accepted: "已验收",
  practice_completed: "练习完成",
  continue_conversation: "继续沟通",
  not_proceeding: "暂不推进",
};

function dateInput(value: string) {
  const time = Date.parse(value);
  return Number.isFinite(time)
    ? new Date(time + 8 * 60 * 60 * 1000).toISOString().slice(0, 16)
    : "";
}
function isoDate(value: string) {
  if (!value) return "";
  const date = new Date(`${value}+08:00`);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}
function cycles(nodes: BlueprintNode[], id: string, dependencies: string[]) {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  function visit(key: string): boolean {
    if (visiting.has(key)) return true;
    if (visited.has(key)) return false;
    visiting.add(key);
    const next =
      key === id
        ? dependencies
        : (nodes.find((node) => node.id === key)?.dependencies ?? []);
    if (next.some(visit)) return true;
    visiting.delete(key);
    visited.add(key);
    return false;
  }
  return visit(id);
}

interface EditDraft {
  id: string;
  baseVersion: number;
  title: string;
  owner: string;
  due: string;
  criteria: string;
  dependencies: string[];
  kind: BlueprintNode["kind"];
  stage: BlueprintNode["stage"];
}

export function Blueprint() {
  const { snapshot, workspace, role, run, busy, pending } = useProduct();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const blueprint = workspace.blueprint;
  const locked = busy || pending;
  const [compact, setCompact] = useState(
    () => window.matchMedia("(max-width: 760px)").matches,
  );
  const [edit, setEdit] = useState<EditDraft | null>(null);
  const [config, setConfig] = useState<{
    title: string;
    funding: boolean;
  } | null>(null);
  const [delay, setDelay] = useState<{ id: string; date: string } | null>(null);
  const [proposalId, setProposalId] = useState<string | null>(null);
  const [validation, setValidation] = useState("");
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const previousSelection = useRef<string | null>(params.get("node"));

  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    const change = () => setCompact(media.matches);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);

  const visibleNodes = blueprint.nodes.filter(
    (node) => blueprint.fundingEnabled || node.id !== "finance-2",
  );
  const selected = visibleNodes.find((node) => node.id === params.get("node"));
  const selectedLane = lanes.find(
    (lane) => lane.id === (selected?.laneId ?? params.get("lane")),
  );
  const readyProposals = workspace.proposals.filter(
    (proposal) =>
      proposal.target === "blueprint" && proposal.status === "ready",
  );
  const proposal = workspace.proposals.find(
    (item) =>
      item.id === proposalId &&
      item.target === "blueprint" &&
      item.status === "ready",
  );

  useEffect(() => {
    if (selected?.id && previousSelection.current !== selected.id)
      detailHeading.current?.focus();
    previousSelection.current = selected?.id ?? null;
  }, [selected?.id]);

  function selectNode(node: BlueprintNode) {
    const next = new URLSearchParams(params);
    next.set("lane", node.laneId);
    next.set("node", node.id);
    setParams(next);
  }
  function selectLane(id: string) {
    const next = new URLSearchParams(params);
    next.set("lane", id);
    next.delete("node");
    setParams(next);
  }
  function goBack(all = false) {
    const next = new URLSearchParams(params);
    next.delete("node");
    if (all) next.delete("lane");
    else if (selected) next.set("lane", selected.laneId);
    setParams(next);
  }
  function openEdit(node: BlueprintNode) {
    setValidation("");
    setEdit({
      id: node.id,
      baseVersion: blueprint.version,
      title: node.title,
      owner: node.owner,
      due: dateInput(node.dueAt),
      criteria: node.criteria,
      dependencies: [...node.dependencies],
      kind: node.kind,
      stage: node.stage,
    });
  }
  async function saveEdit(event: FormEvent) {
    event.preventDefault();
    if (!edit || locked) return;
    if (!edit.title.trim()) {
      setValidation("请填写事项名称。");
      return;
    }
    if (cycles(blueprint.nodes, edit.id, edit.dependencies)) {
      setValidation("依赖形成循环，请移除一条关系。");
      return;
    }
    const dueAt = isoDate(edit.due);
    if (edit.due && !dueAt) {
      setValidation("请输入有效时间。");
      return;
    }
    const result = await run({
      type: "saveBlueprintNode",
      id: edit.id,
      baseVersion: edit.baseVersion,
      patch: {
        title: edit.title.trim(),
        owner: edit.owner.trim(),
        dueAt,
        criteria: edit.criteria.trim(),
        dependencies: edit.dependencies,
        kind: edit.kind,
        stage: edit.stage,
      },
    });
    if (result) setEdit(null);
  }
  async function makeDraft(node: BlueprintNode) {
    if (locked) return;
    const oldIds = new Set(snapshot.quests.map((quest) => quest.id));
    const result = await run({
      type: "createQuestDraft",
      sourceNodeId: node.id,
    });
    if (!result) return;
    const matches = result.quests.filter(
      (quest) =>
        quest.sourceNodeId === node.id &&
        quest.publisher === role &&
        quest.status === "draft",
    );
    const draft =
      matches.find((quest) => !oldIds.has(quest.id)) ?? matches.at(-1);
    if (draft)
      navigate(`/john/quest?quest=${encodeURIComponent(draft.id)}&view=edit`);
    else setValidation("未找到任务草稿，请在任务列表查看。");
  }
  async function previewDelay(event: FormEvent) {
    event.preventDefault();
    if (!delay || locked) return;
    const date = isoDate(delay.date);
    const node = blueprint.nodes.find((item) => item.id === delay.id);
    if (!date) {
      setValidation("请设置新的时间。");
      return;
    }
    if (node?.dueAt && Date.parse(date) <= Date.parse(node.dueAt)) {
      setValidation("延期时间应晚于当前时间安排。");
      return;
    }
    const result = await run({
      type: "proposeDelay",
      id: delay.id,
      dueAt: date,
    });
    if (result) {
      const next = result.workspaces[role].proposals
        .filter(
          (item) => item.target === "blueprint" && item.status === "ready",
        )
        .at(-1);
      setDelay(null);
      setProposalId(next?.id ?? null);
    }
  }
  async function resolveProposal(item: Proposal, adopt: boolean) {
    if (locked) return;
    const result = await run({
      type: adopt ? "adoptProposal" : "cancelProposal",
      id: item.id,
    });
    if (result) setProposalId(null);
  }
  function card(node: BlueprintNode) {
    return (
      <button
        key={node.id}
        type="button"
        className={`bp-node${selected?.id === node.id ? " bp-node-selected" : ""}`}
        aria-pressed={selected?.id === node.id}
        onClick={() => selectNode(node)}
      >
        <span className="bp-node-kind">{kinds[node.kind]}</span>
        <span className="bp-node-title">{node.title}</span>
        <span className="bp-node-meta">
          {formatDate(node.dueAt)} <span aria-hidden="true">·</span>{" "}
          {statuses[node.status]}
        </span>
      </button>
    );
  }
  function dependency(id: string) {
    const node = blueprint.nodes.find((item) => item.id === id);
    if (!node)
      return (
        <span className="bp-missing" key={id}>
          关联事项不可用
        </span>
      );
    const hidden = !blueprint.fundingEnabled && node.id === "finance-2";
    return (
      <button
        key={id}
        type="button"
        className="bp-dependency"
        disabled={hidden}
        onClick={() => selectNode(node)}
      >
        <span>
          {node.title}
          {hidden ? " · 融资未启用" : ""}
        </span>
        <ArrowUpRight size={16} aria-hidden="true" />
      </button>
    );
  }
  function detail(node: BlueprintNode) {
    const linkedQuests = snapshot.quests.filter(
      (quest) => quest.sourceNodeId === node.id && quest.publisher === role,
    );
    const results = node.resultIds
      .map((id) => snapshot.results.find((result) => result.id === id))
      .filter((result) => result !== undefined);
    const following = visibleNodes.filter((item) =>
      item.dependencies.includes(node.id),
    );
    return (
      <aside className="bp-detail" aria-label="事项详情">
        <div className="bp-detail-nav">
          <span>{selectedLane?.title}</span>
          <Button
            variant="quiet"
            aria-label={compact ? "返回维度路线" : "关闭事项详情"}
            onClick={() => goBack()}
          >
            {compact ? (
              <>
                <ArrowLeft size={16} />
                返回路线
              </>
            ) : (
              <X size={18} />
            )}
          </Button>
        </div>
        <h2 ref={detailHeading} tabIndex={-1}>
          {node.title}
        </h2>
        <div className="bp-detail-badges">
          <Badge
            tone={
              node.status === "completed"
                ? "success"
                : node.status === "in_progress"
                  ? "pending"
                  : "neutral"
            }
          >
            {statuses[node.status]}
          </Badge>
          <Badge tone={node.kind === "hypothesis" ? "pending" : "neutral"}>
            {kinds[node.kind]}
          </Badge>
        </div>
        <dl className="bp-attributes">
          <div>
            <dt>负责人</dt>
            <dd>{node.owner || "待确定"}</dd>
          </div>
          <div>
            <dt>目标时间</dt>
            <dd>{formatDate(node.dueAt)}</dd>
          </div>
        </dl>
        <section className="bp-detail-section">
          <h3>开始前需完成</h3>
          {node.dependencies.length ? (
            <div className="bp-dependencies">
              {node.dependencies.map(dependency)}
            </div>
          ) : (
            <p className="muted">暂无</p>
          )}
        </section>
        <section className="bp-detail-section">
          <h3>完成标准</h3>
          <p className="bp-preserve">{node.criteria || "待确定"}</p>
        </section>
        {following.length > 0 && (
          <section className="bp-detail-section">
            <h3>影响的事项</h3>
            <div className="bp-dependencies">
              {following.map((item) => dependency(item.id))}
            </div>
          </section>
        )}
        {linkedQuests.length > 0 && (
          <section className="bp-detail-section">
            <h3>关联任务</h3>
            {linkedQuests.map((quest) => (
              <button
                type="button"
                className="bp-dependency"
                key={quest.id}
                onClick={() =>
                  navigate(
                    `/john/quest?quest=${encodeURIComponent(quest.id)}${quest.status === "draft" ? "&view=edit" : ""}`,
                  )
                }
              >
                <span>
                  {quest.title}
                  <small>
                    {quest.status === "draft"
                      ? "草稿"
                      : quest.status === "published"
                        ? "已发布"
                        : quest.status === "paused"
                          ? "已暂停"
                          : "已关闭"}
                  </small>
                </span>
                <ArrowUpRight size={16} aria-hidden="true" />
              </button>
            ))}
          </section>
        )}
        {node.resultIds.length > 0 && (
          <section className="bp-detail-section">
            <h3>任务结果</h3>
            {results.map((result) => {
              const attempt = snapshot.attempts.find(
                (item) => item.id === result.attemptId,
              );
              return (
                <div className="bp-result" key={result.id}>
                  <span>
                    {decisionLabels[result.decision] || result.decision}
                  </span>
                  <small>
                    {formatDate(result.createdAt)} ·{" "}
                    {result.applied ? "已回流" : "待回流"}
                  </small>
                  {attempt && (
                    <Button
                      variant="quiet"
                      onClick={() =>
                        navigate(
                          `/john/quest?quest=${encodeURIComponent(attempt.questId)}`,
                        )
                      }
                    >
                      查看结果 <ArrowUpRight size={14} />
                    </Button>
                  )}
                </div>
              );
            })}
            {results.length < node.resultIds.length && (
              <p className="muted">部分结果记录暂不可用</p>
            )}
          </section>
        )}
        <div className="bp-detail-actions">
          <Button disabled={locked} onClick={() => makeDraft(node)}>
            生成任务草稿 <ArrowUpRight size={16} />
          </Button>
          <div className="bp-secondary-actions">
            <Button
              variant="secondary"
              disabled={locked}
              onClick={() => openEdit(node)}
            >
              编辑事项
            </Button>
            <Button
              variant="quiet"
              disabled={locked}
              onClick={() => {
                setValidation("");
                const time = Date.parse(node.dueAt);
                setDelay({
                  id: node.id,
                  date: Number.isFinite(time)
                    ? dateInput(new Date(time + 14 * 86400000).toISOString())
                    : "",
                });
              }}
            >
              调整时间
            </Button>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <div className="bp-page">
      <header className="bp-heading">
        <div>
          <p className="bp-eyebrow">{workspace.acquisition.answers["j-scope"]?.value.includes("具体项目") ? "项目蓝图" : "企业蓝图"}</p>
          <h1>{enterpriseScope(workspace)}</h1>
        </div>
        <div className="bp-heading-tools">
          <Button
            variant="quiet"
            onClick={() => navigate("/john/onboarding?canvas=full")}
          >
            项目画板 <ArrowUpRight size={16} />
          </Button>
          <details className="bp-more">
            <summary aria-label="更多蓝图操作">
              <MoreHorizontal size={22} />
            </summary>
            <div>
              <Button
                variant="quiet"
                onClick={() => {
                  setValidation("");
                  setConfig({
                    title: enterpriseScope(workspace),
                    funding: blueprint.fundingEnabled,
                  });
                }}
              >
                配置蓝图
              </Button>
              <span>版本 {blueprint.version}</span>
            </div>
          </details>
        </div>
      </header>
      {validation && !edit && !delay && !config && (
        <p className="bp-error" role="alert">
          {validation}
        </p>
      )}
      {readyProposals.length > 0 && (
        <section className="bp-pending" aria-label="待采纳的蓝图调整">
          {readyProposals.map((item) => (
            <div key={item.id}>
              <Badge tone="pending">待采纳</Badge>
              <span>{item.title}</span>
              <Button variant="quiet" onClick={() => setProposalId(item.id)}>
                查看变化 <ArrowUpRight size={16} />
              </Button>
            </div>
          ))}
        </section>
      )}
      <div className={`bp-layout${selected ? " bp-with-detail" : ""}`}>
        {!compact && (
          <BlueprintRoadmap nodes={visibleNodes} lanes={lanes} selectedId={selected?.id} card={card} />
        )}
        {compact && !selected && !selectedLane && (
          <section className="bp-lane-overview" aria-label="项目全部维度">
            {lanes.map((lane, index) => {
              const nodes = visibleNodes.filter(
                (node) => node.laneId === lane.id,
              );
              const current =
                nodes.find(
                  (node) => node.stage === 0 && node.status !== "completed",
                ) ??
                nodes.find((node) => node.status !== "completed") ??
                nodes[0];
              return (
                <button
                  type="button"
                  className="bp-lane-link"
                  key={lane.id}
                  onClick={() => selectLane(lane.id)}
                >
                  <span className="bp-lane-index">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span>
                    <strong>{lane.title}</strong>
                    <small>{current?.title || "待规划"}</small>
                  </span>
                  <ChevronRight size={18} aria-hidden="true" />
                </button>
              );
            })}
          </section>
        )}
        {compact && !selected && selectedLane && (
          <section className="bp-mobile-route">
            <Button variant="quiet" onClick={() => goBack(true)}>
              <ArrowLeft size={16} />
              全部维度
            </Button>
            <h2>{selectedLane.full}</h2>
            {stages.map((stage, index) => (
              <section key={stage} className="bp-mobile-stage">
                <h3>{stage}</h3>
                {visibleNodes.filter(
                  (node) =>
                    node.laneId === selectedLane.id && node.stage === index,
                ).length ? (
                  visibleNodes
                    .filter(
                      (node) =>
                        node.laneId === selectedLane.id && node.stage === index,
                    )
                    .map(card)
                ) : (
                  <p className="muted">
                    {selectedLane.id === "finance" &&
                    index === 2 &&
                    !blueprint.fundingEnabled
                      ? "融资未启用"
                      : "待规划"}
                  </p>
                )}
              </section>
            ))}
          </section>
        )}
        {selected && detail(selected)}
        {!blueprint.nodes.length && <Empty>项目事项尚未建立</Empty>}
      </div>
      {edit && (
        <Dialog
          title="编辑事项"
          onClose={() => {
            if (!busy) setEdit(null);
          }}
        >
          <form className="stack bp-edit-form" onSubmit={saveEdit}>
            {edit.baseVersion !== blueprint.version && (
              <p className="bp-error" role="alert">
                蓝图已有更新，请关闭后重新打开事项。
              </p>
            )}
            <label className="field">
              事项名称
              <input
                value={edit.title}
                maxLength={160}
                required
                onChange={(event) =>
                  setEdit({ ...edit, title: event.target.value })
                }
              />
            </label>
            <div className="bp-form-grid">
              <label className="field">
                负责人
                <input
                  value={edit.owner}
                  maxLength={100}
                  onChange={(event) =>
                    setEdit({ ...edit, owner: event.target.value })
                  }
                />
              </label>
              <label className="field">
                目标时间 · 北京时间
                <input
                  type="datetime-local"
                  value={edit.due}
                  onChange={(event) =>
                    setEdit({ ...edit, due: event.target.value })
                  }
                />
              </label>
            </div>
            <label className="field">
              完成标准
              <textarea
                rows={3}
                value={edit.criteria}
                onChange={(event) =>
                  setEdit({ ...edit, criteria: event.target.value })
                }
              />
            </label>
            <div className="bp-form-grid">
              <label className="field">
                类型
                <select
                  value={edit.kind}
                  onChange={(event) =>
                    setEdit({
                      ...edit,
                      kind: event.target.value as BlueprintNode["kind"],
                    })
                  }
                >
                  {Object.entries(kinds).map(([key, title]) => (
                    <option value={key} key={key}>
                      {title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                阶段
                <select
                  value={edit.stage}
                  onChange={(event) =>
                    setEdit({
                      ...edit,
                      stage: Number(
                        event.target.value,
                      ) as BlueprintNode["stage"],
                    })
                  }
                >
                  {stages.map((stage, index) => (
                    <option value={index} key={stage}>
                      {stage}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <fieldset className="bp-dependency-options">
              <legend>开始前需完成</legend>
              {blueprint.nodes
                .filter((node) => node.id !== edit.id)
                .map((node) => (
                  <label key={node.id}>
                    <input
                      type="checkbox"
                      checked={edit.dependencies.includes(node.id)}
                      onChange={(event) =>
                        setEdit({
                          ...edit,
                          dependencies: event.target.checked
                            ? [...edit.dependencies, node.id]
                            : edit.dependencies.filter((id) => id !== node.id),
                        })
                      }
                    />
                    <span>
                      {node.title}
                      {node.id === "finance-2" && !blueprint.fundingEnabled
                        ? " · 融资未启用"
                        : ""}
                    </span>
                  </label>
                ))}
            </fieldset>
            {validation && (
              <p className="bp-error" role="alert">
                {validation}
              </p>
            )}
            <div className="row">
              <Button
                type="submit"
                disabled={locked || edit.baseVersion !== blueprint.version}
              >
                保存事项
              </Button>
              <Button
                type="button"
                variant="quiet"
                disabled={busy}
                onClick={() => setEdit(null)}
              >
                取消
              </Button>
            </div>
          </form>
        </Dialog>
      )}
      {config && (
        <Dialog
          title="配置蓝图"
          onClose={() => {
            if (!busy) setConfig(null);
          }}
        >
          <form
            className="stack bp-edit-form"
            onSubmit={async (event) => {
              event.preventDefault();
              if (locked) return;
              const result = await run({
                type: "setBlueprint",
                title: config.title.trim(),
                fundingEnabled: config.funding,
              });
              if (result) setConfig(null);
            }}
          >
            <label className="field">
              项目名称
              <input
                required
                value={config.title}
                maxLength={160}
                onChange={(event) =>
                  setConfig({ ...config, title: event.target.value })
                }
              />
            </label>
            <label className="bp-toggle">
              <input
                type="checkbox"
                checked={config.funding}
                onChange={(event) =>
                  setConfig({ ...config, funding: event.target.checked })
                }
              />
              <span>启用融资路线</span>
            </label>
            <div className="row">
              <Button type="submit" disabled={locked}>
                保存
              </Button>
              <Button
                type="button"
                variant="quiet"
                disabled={busy}
                onClick={() => setConfig(null)}
              >
                取消
              </Button>
            </div>
          </form>
        </Dialog>
      )}
      {delay && (
        <Dialog
          title="预览时间调整"
          onClose={() => {
            if (!busy) setDelay(null);
          }}
        >
          <form className="stack bp-edit-form" onSubmit={previewDelay}>
            <h3>
              {blueprint.nodes.find((node) => node.id === delay.id)?.title}
            </h3>
            <label className="field">
              新的目标时间 · 北京时间
              <input
                type="datetime-local"
                required
                value={delay.date}
                onChange={(event) =>
                  setDelay({ ...delay, date: event.target.value })
                }
              />
            </label>
            {validation && (
              <p className="bp-error" role="alert">
                {validation}
              </p>
            )}
            <div className="row">
              <Button type="submit" disabled={locked}>
                预览影响
              </Button>
              <Button
                type="button"
                variant="quiet"
                disabled={busy}
                onClick={() => setDelay(null)}
              >
                取消
              </Button>
            </div>
          </form>
        </Dialog>
      )}
      {proposal && (
        <Dialog title={proposal.title} onClose={() => setProposalId(null)}>
          <div className="stack">
            <Badge tone="pending">待采纳</Badge>
            <div className="bp-proposal-changes">
              {proposal.changes?.map((change) => (
                <div key={change.nodeId}>
                  <strong>
                    {blueprint.nodes.find((node) => node.id === change.nodeId)
                      ?.title || "关联事项"}
                  </strong>
                  <span>
                    <del>{formatDate(change.before)}</del>
                    <ChevronRight size={14} aria-hidden="true" />
                    {formatDate(change.after)}
                  </span>
                </div>
              ))}
            </div>
            {!proposal.changes?.length && <Empty>暂无时间变化</Empty>}
            <div className="row">
              <Button
                disabled={locked || !proposal.changes?.length}
                onClick={() => resolveProposal(proposal, true)}
              >
                采纳调整
              </Button>
              <Button
                variant="secondary"
                disabled={locked}
                onClick={() => resolveProposal(proposal, false)}
              >
                保留原计划
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
