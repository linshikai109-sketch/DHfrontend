import { questions } from "./questions";
import type { Role } from "./types";

type AnswerLike = { value: string; skipped: boolean };

const mentioned: Record<Role, RegExp[]> = {
  emma: [
    /这次想|目前想|希望推进/,
    /我(?:做过|负责|参与过)|曾经(?:做过|负责)|工作经历/,
    /想(?:尝试|转向|进入)[^，。]{0,14}(?:研究|设计|运营|岗位)/,
    /(?:作品|报告|案例|原型|成果)/,
    /(?:每周|每月).{0,10}(?:小时|天)|可投入.{0,8}(?:小时|天)/,
    /(?:合作偏好|协作方式|希望得到反馈|喜欢独立)/,
    /(?:下一步|有进展|先完成)/,
  ],
  john: [
    /(?:企业整体|具体项目|项目名称)/,
    /(?:希望解决|当前问题|业务目标)/,
    /(?:客户|目标用户|服务对象)/,
    /(?:尚未立项|已立项|原型|试点|已有客户)/,
    /(?:团队|人员|预算|资源)/,
    /(?:付费意愿|商业验证|营收)/,
    /(?:期限|预算限制|资源限制)/,
    /(?:下一个成果|里程碑|验证结果)/,
  ],
};

const focus: Record<Role, RegExp[]> = {
  emma: [
    /目标|方向|想做/,
    /经历|项目|做过/,
    /方向|岗位|工作/,
    /作品|成果|证明/,
    /时间|每周|投入|忙/,
    /合作|团队|反馈/,
    /下一步|进展/,
  ],
  john: [
    /企业|项目|业务/,
    /目标|问题|方向/,
    /客户|用户|市场/,
    /阶段|进度/,
    /团队|资源|预算/,
    /验证|付费/,
    /限制|时间/,
    /里程碑|成果/,
  ],
};

/** The mock chooses the next useful goal; the connected interviewer owns wording. */
export function nextGoalIndex(role: Role, answers: Record<string, AnswerLike>, latest: string) {
  const bank = questions[role];
  const knownText = Object.values(answers).filter((answer) => !answer.skipped).map((answer) => answer.value).join(" ");
  const candidates = bank.map((question, index) => ({
    index,
    score: focus[role][index].test(latest) ? 2 : 0,
    answered: !!answers[question.id],
    alreadyKnown: mentioned[role][index].test(knownText),
  })).filter(({ answered, alreadyKnown }) => !answered && !alreadyKnown);
  candidates.sort((a, b) => b.score - a.score || a.index - b.index);
  return candidates[0]?.index ?? null;
}
