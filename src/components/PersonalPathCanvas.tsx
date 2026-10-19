import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  Circle,
  Compass,
  Layers,
  Sparkles,
  BriefcaseBusiness,
  FolderOpen,
} from "lucide-react";
import type { PathNode, PersonalPath } from "../domain/types";

export const pathLanes = [
  { id: "direction", title: "方向验证", icon: Compass },
  { id: "capability", title: "能力建设", icon: Sparkles },
  { id: "practice", title: "实践协作", icon: Layers },
  { id: "portfolio", title: "作品积累", icon: FolderOpen },
  { id: "opportunity", title: "机会推进", icon: BriefcaseBusiness },
] as const;
export const pathStages = ["现在", "下一阶段", "后续"];
export const pathStatuses = {
  planned: "待开始",
  in_progress: "进行中",
  completed: "已完成",
};
export function shortDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat("zh-CN", {
        month: "short",
        day: "numeric",
      }).format(date);
}
export function PathNodeCard({
  node,
  selected,
  related,
  changed,
  onSelect,
  mobile = false,
}: {
  node: PathNode;
  selected: boolean;
  related?: boolean;
  changed?: boolean;
  onSelect: (id: string) => void;
  mobile?: boolean;
}) {
  const lane = pathLanes.find((l) => l.id === node.laneId);
  return (
    <button
      type="button"
      className={`path-node ${selected ? "selected" : ""} ${related ? "related" : ""} ${changed ? "changed" : ""} ${node.status}`}
      aria-pressed={selected}
      onClick={() => onSelect(node.id)}
      data-path-node={node.id}
    >
      <span className="path-node-meta">
        {mobile
          ? lane?.title
          : node.questId
            ? "QUEST"
            : node.laneId === "portfolio"
              ? "PORTFOLIO"
              : "行动"}
        {node.questId && <ArrowUpRight size={13} />}
      </span>
      <strong>{node.title}</strong>
      <span className="path-node-foot">
        <span>
          {node.status === "completed" ? (
            <Check size={12} />
          ) : (
            <Circle size={10} />
          )}{" "}
          {pathStatuses[node.status]}
        </span>
        <time>{shortDate(node.dueAt)}</time>
      </span>
    </button>
  );
}
export function PersonalPathCanvas({
  path,
  selectedId,
  onSelect,
  changedIds = [],
}: {
  path: PersonalPath;
  selectedId?: string;
  onSelect: (id: string) => void;
  changedIds?: string[];
}) {
  const scroll = useRef<HTMLDivElement>(null);
  const [dimensionView, setDimensionView] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [expanded, setExpanded] = useState<number[]>([0]);
  const [width, setWidth] = useState(1052);
  useEffect(() => {
    const el = scroll.current;
    if (!el) return;
    const observer = new ResizeObserver(() =>
      setWidth(Math.max(1052, el.clientWidth)),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const stageWidth = (width - (dimensionView ? 176 : 48)) / 3;
  const selected = path.nodes.find((n) => n.id === selectedId);
  const related = new Set(
    selected
      ? [
          ...selected.dependencies,
          ...path.nodes
            .filter((n) => n.dependencies.includes(selected.id))
            .map((n) => n.id),
        ]
      : [],
  );
  const lanes = pathLanes.filter(
    (l) => showAll || path.nodes.some((n) => n.laneId === l.id),
  );
  let top = 72;
  const rows = lanes.map((l) => {
    const height =
      Math.max(
        1,
        ...[0, 1, 2].map(
          (s) =>
            path.nodes.filter((n) => n.laneId === l.id && n.stage === s).length,
        ),
      ) *
        132 +
      30;
    const row = { ...l, top, height };
    top += height;
    return row;
  });
  const positions = new Map<string, { x: number; y: number }>();
  for (const row of rows)
    for (const stage of [0, 1, 2])
      path.nodes
        .filter((n) => n.laneId === row.id && n.stage === stage)
        .forEach((n, i) =>
          positions.set(n.id, {
            x: 176 + stage * stageWidth,
            y: row.top + 15 + i * 132,
          }),
        );
  if (!dimensionView) {
    positions.clear();
    [0, 1, 2].forEach(stage => path.nodes.filter(n => n.stage === stage).forEach((node, i) => positions.set(node.id, { x: 24 + stage * stageWidth, y: 96 + i * 132 })));
    top = 112 + Math.max(1, ...[0, 1, 2].map(stage => path.nodes.filter(n => n.stage === stage).length)) * 132;
  }
  useEffect(() => {
    if (!selectedId) return;
    const node = path.nodes.find((n) => n.id === selectedId);
    if (node)
      setExpanded((previous) =>
        previous.includes(node.stage) ? previous : [...previous, node.stage],
      );
    const el = scroll.current?.querySelector<HTMLElement>(
      `[data-path-node="${CSS.escape(selectedId)}"]`,
    );
    if (el && scroll.current) {
      const parent = scroll.current;
      const pos = el.parentElement!;
      const x = pos.offsetLeft;
      const y = pos.offsetTop;
      const visible =
        x >= parent.scrollLeft + 170 &&
        x + 256 <= parent.scrollLeft + parent.clientWidth &&
        y >= parent.scrollTop + 72 &&
        y + 112 <= parent.scrollTop + parent.clientHeight;
      if (!visible)
        parent.scrollTo({
          left: Math.max(0, x - 190),
          top: Math.max(0, y - 100),
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? "auto"
            : "smooth",
        });
    }
  }, [selectedId, dimensionView]);
  return (
    <>
      <div className="path-view-switch" aria-label="路径视图"><button aria-pressed={!dimensionView} onClick={() => setDimensionView(false)}>路线</button><button aria-pressed={dimensionView} onClick={() => setDimensionView(true)}>维度</button>{dimensionView && <button aria-pressed={showAll} onClick={() => setShowAll(!showAll)}>{showAll ? "收起空维度" : "显示空维度"}</button>}</div>
      <div
        ref={scroll}
        className="path-canvas-scroll"
        aria-label="个人路径画布"
        tabIndex={0}
      >
        <div
          className={`path-canvas ${dimensionView ? "dimension-view" : "journey-view"} ${selectedId ? "has-selection" : ""}`}
          style={{ height: Math.max(top, 500), width }}
        >
          <div
            className="path-stage-head"
            style={{ gridTemplateColumns: dimensionView ? `176px repeat(3, ${stageWidth}px)` : `repeat(3, ${stageWidth}px)` }}
          >
            {dimensionView && <span>成长维度</span>}
            {pathStages.map((s, i) => (
              <div key={s} className={i === 0 ? "current" : ""}>
                <span className="path-stage-number">0{i + 1}</span>
                {s}
                {i === 0 && <i />}
              </div>
            ))}
          </div>
          <div className="path-current-column" style={{ width: stageWidth, left: dimensionView ? 176 : 12 }} />
          {dimensionView && rows.map((row) => (
            <div
              key={row.id}
              className="path-lane-row"
              style={{ top: row.top, height: row.height }}
            >
              <div className="path-lane-label">
                <row.icon size={17} />
                <span>{row.title}</span>
              </div>
            </div>
          ))}
          <svg
            className="path-connections"
            width={width}
            height={Math.max(top, 500)}
            aria-hidden="true"
          >
            {path.nodes.flatMap((node) =>
              node.dependencies.map((dep) => {
                const a = positions.get(dep),
                  b = positions.get(node.id);
                if (!a || !b) return null;
                const active = selectedId === dep || selectedId === node.id;
                const same = a.x === b.x;
                const ax = same ? a.x + 130 : a.x + 256,
                  ay = same ? a.y + 112 : a.y + 56,
                  bx = same ? b.x + 130 : b.x,
                  by = same ? b.y : b.y + 56;
                return (
                  <path
                    key={`${dep}-${node.id}`}
                    className={active ? "active" : ""}
                    d={
                      same
                        ? `M ${ax} ${ay} C ${ax} ${ay + 16}, ${bx} ${by - 16}, ${bx} ${by}`
                        : `M ${ax} ${ay} C ${ax + 30} ${ay}, ${bx - 30} ${by}, ${bx} ${by}`
                    }
                  />
                );
              }),
            )}
          </svg>
          {path.nodes.map((node) => {
            const pos = positions.get(node.id);
            return (
              pos && (
                <div
                  key={node.id}
                  className="path-position"
                  style={{ left: pos.x, top: pos.y }}
                >
                  <PathNodeCard
                    node={node}
                    selected={selectedId === node.id}
                    related={related.has(node.id)}
                    changed={changedIds.includes(node.id)}
                    onSelect={onSelect}
                    mobile={!dimensionView}
                  />
                </div>
              )
            );
          })}
        </div>
      </div>
      <div className="path-mobile-list">
        {pathStages.map((stage, i) => (
          <section
            className={`path-mobile-stage ${i === 0 ? "current" : ""}`}
            key={stage}
          >
            <button
              className="path-stage-toggle"
              aria-expanded={expanded.includes(i)}
              onClick={() =>
                setExpanded((v) =>
                  v.includes(i) ? v.filter((x) => x !== i) : [...v, i],
                )
              }
            >
              <span>
                <i />
                {stage}
              </span>
              <span>
                {path.nodes.filter((n) => n.stage === i).length}
                <ChevronDown
                  size={16}
                  className={expanded.includes(i) ? "rotated" : ""}
                />
              </span>
            </button>
            {expanded.includes(i) && (
              <div className="path-mobile-nodes">
                {path.nodes
                  .filter((n) => n.stage === i)
                  .map((node) => (
                    <PathNodeCard
                      key={node.id}
                      node={node}
                      selected={selectedId === node.id}
                      related={related.has(node.id)}
                      changed={changedIds.includes(node.id)}
                      onSelect={onSelect}
                      mobile
                    />
                  ))}
                {!path.nodes.some((n) => n.stage === i) && (
                  <span className="muted">暂无行动</span>
                )}
              </div>
            )}
          </section>
        ))}
      </div>
    </>
  );
}
