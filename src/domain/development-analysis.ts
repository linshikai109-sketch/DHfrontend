import type { Workspace } from "./types";
import { pictureEntries } from "./profile-picture";
import { reportToken } from "./development-report";

export interface DevelopmentGraphics {
  version: 1;
  timeline: { label: string; title: string; contribution: string; sourceIds: string[] }[];
  undated: { label: string; title: string; contribution: string; sourceIds: string[] }[];
  practices: { practice: string; approach: string; sourceIds: string[] }[];
  conditions: { text: string; sourceIds: string[] }[];
  unknown: { text: string; sourceIds: string[] }[];
  directions: { title: string; reason: string; sourceIds: string[] }[];
  stepsTitle: string;
  steps: string[];
}
export interface DevelopmentAnalysis {
  version: 1;
  mode: "limited_projection" | "synthetic_fixture" | "supplied_analysis";
  sourceToken: string;
  sourceIds: string[];
  graphics?: DevelopmentGraphics;
  sections: { title: "过去" | "现在" | "未来"; paragraphs: string[] }[];
}
/** Content handoff, not a semantic reviewer. The caller remains responsible for each assertion. */
export function bindDevelopmentAnalysis(w: Workspace, analysis: DevelopmentAnalysis) {
  const ids = new Set(w.context.filter(n => !n.deleted && n.status !== "stale").map(n => n.sourceId));
  if (analysis.sourceToken !== reportToken(w) || analysis.version !== 1 ||
      analysis.sections.length !== 3 || analysis.sections.some((s, i) => s.title !== ["过去", "现在", "未来"][i] || !s.paragraphs.length || s.paragraphs.some(p => !p.trim())) ||
      !analysis.sourceIds.length || analysis.sourceIds.some(id => !ids.has(id))) throw new Error("分析与当前资料版本不匹配");
  const g = analysis.graphics;
  if (g) {
    const nodes = [...g.timeline, ...g.undated, ...g.practices, ...g.conditions, ...g.unknown, ...g.directions];
    // Validate the content handoff and version linkage, not natural-language entailment.
    if (g.version !== 1 || !g.timeline.length || !g.practices.length || !g.directions.length ||
        !g.stepsTitle.trim() || !g.steps.length || g.steps.some(s => !s.trim()) ||
        nodes.some(n => !n.sourceIds.length || n.sourceIds.some(id => !analysis.sourceIds.includes(id))) ||
        [...g.timeline, ...g.undated].some(n => !n.label.trim() || !n.title.trim() || !n.contribution.trim()) ||
        g.practices.some(n => !n.practice.trim() || !n.approach.trim()) ||
        [...g.conditions, ...g.unknown].some(n => !n.text.trim()) ||
        g.directions.some(n => !n.title.trim() || !n.reason.trim())) throw new Error("图文分析与当前资料版本不匹配");
  }
  return structuredClone(analysis);
}
/** Honest finite mock: short known scope, never the comprehensive fictional person's report. */
export function limitedAnalysis(w: Workspace): DevelopmentAnalysis {
  const entries = pictureEntries(w).filter(e => e.node.status !== "stale" && !e.node.id.startsWith("skip:"));
  const select = (...fields: string[]) => [...new Set(entries.filter(e => fields.includes(e.field)).map(e => `“${e.text}”`))];
  const past = select("experience"), current = select("state", "focus"), conditions = select("conditions"), unknown = select("unknown");
  return { version: 1, mode: "limited_projection", sourceToken: reportToken(w), sourceIds: [...new Set(entries.map(e => e.node.sourceId))], sections: [
    { title: "过去", paragraphs: past.length ? ["你提供了一些经历资料。", ...past.map(text => `你说：${text}`), "还需要了解你在其中具体做了什么、结果如何，以及不同经历之间有什么联系，才能进一步分析。"] : ["还没有足够的经历资料，目前无法分析你的经验和积累。"] },
    { title: "现在", paragraphs: [current.length ? "你提到了目前的情况和想做的事。" : "还不知道你目前的职责和想尝试的方向。", ...current.map(text => `你说：${text}`), ...(conditions.length ? ["你也说明了可以投入的时间或其他条件。", ...conditions.map(text => `你说：${text}`)] : ["可以投入多少时间、有哪些限制，还需要了解。"]), "这份概览只整理你已提供的内容，还不足以分析完整的职业和生活情况。", ...(unknown.length ? ["以下内容还不清楚，或你暂时不想回答。它们会按原话保留，不据此判断你的能力或工作方式。", ...unknown.map(text => `你说：${text}`)] : [])] },
    { title: "未来", paragraphs: current.length ? ["可以先选一件想做的事，安排一次小范围尝试。", "开始前，先看看有没有相关经历、需要多少时间，以及用什么结果判断这次尝试是否有帮助。", conditions.length ? "安排时，请考虑你已经说明的时间和限制。" : "具体投入多少时间、希望看到什么结果，需要由你决定。", "这些是可选建议，还没有加入计划。资料更充分后，再比较不同方向是否适合你。"] : ["可以先说一件想做的事，再决定要不要补充相关经历。", "不需要为了完成概览而报名任务。这份概览没有替你选择行动，也没有把建议加入计划。"] },
  ] };
}
