import { reportV5Fixture } from "./report-v5-fixture";
import { bindDevelopmentAnalysis } from "./development-analysis";
import type { DevelopmentAnalysis } from "./development-analysis";
import content from "./report-v6-fixture.json";

/** Explicit v6 demo only. V5's full analysis stays available as a separate fixture. */
export function reportV6Fixture() {
  const snapshot = reportV5Fixture();
  const w = snapshot.workspaces.emma, report = w.developmentReport!;
  w.acquisition.completionOperationId = "explicit-v6-fictional-preview";
  report.analysis = bindDevelopmentAnalysis(w, {
    ...report.analysis!, sections: content.sections as DevelopmentAnalysis["sections"],
    graphics: { ...content.graphics, version: 1 },
  });
  report.story = { ...report.story, story: content.story,
    basis: "根据你分享的多段经历", evidenceCaption: "建议称号，不代表能力认证" };
  return snapshot;
}
