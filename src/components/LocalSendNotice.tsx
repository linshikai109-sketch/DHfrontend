import type { RuntimeProfile } from "../domain/types";
export function LocalSendNotice({ action, taskTitle, profile }: { action: "submission" | "feedback"; taskTitle: string; profile: RuntimeProfile }) {
  if (profile !== "demo_mock") return null;
  return <section className="case-source-note" role="note">
    <strong>{action === "submission" ? "确认提交" : "确认发送反馈"}</strong>
    <p>目的：{taskTitle}</p>
    <p>{action === "submission" ? "正文与所选附件将保存在这个本地任务中，供 John 查看。" : "审核结论与反馈将保存在这个本地任务中，供 Emma 查看。"}不会发送到 Upwork，也不会联系原帖客户。</p>
  </section>;
}
