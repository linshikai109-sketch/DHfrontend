import data from "./report-v5-fixture.json";
import { seedSnapshot } from "./fixtures";
import { bindDevelopmentAnalysis } from "./development-analysis";
import { createDevelopmentReport, reportToken } from "./development-report";
import type { DevelopmentAnalysis } from "./development-analysis";
import type { Snapshot } from "./types";
import type { Journal } from "./client";

/** Only the explicit ?fixture=v5 demo route calls this; never merge it into a user's workspace. */
export function reportV5Fixture(): Snapshot {
  const snapshot = seedSnapshot();
  const w = snapshot.workspaces.emma;
  w.context = data.sources.map((s, i) => ({ id: `fixture:${s.id}`, title: s.text, kind: i===5?"goal":"fact", sourceId: `fixture:${s.id}`, sourceVersion: 1, status: "candidate", edited: false, deleted: false, x: 30+(i%3)*250, y: 30+Math.floor(i/3)*180 }));
  w.acquisition.completed = true;
  w.acquisition.completionOperationId = "explicit-v5-fictional-preview";
  w.acquisition.confirmed = false;
  const report = createDevelopmentReport(w);
  report.analysis = bindDevelopmentAnalysis(w, { version: 1, mode: "synthetic_fixture", sourceToken: reportToken(w), sourceIds: w.context.map(n => n.sourceId), sections: data.sections as DevelopmentAnalysis["sections"] });
  report.story = { ...data.story, basis: "根据这位虚构人物分享的研究、内容与发布协作经历", evidenceCaption: "虚构示例 · 自述未外部核验；不定义整个人", sourceIds: w.context.slice(0,3).map(n => n.sourceId), hidden: false };
  w.developmentReport = report;
  return snapshot;
}
export function fixtureStorage(storage: Journal, version: "v5" | "v6" | "upwork-v1" | "fresh" = "v5", seed: () => Snapshot = reportV5Fixture): Journal {
  const suffix = `:explicit-report-${version}-fixture`;
  const key="dhai-mvp-product-demo-v1"+suffix;
  if(!storage.getItem(key)) storage.setItem(key,JSON.stringify(seed()));
  return { getItem: key => storage.getItem(key+suffix), setItem: (key,value) => storage.setItem(key+suffix,value), removeItem:key=>storage.removeItem(key+suffix) };
}
