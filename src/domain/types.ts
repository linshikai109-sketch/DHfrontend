import type { DevelopmentReport } from "./development-report";
export type Role = "emma" | "john";
export type RuntimeProfile = "demo_mock" | "connected";
export type Confirmation = "candidate" | "confirmed" | "stale";
export interface ContextNode {
  id: string;
  title: string;
  kind: "fact" | "goal" | "constraint" | "direction" | "action";
  sourceId: string;
  sourceIds?: string[];
  sourceVersion: number;
  status: Confirmation;
  edited: boolean;
  deleted: boolean;
  x: number;
  y: number;
}
export interface ContextEdge {
  id: string;
  from: string;
  to: string;
  label: string;
}
export interface Answer {
  id: string;
  value: string;
  version: number;
  skipped: boolean;
}
export interface Acquisition {
  index: number;
  answers: Record<string, Answer>;
  drafts: Record<string, string>;
  review: boolean;
  confirmed: boolean;
  completed?: boolean;
  completionOperationId?: string;
  limited: boolean;
  branches: number;
  clarifications: number;
}
export interface Memory {
  id: string;
  text: string;
  status: Confirmation;
  sourceIds: string[];
  updatedAt: string;
}
export interface PlanItem {
  id: string;
  title: string;
  status: "planned" | "in_progress" | "completed";
  dueAt?: string;
  attemptId?: string;
  recommendationId?: string;
}
export interface Plan {
  version: number;
  items: PlanItem[];
  adoptedTitle?: string;
}
export interface Proposal {
  id: string;
  title: string;
  baseVersion: number;
  items: PlanItem[];
  sourceVersions: Record<string, number>;
  status: "ready" | "adopted" | "cancelled";
  target: "plan" | "blueprint";
  changes?: { nodeId: string; before: string; after: string }[];
}
export interface BlueprintNode {
  id: string;
  laneId: string;
  title: string;
  stage: 0 | 1 | 2;
  status: "planned" | "in_progress" | "completed";
  dueAt: string;
  owner: string;
  criteria: string;
  dependencies: string[];
  kind: "fact" | "hypothesis" | "action";
  resultIds: string[];
}
export interface Blueprint {
  version: number;
  projectId: string;
  title: string;
  fundingEnabled: boolean;
  nodes: BlueprintNode[];
}
export type PathLane =
  | "direction"
  | "capability"
  | "practice"
  | "portfolio"
  | "opportunity";
export interface PathNode {
  id: string;
  title: string;
  laneId: PathLane;
  stage: 0 | 1 | 2;
  status: "planned" | "in_progress" | "completed";
  dueAt?: string;
  outcome: string;
  criteria: string;
  dependencies: string[];
  planItemId?: string;
  questId?: string;
}
export interface PersonalPath {
  version: number;
  title: string;
  targetDate?: string;
  nodes: PathNode[];
  /** Projection tokens prevent an open editor from overwriting newer plan/Quest changes. */
  sourcePlanVersion?: number;
  sourceAttemptVersions?: Record<string, number>;
}
export interface Workspace {
  role: Role;
  version: number;
  acquisition: Acquisition;
  context: ContextNode[];
  edges: ContextEdge[];
  memories: Memory[];
  plan: Plan;
  developmentReport?: DevelopmentReport;
  roleExpression?: { title: string; hidden: boolean };
  profileImpact?: string;
  recommendationFeedback?: Record<string, "later" | "rejected">;
  proposals: Proposal[];
  blueprint: Blueprint;
  personalPath?: PersonalPath;
  lastPath: string;
}
export type QuestType =
  | "capability_growth"
  | "neutral_assessment"
  | "role_matching"
  | "project_outsourcing";
export interface Quest {
  id: string;
  version: number;
  type: QuestType;
  title: string;
  summary: string;
  status: "draft" | "published" | "paused" | "closed";
  publisher: Role;
  sourceNodeId?: string;
  deadline: string;
  joinDeadline: string;
  timezone: string;
  effort: string;
  reward: string;
  deliverables: string[];
  criteria: string[];
  requirements: string;
  materials: string[];
}
export interface Material {
  id: string;
  name: string;
  mime: string;
  size: number;
  dataUrl: string;
  status: "finalized";
}
export interface Attempt {
  id: string;
  questId: string;
  questVersion: number;
  questSnapshot: Quest;
  version: number;
  participant: Role;
  status:
    | "joined"
    | "in_progress"
    | "awaiting_feedback"
    | "revision_requested"
    | "completed";
  text: string;
  materials: Material[];
  submissionIds: string[];
  feedbackIds: string[];
  resultIds: string[];
}
export interface Submission {
  id: string;
  attemptId: string;
  version: number;
  text: string;
  materials: Material[];
  createdAt: string;
  disclosure: string[];
}
export type Decision =
  | "revision_requested"
  | "accepted"
  | "practice_completed"
  | "continue_conversation"
  | "not_proceeding";
