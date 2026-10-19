import { normalizeMaterialUrl, type Membership, type MaterialOwner, type MaterialsStore, saveMaterial } from './external-materials';

type Answers = Record<string, { value: string; skipped: boolean }>;
export interface SelfMembership { role: string; responsibilities: string }
export interface AnswerLink { key: string; questionId: string; url: string; name: string; owner: MaterialOwner }
export const isMembershipQuestion = (id: string) => /:membership(?:-role|-responsibilities)?$/.test(id);
export function membershipQuestionId(anchor: string, candidate: SelfMembership) {
  return anchor + (!candidate.role && candidate.responsibilities ? ':membership-role' : candidate.role && !candidate.responsibilities ? ':membership-responsibilities' : ':membership');
}

/** Only explicit first-person statements are candidates; team resources are not personal credentials. */
export function johnSelfMembership(answers: Answers, existing?: SelfMembership): SelfMembership {
  const candidate = { role: existing?.role || '', responsibilities: existing?.responsibilities || '' };
  const entries = Object.entries(answers).sort(([a], [b]) => Number(isMembershipQuestion(a)) - Number(isMembershipQuestion(b)));
  for (const [questionId, answer] of entries) {
    if (answer.skipped) continue;
    const text = answer.value.replace(/https?:\/\/[^\s，。；]+/g, '').trim();
    // A short answer to a single missing-field question can be read in its
    // question context, while keeping the original answer unchanged.
    if (isMembershipQuestion(questionId) && !/不确定|不知道|不清楚|不想|稍后|暂未|没有|不是/.test(text)) {
      if (questionId.endsWith('-responsibilities') || (questionId.endsWith(':membership') && candidate.role && !candidate.responsibilities && !/我的角色|我是|我担任/.test(text)))
        candidate.responsibilities = text.replace(/^我(?:主要)?负责\s*/, '').replace(/[。；;]+$/, '');
      else if (questionId.endsWith('-role') || (!candidate.role && candidate.responsibilities && !/负责|职责/.test(text)))
        candidate.role = text.replace(/^我是\s*/, '').replace(/[。；;]+$/, '');
    }
    const clauses = text.split(/[。；;\n]/);
    for (const clause of clauses) {
      if (/不确定|不知道|不想回答|尚未确认|不是|并非|假设|如果|想成为/.test(clause)) continue;
      const role = clause.match(/(?:我(?:在[^，,]{1,20})?(?:担任|是)|我的角色(?:是|为|[:：]))\s*([^，,]{1,100})/);
      const responsibility = clause.match(/(?:我(?:主要)?负责|我的职责(?:是|为|[:：])|负责领域[:：])\s*(.{1,500})/)
        || (role ? clause.match(/[，,](?:主要)?负责\s*(.{1,500})/) : null);
      if (role) candidate.role = role[1].trim();
      if (responsibility) candidate.responsibilities = responsibility[1].trim();
    }
  }
  return candidate;
}

export function missingMembershipPrompt(candidate: SelfMembership) {
  if (!candidate.role && !candidate.responsibilities) return '你在这个项目担任什么角色，主要负责哪些工作？';
  if (!candidate.role) return '你在这个项目担任什么角色？';
  if (!candidate.responsibilities) return '你在这个项目主要负责哪些工作？';
  return '';
}

export function needsMembershipQuestion(answers: Answers, existing?: SelfMembership) {
  return !Object.keys(answers).some(isMembershipQuestion)
    && !!missingMembershipPrompt(johnSelfMembership(answers, existing));
}

/** Links remain pending. Ownership is displayed and editable in the final review. */
export function johnAnswerLinks(answers: Answers): AnswerLink[] {
  const links: AnswerLink[] = [];
  for (const [questionId, answer] of Object.entries(answers)) {
    if (answer.skipped) continue;
    const anchor = questionId.split(':')[0];
    if (!['j-goal', 'j-stage', 'j-resources', 'j-constraints'].includes(anchor)) continue;
    for (const raw of answer.value.match(/https?:\/\/[^\s<>"'，。；、）)]+/g) || []) {
      try {
        const url = normalizeMaterialUrl(raw.replace(/[.,;!?]+$/, ''));
        const owner: MaterialOwner = ['j-goal', 'j-stage'].includes(anchor) ? 'business' : 'personal';
        if (!links.some(link => link.url === url && link.owner === owner))
          links.push({ key: `${questionId}:${url}`, questionId, url, owner, name: new URL(url).hostname });
      } catch { /* The original answer remains available to correct an invalid link. */ }
    }
  }
  return links;
}

/** One existing-store write at final review, retaining statuses and unrelated subjects. */
export function confirmJohnMaterials(store: MaterialsStore, businessId: string, candidate: SelfMembership, links: AnswerLink[], now = new Date().toISOString()): MaterialsStore {
  let next = store;
  if (candidate.role.trim()) {
    if (candidate.role.length > 100 || candidate.responsibilities.length > 500) throw new Error('角色或负责领域过长，请修改原回答后重试');
    const membership: Membership = { ...candidate, subjectId: businessId, personId: 'current-person', updatedAt: now };
    next = { ...next, memberships: { ...next.memberships, [businessId]: membership } };
  }
  for (const link of links) next = saveMaterial(next, link, businessId, now).store;
  return next;
}
