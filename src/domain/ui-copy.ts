/** Display-only wording; protocol codes and operation identities stay unchanged. */
const messages: Record<string, string> = {
  "NT-01 尚未接入": "这个任务暂时还不能报名或提交，请返回任务列表选择其他任务。",
  "真实服务尚未配置": "真实服务还未接入，当前不能保存这次操作。",
  "结果尚未确认，请查询原操作": "还不能确定上次操作是否成功，请先点击查询结果，不要重复提交。",
  "上次操作结果待确认，请先查询结果。": "还不能确定上次操作是否成功，请先查询结果。",
  "结果已有回执，但操作记录清理失败；请查询原操作后再继续。": "已收到操作结果，但本机记录未能清理。请先查询结果，再继续操作。",
  "当前演示身份无此操作权限": "当前身份无此操作权限",
  "模拟服务暂时不可用": "这次操作没有成功，请再试一次。",
  "本机数据无法读取，请保留原数据后重试": "无法读取此浏览器保存的资料。请不要清除浏览器数据，可以尝试重新载入。",
  "无法保存操作记录，本次操作尚未发送；请恢复存储空间后重试。": "本次操作还没有发送，因为此浏览器无法保存记录。请检查存储空间和存储权限后再试。",
  "无法读取操作记录，请恢复浏览器存储后重试；原记录未被覆盖。": "无法读取此浏览器保存的操作记录。请检查浏览器的存储权限后再试，原记录未被覆盖。",
  "真实连接不能使用演示回执": "当前模式不能读取这些操作结果，请回到原来的页面查询。",
};
export function uiError(message: string): string { return messages[message] || message; }

/** Exact legacy demo phrases only; user-authored task text stays unchanged. */
export function questCopy(text: string): string {
  const copy: Record<string, string> = {
    "既有 NT-01 情境，接入后开放。": "任务准备中，开放后可参加",
    "既有NT-01情境，接入后开放": "任务准备中，开放后可参加",
    "结构化产物与材料来源": "你需要提交的内容与参考资料",
    "依据既有 NT-01 规则记录行为": "按任务规则记录过程与结果",
  };
  return copy[text] || text;
}

export function taskResultCopy(decision: string, agency: boolean, demo: boolean): string {
  const label = decision === "accepted" ? agency ? "报表任务已验收" : "任务已验收"
    : decision === "practice_completed" ? "实践已完成" : "合作反馈";
  return label;
}

/** The review preview describes a proposed decision, not a committed result. */
export function feedbackPreviewCopy(decision: string, agency: boolean, demo: boolean): string {
  const label = decision === "accepted" ? agency ? "拟通过报表任务验收" : "拟通过任务验收" : "待发送审核意见";
  return label;
}