export interface Feedback {
  id: string;
  submissionId: string;
  attemptId: string;
  decision: Decision;
  comment: string;
  criteria: boolean[];
  createdAt: string;
}
export interface Result {
  id: string;
  attemptId: string;
  questType: QuestType;
  decision: Decision;
  createdAt: string;
  applied: boolean;
}
export interface Operation {
  id: string;
  signature: string;
  state: "succeeded" | "failed";
  createdAt: string;
  error?: string;
}
export interface Snapshot {
  schema: 1;
  runtimeProfile: RuntimeProfile;
  revision: number;
  workspaces: Record<Role, Workspace>;
  quests: Quest[];
  attempts: Attempt[];
  submissions: Submission[];
  feedback: Feedback[];
  results: Result[];
  operations: Record<string, Operation>;
}
export type Command =
  | {
      type: "saveAnswer";
      questionId: string;
      value: string;
      skipped?: boolean;
      nextIndex: number;
      branch?: boolean;
      clarification?: boolean;
    }
  | { type: "saveDraft"; questionId: string; value: string }
  | { type: "setAcquisition"; index?: number; review?: boolean }
  | { type: "completeOnboarding"; pictureToken: string }
  | { type: "saveRoleExpression"; title: string; hidden: boolean; baseToken: string }
  | { type: "confirmContext"; limited: boolean; pictureToken?: string }
  | {
      type: "editContext";
      id: string;
      patch: Partial<
        Pick<ContextNode, "title" | "status" | "deleted" | "x" | "y" | "kind">
      >;
    }
  | { type: "saveProfileFact"; id: string; title: string; segment?: number; baseToken?: string }
  | { type: "excludeProfileFact"; id: string; segment: number; baseToken: string }
  | { type: "addContext"; title: string; kind: ContextNode["kind"] }
  | { type: "setEdges"; edges: ContextEdge[] }
  | { type: "mergeContext"; ids: string[]; title: string }
  | { type: "splitContext"; id: string; titles: string[] }
  | {
      type: "saveMemory";
      id?: string;
      text: string;
      status: Confirmation;
      sourceIds?: string[];
    }
  | { type: "createProposal"; title: string; items: PlanItem[] }
  | { type: "adoptProposal"; id: string }
  | { type: "cancelProposal"; id: string }
  | {
      type: "undoPlan";
      proposalId: string;
      baseVersion: number;
      items: PlanItem[];
    }
  | { type: "setPlanItem"; id: string; status: PlanItem["status"] }
  | { type: "adoptRecommendation"; recommendationId: string; title: string; pictureToken?: string }
  | { type: "respondRecommendation"; recommendationId: string; decision: "later" | "rejected" }
  | { type: "resetRecommendationFeedback" }
  | { type: "ensurePersonalPath" }
  | { type: "savePersonalPath"; baseVersion: number; path: PersonalPath }
  | {
      type: "saveBlueprintNode";
      id: string;
      patch: Partial<BlueprintNode>;
      baseVersion: number;
    }
  | { type: "setBlueprint"; title?: string; fundingEnabled?: boolean }
  | { type: "proposeDelay"; id: string; dueAt: string }
  | { type: "createQuestDraft"; sourceNodeId?: string }
  | { type: "saveQuestDraft"; quest: Quest; baseVersion: number }
  | { type: "publishQuest"; id: string; baseVersion: number }
  | {
      type: "setQuestAvailability";
      id: string;
      status: "paused" | "published" | "closed";
      baseVersion: number;
    }
  | { type: "joinQuest"; id: string; questVersion: number }
  | {
      type: "saveAttempt";
      id: string;
      text: string;
      materials: Material[];
      baseVersion: number;
    }
  | {
      type: "submitAttempt";
      id: string;
      baseVersion: number;
      disclosure: string[];
    }
  | {
      type: "reviewSubmission";
      submissionId: string;
      decision: Decision;
      comment: string;
      criteria: boolean[];
    }
  | { type: "applyResult"; id: string }
  | { type: "rememberPath"; path: string };
export interface Request {
  operationId: string;
  role: Role;
  command: Command;
}
export interface ProductService {
  profile: RuntimeProfile;
  getSnapshot(): Snapshot;
  subscribe(callback: () => void): () => void;
  execute(request: Request): Promise<Snapshot>;
  getOperation(id: string): Promise<Operation | undefined>;
}
export type Fault = "none" | "failure" | "lost_response";
export interface ProductError extends Error {
  code: string;
  operationId?: string;
}
export const questTypeLabels: Record<QuestType, string> = {
  capability_growth: "能力成长",
  neutral_assessment: "中性体验",
  role_matching: "合作匹配",
  project_outsourcing: "项目交付",
};
