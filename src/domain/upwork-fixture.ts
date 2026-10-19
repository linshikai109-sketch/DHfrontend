import { reportV6Fixture } from "./report-v6-fixture";
import { agencyCase, agencyQuestId } from "./upwork-cases";
import type { Answer, ContextNode, Snapshot } from "./types";

/** An isolated new demo; never replaces a saved user's workspace or existing fixtures. */
export function upworkFixture(now = new Date()): Snapshot {
  const snapshot = reportV6Fixture();
  const john = snapshot.workspaces.john;
  const values: [string, string, ContextNode["kind"]][] = [
    ["j-scope", "一个具体项目", "fact"],
    ["j-scope:followup", "当前营销机构 · 运营自动化", "fact"],
    ["j-goal", "希望把客户报表、广告表现与文案审核、账单提醒和客户跟进连起来。", "goal"],
    ["j-customer", "服务付费广告、邮件营销与留存业务的营销机构客户；客户名单没有提供。", "fact"],
    ["j-stage", "自动化项目的实际进度未说明，不能据此认为已有原型或已经交付。", "fact"],
    ["j-resources", "项目预算；原帖完整项目固定标价 $2,500，不是成交价，也不是报表子任务报价。现有工具包括 Meta Ads、Google Ads、Klaviyo、Stripe、Windsor.ai、Slack 和 Gmail。", "fact"],
    ["j-commercial", "原帖提出有偿需求，但成交、客户付费和后续合作均未确认。", "fact"],
    ["j-constraints", "需签 NDA 并提供可维护的交接文档。明确工期、报表频次和节省比例尚未说明。", "constraint"],
    ["j-milestone", "平台建议：先用合成广告数据做一份客户报表草稿，检查数据来源与人工审核，再讨论真实连接。建议尚未获买方批准。", "goal"],
  ];
  john.acquisition.answers = Object.fromEntries(values.map(([id, value]) => [id, { id, value, version: 1, skipped: false } satisfies Answer]));
  john.acquisition.review = true;
  john.acquisition.confirmed = false;
  john.acquisition.index = 0;
  john.context = values.map(([sourceId, title, kind], i) => ({ id: `agency-context-${i}`, title, kind,
    sourceId, sourceVersion: 1, status: "candidate", edited: false, deleted: false,
    x: 30 + (i % 3) * 250, y: 30 + Math.floor(i / 3) * 180 }));
  john.blueprint = { ...john.blueprint, projectId: "upwork-agency-demo", title: "当前营销机构 · 运营自动化",
    nodes: [
      { id: "agency-report-scope", laneId: "customer", title: "建议：核对报表指标、数据来源和审核人", stage: 0, status: "planned", dueAt: "", owner: "John", criteria: "建议：列出指标、来源和待确认问题", dependencies: [], kind: "hypothesis", resultIds: [] },
      { id: "agency-report-draft", laneId: "operations", title: "建议：用合成数据制作首份报表草稿", stage: 0, status: "planned", dueAt: "", owner: "待选择参与者", criteria: "建议：人工审核数据、文案与来源", dependencies: ["agency-report-scope"], kind: "hypothesis", resultIds: [] },
      { id: "agency-handoff", laneId: "team", title: "建议：检查交接文档，再讨论真实连接", stage: 1, status: "planned", dueAt: "", owner: "待确认", criteria: "建议：能复现报表，并说明异常处理", dependencies: ["agency-report-draft"], kind: "hypothesis", resultIds: [] },
    ] };
  snapshot.quests = [{ id: agencyQuestId, version: 1, type: "project_outsourcing", status: "published", publisher: "john",
    sourceNodeId: "agency-report-draft", title: "客户报表草稿与人工审核",
    summary: "平台建议从完整项目中拆出的第一步：用合成数据整理一份客户报表草稿，并记录人工审核意见。尚未获得原帖买方批准。",
    // Required by the existing task contract. These dates are demo scheduling, not source deadlines.
    joinDeadline: new Date(now.getTime() + 30 * 86400000).toISOString(),
    deadline: new Date(now.getTime() + 60 * 86400000).toISOString(), timezone: "Asia/Shanghai",
    effort: "建议先核对指标与样本范围，再估算投入；原帖未说明明确工期。",
    reward: `${agencyCase.price}；本任务未定价，没有付款流程。`,
    deliverables: ["建议交付：一份使用合成广告与邮件数据的客户报表草稿", "建议交付：数据来源、缺失项和人工审核记录", "建议交付：可复现步骤与简短交接文档"],
    criteria: ["合成数据与真实需求分开标明，不伪造真实表现或节省比例", "每个指标可追溯到输入记录，缺失内容标未知", "人工检查文案与报表，未审核内容不称已通过", "交接文档说明运行步骤和异常处理"],
    requirements: "这是任务。参与前需核对报表与工具经验，不表示 Emma 已符合原帖专家要求。只用合成数据，不连接客户账单或账号。",
    materials: ["真实需求摘要：" + agencyCase.summary, "原帖工具：" + agencyCase.tools, "来源：" + agencyCase.url] }];
  snapshot.attempts = []; snapshot.submissions = []; snapshot.feedback = []; snapshot.results = []; snapshot.operations = {};
  john.plan = { version: 1, items: [] }; john.proposals = [];
  return snapshot;
}
