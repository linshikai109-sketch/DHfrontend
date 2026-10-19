import type { Role } from "./types";
export interface Question {
  id: string;
  topic: string;
  title: string;
  kind: "single" | "multi" | "open";
  options?: string[];
  followup?: string;
}
export const questions: Record<Role, Question[]> = {
  emma: [
    {
      id: "e-goal",
      topic: "目标",
      title: "这次，你想推进什么？",
      kind: "single",
      options: ["找到新的工作方向", "获得真实项目经验", "为下一次机会做准备"],
      followup: "为什么现在想推进这件事？",
    },
    {
      id: "e-experience",
      topic: "经历",
      title: "哪段经历最能代表你？",
      kind: "open",
    },
    {
      id: "e-direction",
      topic: "方向",
      title: "你想先尝试哪一种工作？",
      kind: "multi",
      options: ["产品设计", "用户研究", "产品运营", "还想探索"],
      followup: "是什么让你想试试这个方向？",
    },
    {
      id: "e-evidence",
      topic: "作品",
      title: "你有哪些可以展示的成果？",
      kind: "open",
    },
    {
      id: "e-time",
      topic: "投入",
      title: "每周可以留出多少时间？",
      kind: "single",
      options: ["2 小时以内", "每周 3–6 小时", "每周 6–10 小时", "10 小时以上"],
      followup: "有什么时间或资源上的限制？",
    },
    {
      id: "e-collaboration",
      topic: "合作",
      title: "你希望怎样与别人合作？",
      kind: "multi",
      options: ["先独立尝试", "有人一起讨论", "有明确的分工", "希望得到反馈"],
    },
    {
      id: "e-next",
      topic: "下一步",
      title: "完成哪件事，会让你觉得有进展？",
      kind: "open",
    },
  ],
  john: [
    {
      id: "j-scope",
      topic: "范围",
      title: "这次，先聚焦哪个范围？",
      kind: "single",
      options: ["一个具体项目", "企业整体方向"],
      followup: "它的名称是什么？",
    },
    {
      id: "j-goal",
      topic: "目标",
      title: "你希望解决什么问题？",
      kind: "open",
    },
    {
      id: "j-customer",
      topic: "客户",
      title: "谁最需要这个解决方案？",
      kind: "open",
    },
    {
      id: "j-stage",
      topic: "阶段",
      title: "项目目前走到哪一步？",
      kind: "single",
      options: ["想法验证", "核心原型", "MVP 试点", "已有客户"],
      followup: "哪些判断已经有证据支持？",
    },
    {
      id: "j-resources",
      topic: "资源",
      title: "目前具备哪些资源？",
      kind: "multi",
      options: ["产品与技术", "目标客户渠道", "交付团队", "项目预算"],
      followup: "最缺的资源是什么？",
    },
    {
      id: "j-commercial",
      topic: "商业",
      title: "目前如何验证付费意愿？",
      kind: "open",
    },
    {
      id: "j-constraints",
      topic: "边界",
      title: "时间、预算或合作有哪些限制？",
      kind: "open",
    },
    {
      id: "j-milestone",
      topic: "里程碑",
      title: "下一个可以验证的成果是什么？",
      kind: "open",
    },
  ],
};
