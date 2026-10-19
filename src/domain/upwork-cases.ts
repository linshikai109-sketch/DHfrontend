import type { Quest } from "./types";
export const upworkFixtureVersion = "upwork-v1";
export const agencyQuestId = "upwork-agency-report-demo";
export const sourceCheckedAt = "2026-10-05";
export interface UpworkCase {
  id: string; title: string; url: string; postId: string; price: string;
  summary: string; tools: string; effort: string; requirements: string;
  deliverables: string[]; criteria: string[]; boundaries: string;
}
export const upworkCases: UpworkCase[] = [
  {
    id: "agency", title: "营销机构运营自动化", postId: "~022106254213602217805",
    url: "https://www.upwork.com/freelance-jobs/apply/Specialist-Configure-Agency-Operations-Client-Reporting-Updates-Billing-etc_~022106254213602217805/",
    price: "$2,500 · 固定标价（完整项目）",
    summary: "把客户报表、广告表现与文案审核、账单提醒和客户跟进连起来，交付团队能维护的流程。",
    tools: "Meta Ads、Google Ads、Klaviyo、Stripe、Windsor.ai、Slack、Gmail；方案可讨论。",
    effort: "原帖未说明明确工期，也未给出精确报表频次。",
    requirements: "需要实际自动化与数据连接经验；接触账单和客户资料前需签 NDA。John 是当前项目角色，不是原帖买家。",
    deliverables: ["广告表现与文案生成、审核工具", "账单、付款提醒与逾期跟进", "客户沟通与周期性表现报表", "团队可使用和修改的交接文档"],
    criteria: ["人工审核广告文案与报表内容", "说明数据来源、连接方式和异常处理", "团队能够接手维护；具体完成标准仍需与买方确认"],
    boundaries: "未说明节省比例；后续合作只是可能性。平台先拆出报表草稿任务是建议方案，不是买方已批准的安排。",
  },
  {
    id: "coi", title: "分包商保险证明跟踪", postId: "~022106791742843933907",
    url: "https://www.upwork.com/freelance-jobs/apply/Build-Subcontractor-Insurance-COI-Tracker-with-Automatic-Reminders_~022106791742843933907/",
    price: "$400 · 固定标价（仅第一阶段）",
    summary: "为 50–150 家分包商整理保险证明（COI），跟踪到期日、提醒与付款暂停清单。这个数量不是员工数。",
    tools: "Google Sheets、Drive、电子邮件；AI 只提取文档信息。",
    effort: "第一阶段范围明确；第二阶段发票流程另行估价，不包含在 $400 内。",
    requirements: "用确定性规则判断日期和状态。W9 不送入模型，也不存税号；先在沙箱测试，再按最小权限接入。",
    deliverables: ["保险信息与文件关联记录", "到期前 30 天和 7 天提醒", "每周付款暂停清单与审计记录"],
    criteria: ["日期和状态由规则计算，不由模型猜测", "能追溯提取结果及人工更正", "不处理 W9 税号；权限和沙箱通过检查"],
    boundaries: "这是独立案例预览，不属于当前营销机构。没有真实分包商文件、付款或客户交付。",
  },
  {
    id: "medical", title: "医疗专家文档流程架构", postId: "~022106208584209403725",
    url: "https://www.upwork.com/freelance-jobs/apply/Consultant-for-Medical-Expert-Workflow-Architecture-Document-and-Agent-Design_~022106208584209403725/",
    price: "$45–60 / 小时 · 发布标价",
    summary: "把 OCR、结构化事实、报告及引用附录、Word 人工审核和状态版本串起来，让每项事实能追溯到原文页码。",
    tools: "OCR、Claude、Word、Excel、SharePoint；Bates 页码和内部报告规范。",
    effort: "每周少于 30 小时，预计 1–3 个月。",
    requirements: "需要文档流程与质量评估经验。护士审核人员、编码人员和专家审阅交付；不能由模型代替审核。",
    deliverables: ["现有流程诊断与架构建议", "事实、Bates 页码与引用附录关联", "Word 修改意见、状态版本与交接文档"],
    criteria: ["每项事实有原文页码依据", "遵守内部报告规范并保留人工审核", "能够评价质量变化和追溯版本"],
    boundaries: "进阶独立案例，只使用合成文档。Emma 没有因此获得医疗资格，也没有接触真实医疗资料。",
  },
  {
    id: "excel", title: "Excel VBA 状态与整行移动", postId: "~022106227392026531027",
    url: "https://www.upwork.com/freelance-jobs/apply/Quick-Small-job-for-Experienced-Excel-VBA-Developer-Small-Task-Automation-Project_~022106227392026531027/",
    price: "$60 · 固定标价",
    summary: "在 Windows 桌面版 Excel 中，状态改变时移动整行并调整颜色，数据和公式随行保留。",
    tools: "Windows 桌面版 Excel、VBA、.xlsm；不用 AI、API、云服务或外部插件。",
    effort: "小范围任务；原帖未给出明确工期。",
    requirements: "新增行不需要改代码或手动扩展范围。保存、关闭、重开并启用宏后仍有效。",
    deliverables: ["可运行的 .xlsm 工作簿", "保留新增的测试行与测试说明"],
    criteria: ["四种状态与清空状态都正确移动、变色", "整行的数据和公式保留", "新增行及保存重开后行为一致"],
    boundaries: "这是独立案例预览，不属于当前营销机构。岗位要求不是 Emma 已具备的 VBA 能力。",
  },
];
export const agencyCase = upworkCases[0];
export function upworkCaseById(id: string) { return upworkCases.find(item => item.id === id); }
export function isAgencyQuest(id: string) { return id === agencyQuestId; }
/** Preview-only projection: never insert these independent cases into John's task ownership. */
export function casePreviewQuest(item: UpworkCase): Quest {
  return { id: `preview-${item.id}`, version: 1, type: "project_outsourcing", title: item.title,
    summary: item.summary, status: "draft", publisher: "john", deadline: "", joinDeadline: "",
    timezone: "Asia/Shanghai", effort: item.effort, reward: item.price,
    requirements: item.requirements, deliverables: item.deliverables, criteria: item.criteria,
    materials: [item.tools, item.boundaries] };
}
