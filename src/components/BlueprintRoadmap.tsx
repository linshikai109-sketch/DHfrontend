import { useEffect, useRef, useState, type ReactNode } from "react";
import type { BlueprintNode } from "../domain/types";

interface Lane { id: string; title: string }
export function BlueprintRoadmap({ nodes, lanes, selectedId, card }: {
  nodes: BlueprintNode[];
  lanes: Lane[];
  selectedId?: string;
  card: (node: BlueprintNode) => ReactNode;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1080);
  useEffect(() => {
    if (!viewport.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(1080, entry.contentRect.width)));
    observer.observe(viewport.current);
    return () => observer.disconnect();
  }, []);
  const column = (width - 180) / 3;
  const nodeWidth = column - 36;
  let height = 68;
  const positions = new Map<string, { x: number; y: number }>();
  const rows = lanes.map(lane => {
    const top = height;
    const count = Math.max(1, ...[0, 1, 2].map(stage => nodes.filter(n => n.laneId === lane.id && n.stage === stage).length));
    [0, 1, 2].forEach(stage => nodes.filter(n => n.laneId === lane.id && n.stage === stage).forEach((n, i) => positions.set(n.id, { x: 180 + stage * column + 18, y: top + 18 + i * 124 })));
    height += count * 124 + 16;
    return { ...lane, top, height: height - top };
  });
  const selected = nodes.find(n => n.id === selectedId);
  const related = new Set(selected ? [...selected.dependencies, ...nodes.filter(n => n.dependencies.includes(selected.id)).map(n => n.id)] : []);
  useEffect(() => {
    const el = viewport.current?.querySelector<HTMLElement>(`[data-blueprint-node="${CSS.escape(selectedId || "")}"]`);
    if (el && viewport.current) {
      const parent = viewport.current;
      if (el.offsetLeft < parent.scrollLeft + 180 || el.offsetLeft + el.offsetWidth > parent.scrollLeft + parent.clientWidth || el.offsetTop < parent.scrollTop + 68 || el.offsetTop + el.offsetHeight > parent.scrollTop + parent.clientHeight) {
        parent.scrollTo({ left: Math.max(0, el.offsetLeft - 196), top: Math.max(0, el.offsetTop - 88), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      }
    }
  }, [selectedId]);
  return <section className="bp-map" aria-label="八维项目路线">
    <div className="bp-map-toolbar"><span>项目路线</span><span>{nodes.length} 个事项 · {lanes.length} 个维度</span></div>
    <div className="bp-map-scroll" ref={viewport} tabIndex={0} aria-label="项目蓝图画布">
      <div className={`bp-map-world ${selectedId ? 'has-selection' : ''}`} style={{width, height}}>
        <div className="bp-map-stages" style={{gridTemplateColumns: `180px repeat(3, ${column}px)`}}><span>项目维度</span>{['当前', '接下来', '未来'].map((stage, i) => <div key={stage} className={i === 0 ? 'current' : ''}><small>0{i + 1}</small>{stage}</div>)}</div>
        <div className="bp-map-current" style={{left:180, width:column}} />
        {rows.map((row, i) => <div className="bp-map-row" key={row.id} style={{top:row.top,height:row.height}}><div className="bp-map-lane"><small>{String(i + 1).padStart(2,'0')}</small><span>{row.title}</span></div></div>)}
        <svg className="bp-map-edges" width={width} height={height} aria-hidden="true">
          {nodes.flatMap(node => node.dependencies.map(id => {
            const a = positions.get(id), b = positions.get(node.id);
            if (!a || !b) return null;
            const same = a.x === b.x;
            const ax = same ? a.x + nodeWidth / 2 : a.x + nodeWidth;
            const ay = same ? a.y + 108 : a.y + 54;
            const bx = same ? b.x + nodeWidth / 2 : b.x;
            const by = same ? b.y : b.y + 54;
            const active = selectedId === node.id || selectedId === id;
            return <path key={`${id}-${node.id}`} className={active ? 'active' : ''} d={same ? `M${ax},${ay} C${ax},${ay+24} ${bx},${by-24} ${bx},${by}` : `M${ax},${ay} C${ax+24},${ay} ${bx-24},${by} ${bx},${by}`} />;
          }))}
        </svg>
        {nodes.map(node => { const pos = positions.get(node.id); return pos && <div key={node.id} data-blueprint-node={node.id} className={`bp-map-position ${selectedId === node.id ? 'selected' : related.has(node.id) ? 'related' : ''} ${node.status}`} style={{left:pos.x,top:pos.y,width:nodeWidth}}>{card(node)}</div>; })}
      </div>
    </div>
  </section>;
}
