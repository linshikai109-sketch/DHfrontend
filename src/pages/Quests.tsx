import { LocalSendNotice } from "../components/LocalSendNotice";
import { feedbackPreviewCopy, taskResultCopy } from "../domain/ui-copy";
import { UpworkSource } from "../components/UpworkSource";
import { fixtureViewVersion } from "../domain/view-state";
import { agencyQuestId, isAgencyQuest, upworkCases, upworkCaseById, casePreviewQuest } from "../domain/upwork-cases";
import { questCopy } from "../domain/ui-copy";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  ArrowLeft,
  ArrowRight,
  Clock3,
  FileText,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { useProduct } from "../product";
import { Badge, Button, Dialog, Empty, formatDate } from "../components/ui";
import {
  questTypeLabels,
  type Attempt,
  type Decision,
  type Material,
  type Quest,
  type QuestType,
  type Submission,
} from "../domain/types";
import { readView, writeView } from "../domain/view-state";
import { getPersonalPath } from "../domain/personal-path";
import "./quests.css";

const questStates = {
  draft: "草稿",
  published: "可报名",
  paused: "暂停报名",
  closed: "报名已关闭",
};
const attemptStates = {
  joined: "已报名",
  in_progress: "进行中",
  awaiting_feedback: "等待反馈",
  revision_requested: "待修订",
  completed: "已完成",
};
const decisions: Record<Decision, string> = {
  revision_requested: "请求修订",
  accepted: "验收通过",
  practice_completed: "练习完成",
  continue_conversation: "继续沟通",
  not_proceeding: "暂不继续",
};
const allowedMime = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
  "text/csv",
]);
const extensionMime: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  pdf: "application/pdf",
  txt: "text/plain",
  csv: "text/csv",
};
const maxMaterialsSize = 5 * 1024 * 1024;
const splitLines = (value: string) =>
  value
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
const toInputDate = (value: string) => {
  if (!value || Number.isNaN(Date.parse(value))) return "";
  return new Date(Date.parse(value) + 8 * 3600000).toISOString().slice(0, 16);
};
const fromInputDate = (value: string) => (value ? `${value}:00+08:00` : "");
const editableAttempt = (a: Attempt) =>
  ["joined", "in_progress", "revision_requested"].includes(a.status);
function materialSafe(m: Material) {
  return (
    allowedMime.has(m.mime) &&
    m.dataUrl.startsWith(`data:${m.mime};base64,`) &&
    !/\.(?:html?|svg|js|mjs|exe|sh|xml)$/i.test(m.name)
  );
}
function useAlive() {
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  return alive;
}
function DraftHint({ dirty }: { dirty: boolean }) {
  return (
    <span className="quest-save-state">
      {dirty ? "有未保存的修改" : "已保存"}
    </span>
  );
}
function useDraft<T>(key: string, initial: T) {
  const { snapshot, role } = useProduct();
  const profile = snapshot.runtimeProfile;
  const [draft, setDraft] = useState<T>(() =>
    readView(profile, role, key, initial),
  );
  const [storageError, setStorageError] = useState("");
  useEffect(() => {
    setStorageError(
      writeView(profile, role, key, draft)
        ? ""
        : "草稿没有保存在此浏览器。请先点击保存，确认成功后再离开。",
    );
  }, [profile, role, key, draft]);
  return { draft, setDraft, storageError };
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field quest-field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function Dates({ quest }: { quest: Quest }) {
  return (
    <div className="quest-dates">
      <div>
        <span>报名截止 · {isAgencyQuest(quest.id) ? "建议安排" : "北京时间"}</span>
        <strong>{formatDate(quest.joinDeadline)}</strong>
      </div>
      <div>
        <span>交付截止 · {isAgencyQuest(quest.id) ? "建议安排" : "北京时间"}</span>
        <strong>{formatDate(quest.deadline)}</strong>
      </div>
    </div>
  );
}
function MaterialList({
  materials,
  onRemove,
  disabled = false,
}: {
  materials: Material[];
  onRemove?: (id: string) => void;
  disabled?: boolean;
}) {
  const [preview, setPreview] = useState<Material | null>(null);
  function textOf(m: Material) {
    try {
      return new TextDecoder().decode(
        Uint8Array.from(atob(m.dataUrl.split(",")[1]), (c) => c.charCodeAt(0)),
      );
    } catch {
      return "无法预览此文件";
    }
  }
  return (
    <>
      <div className="quest-materials">
        {materials.map((m) => (
          <div className="quest-material" key={m.id}>
            <FileText size={19} />
            <div>
              <strong>{m.name}</strong>
              <small>{Math.ceil(m.size / 1024)} KB</small>
            </div>
            {materialSafe(m) ? (
              <>
                <a
                  className="quest-file-link"
                  href={m.dataUrl}
                  download={m.name}
                >
                  下载
                </a>
                {(m.mime.startsWith("image/") ||
                  m.mime.startsWith("text/")) && (
                  <Button variant="quiet" onClick={() => setPreview(m)}>
                    预览
                  </Button>
                )}
              </>
            ) : (
              <span className="quest-error">格式不可预览</span>
            )}
            {onRemove && (
              <Button
                variant="quiet"
                disabled={disabled}
                aria-label={`删除 ${m.name}`}
                onClick={() => onRemove(m.id)}
              >
                <Trash2 size={16} />
              </Button>
            )}
          </div>
        ))}
      </div>
      {preview && (
        <Dialog title={preview.name} onClose={() => setPreview(null)}>
          {preview.mime.startsWith("image/") ? (
            <img
              className="quest-image-preview"
              src={preview.dataUrl}
              alt={preview.name}
            />
          ) : (
            <pre className="quest-text-preview">{textOf(preview)}</pre>
          )}
        </Dialog>
      )}
    </>
  );
}
function QuestContent({ quest, previewOnly = false }: { quest: Quest; previewOnly?: boolean }) {
  return (
    <>
      {!previewOnly && <Dates quest={quest} />}
      <div className="quest-details-grid">
        <section>
          <h3>任务目标</h3>
          <p>{questCopy(quest.summary) || "待补充"}</p>
        </section>
        <section>
          <h3>参与要求</h3>
          <p>{quest.requirements || "待补充"}</p>
        </section>
        <section>
          <h3>交付内容</h3>
          <ul>
            {quest.deliverables.map((x, i) => (
              <li key={i}>{questCopy(x)}</li>
            ))}
          </ul>
        </section>
        <section>
          <h3>完成标准</h3>
          <ol>
            {quest.criteria.map((x, i) => (
              <li key={i}>{questCopy(x)}</li>
            ))}
          </ol>
        </section>
        <section>
          <h3>预计投入</h3>
          <p>{quest.effort || "待补充"}</p>
        </section>
        <section>
          <h3>回报</h3>
          <p>{quest.reward || "待补充"}</p>
        </section>
        {quest.materials.length > 0 && (
          <section className="quest-wide-field">
            <h3>任务材料</h3>
            <ul>
              {quest.materials.map((x, i) => (
                <li key={i}>{questCopy(x)}</li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
function QuestEditor({
  quest,
  onSaved,
  onPreview,
}: {
  quest: Quest;
  onSaved: (q: Quest) => void;
  onPreview: (q: Quest) => void;
}) {
  const { run, busy, pending, role } = useProduct();
  const locked = busy || pending;
  const alive = useAlive();
  const { draft, setDraft, storageError } = useDraft(
    `mvp:quest-draft:${role}:${quest.id}`,
    { value: quest, baseVersion: quest.version, dirty: false },
  );
  const [validation, setValidation] = useState("");
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!draft.dirty && draft.baseVersion !== quest.version)
      setDraft({ value: quest, baseVersion: quest.version, dirty: false });
  }, [quest, draft.dirty, draft.baseVersion, setDraft]);
  const patch = (value: Partial<Quest>) =>
    setDraft((d) => ({ ...d, value: { ...d.value, ...value }, dirty: true }));
  async function save(preview = false) {
    if (locked) return;
    if (!form.current?.reportValidity()) return;
    const q = draft.value;
    if (
      !q.title.trim() ||
      !q.requirements.trim() ||
      !q.criteria.length ||
      !q.deliverables.length
    ) {
      setValidation("请补齐标题、参与要求、交付内容和完成标准。");
      return;
    }
    if (
      !q.joinDeadline ||
      !q.deadline ||
      Date.parse(q.joinDeadline) > Date.parse(q.deadline)
    ) {
      setValidation("请设置有效期限，交付时间不能早于报名截止。");
      return;
    }
    setValidation("");
    const next = await run({
      type: "saveQuestDraft",
      quest: { ...q, timezone: "Asia/Shanghai" },
      baseVersion: draft.baseVersion,
    });
    const saved = next?.quests.find((x) => x.id === quest.id);
    if (saved && alive.current) {
      setDraft({ value: saved, baseVersion: saved.version, dirty: false });
      if (preview) onPreview(saved);
      else onSaved(saved);
    }
  }
  return (
    <form
      className="quest-editor"
      ref={form}
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <div className="quest-editor-heading">
        <h2>任务草稿</h2>
        <DraftHint dirty={draft.dirty} />
      </div>
      {draft.baseVersion !== quest.version && draft.dirty && (
        <div className="quest-error" role="alert">
          任务已有新版本。你的修改仍保留，请核对后重新编辑。
          <Button
            variant="quiet"
            disabled={locked}
            onClick={() =>
              setDraft({
                value: quest,
                baseVersion: quest.version,
                dirty: false,
              })
            }
          >
            舍弃本地修改，加载最新版本
          </Button>
        </div>
      )}
      {(validation || storageError) && (
        <p className="quest-error" role="alert">
          {validation || storageError}
        </p>
      )}
      <fieldset disabled={locked}>
        <Field label="任务名称">
          <input
            value={draft.value.title}
            maxLength={120}
            required
            onChange={(e) => patch({ title: e.target.value })}
          />
        </Field>
        <Field label="任务类型">
          <select
            value={draft.value.type}
            onChange={(e) => patch({ type: e.target.value as QuestType })}
          >
            {Object.entries(questTypeLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="任务目标">
          <textarea
            value={draft.value.summary}
            required
            rows={3}
            onChange={(e) => patch({ summary: e.target.value })}
          />
        </Field>
        <div className="quest-two-fields">
          <Field label="报名截止 · 北京时间">
            <input
              type="datetime-local"
              required
              value={toInputDate(draft.value.joinDeadline)}
              onChange={(e) =>
                patch({ joinDeadline: fromInputDate(e.target.value) })
              }
            />
          </Field>
          <Field label="交付截止 · 北京时间">
            <input
              type="datetime-local"
              required
              value={toInputDate(draft.value.deadline)}
              onChange={(e) =>
                patch({ deadline: fromInputDate(e.target.value) })
              }
            />
          </Field>
        </div>
        <div className="quest-two-fields">
          <Field label="预计投入">
            <input
              required
              value={draft.value.effort}
              onChange={(e) => patch({ effort: e.target.value })}
            />
          </Field>
          <Field label="回报">
            <input
              required
              value={draft.value.reward}
              onChange={(e) => patch({ reward: e.target.value })}
            />
          </Field>
        </div>
        <Field label="参与要求">
          <textarea
            required
            rows={3}
            value={draft.value.requirements}
            onChange={(e) => patch({ requirements: e.target.value })}
          />
        </Field>
        <LineField
          label="交付内容 · 每行一项"
          value={draft.value.deliverables}
          onChange={(v) => patch({ deliverables: v })}
        />
        <LineField
          label="完成标准 · 每行一项"
          value={draft.value.criteria}
          onChange={(v) => patch({ criteria: v })}
        />
        <LineField
          label="任务材料 · 名称或链接，每行一项"
          required={false}
          value={draft.value.materials}
          onChange={(v) => patch({ materials: v })}
        />
      </fieldset>
      <div className="quest-action-bar">
        <Button type="submit" variant="secondary" disabled={locked}>
          保存草稿
        </Button>
        <Button type="button" disabled={locked} onClick={() => void save(true)}>
          保存并预览发布 <ArrowRight size={17} />
        </Button>
      </div>
    </form>
  );
}
function LineField({
  label,
  value,
  onChange,
  required = true,
}: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
  required?: boolean;
}) {
  // Retain blank trailing lines while typing; normalize only when the field loses focus.
  const [text, setText] = useState(value.join("\n"));
  const current = useRef(value.join("\n"));
  useEffect(() => {
    if (value.join("\n") !== current.current) {
      setText(value.join("\n"));
      current.current = value.join("\n");
    }
  }, [value]);
  return (
    <Field label={label}>
      <textarea
        required={required}
        rows={3}
        value={text}
        onChange={(e) => {
          const v = e.target.value;
          setText(v);
          current.current = splitLines(v).join("\n");
          onChange(splitLines(v));
        }}
      />
    </Field>
  );
}
function AttemptEditor({
  attempt,
  onPreview,
}: {
  attempt: Attempt;
  onPreview: (a: Attempt) => void;
}) {
  const { run, busy, pending, role } = useProduct();
  const alive = useAlive();
  const { draft, setDraft, storageError } = useDraft(
    `mvp:attempt-draft:${role}:${attempt.id}`,
    {
      text: attempt.text,
      materials: attempt.materials,
      baseVersion: attempt.version,
      dirty: false,
    },
  );
  useEffect(() => {
    if (!draft.dirty && draft.baseVersion !== attempt.version)
      setDraft({
        text: attempt.text,
        materials: attempt.materials,
        baseVersion: attempt.version,
        dirty: false,
      });
  }, [attempt, draft.dirty, draft.baseVersion, setDraft]);
  const [localError, setLocalError] = useState("");
  const [reading, setReading] = useState(false);
  const locked = busy || pending || reading;
  const fileRef = useRef<HTMLInputElement>(null);
  async function filesChanged(files: File[]) {
    if (locked || !files.length) return;
    const total =
      draft.materials.reduce((n, m) => n + m.size, 0) +
      files.reduce((n, f) => n + f.size, 0);
    if (total > maxMaterialsSize) {
      setLocalError("附件合计不能超过 5 MB。");
      return;
    }
    setReading(true);
    setLocalError("");
    try {
      const incoming: Material[] = [];
      for (const file of files) {
        const ext = file.name.split(".").pop()?.toLowerCase() || "";
        const mime = file.type || extensionMime[ext] || "";
        if (!allowedMime.has(mime) || !extensionMime[ext])
          throw new Error("仅支持 PDF、TXT、CSV、PNG、JPG、WebP 和 GIF。");
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () =>
            resolve(
              String(reader.result).replace(/^data:[^;]*;/, `data:${mime};`),
            );
          reader.onerror = () => reject(new Error(`读取 ${file.name} 失败`));
          reader.readAsDataURL(file);
        });
        incoming.push({
          id: crypto.randomUUID(),
          name: file.name,
          mime,
          size: file.size,
          dataUrl,
          status: "finalized",
        });
      }
      setDraft((d) => ({
        ...d,
        materials: [...d.materials, ...incoming],
        dirty: true,
      }));
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "附件读取失败");
    } finally {
      setReading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }
  async function save(preview = false) {
    if (locked) return;
    setLocalError("");
    if (preview && !draft.text.trim() && !draft.materials.length) {
      setLocalError("请先填写交付内容或添加附件。");
      return;
    }
    const next = await run({
      type: "saveAttempt",
      id: attempt.id,
      text: draft.text,
      materials: draft.materials,
      baseVersion: draft.baseVersion,
    });
    const saved = next?.attempts.find((a) => a.id === attempt.id);
    if (saved && alive.current) {
      setDraft({
        text: saved.text,
        materials: saved.materials,
        baseVersion: saved.version,
        dirty: false,
      });
      if (preview) onPreview(saved);
    }
  }
  return (
    <div className="quest-execution">
      <div className="quest-editor-heading">
        <h2>
          {attempt.status === "revision_requested"
            ? "修订交付"
            : "完成你的交付"}
        </h2>
        <DraftHint dirty={draft.dirty} />
      </div>
      {attempt.version !== draft.baseVersion && draft.dirty && (
        <div className="quest-error" role="alert">
          已有新版本，你的草稿仍保留。
          <Button
            variant="quiet"
            disabled={locked}
            onClick={() =>
              setDraft({
                text: attempt.text,
                materials: attempt.materials,
                baseVersion: attempt.version,
                dirty: false,
              })
            }
          >
            舍弃本地修改，加载最新版本
          </Button>
        </div>
      )}
      <Field label="交付内容">
        <textarea
          disabled={locked}
          rows={12}
          value={draft.text}
          onChange={(e) =>
            setDraft((d) => ({ ...d, text: e.target.value, dirty: true }))
          }
          placeholder="记录你的发现、过程与结果"
        />
      </Field>
      <div className="quest-editor-heading">
        <h3>附件</h3>
        <span className="muted">合计最多 5 MB</span>
      </div>
      <MaterialList
        materials={draft.materials}
        disabled={locked}
        onRemove={(id) =>
          setDraft((d) => ({
            ...d,
            materials: d.materials.filter((m) => m.id !== id),
            dirty: true,
          }))
        }
      />
      <input
        ref={fileRef}
        className="quest-file-input"
        type="file"
        multiple
        accept=".pdf,.txt,.csv,.png,.jpg,.jpeg,.webp,.gif"
        onChange={(e) => void filesChanged(Array.from(e.target.files || []))}
      />
      <Button
        variant="secondary"
        disabled={locked}
        onClick={() => fileRef.current?.click()}
      >
        <Upload size={17} />
        {reading ? "正在读取" : "添加附件"}
      </Button>
      {(localError || storageError) && (
        <p className="quest-error" role="alert">
          {localError || storageError}
        </p>
      )}
      <div className="quest-action-bar">
        <Button
          variant="secondary"
          disabled={locked}
          onClick={() => void save()}
        >
          保存草稿
        </Button>
        <Button disabled={locked} onClick={() => void save(true)}>
          保存并预览提交 <ArrowRight size={17} />
        </Button>
      </div>
    </div>
  );
}
function SubmissionReview({
  submission,
  attempt,
  onDone,
}: {
  submission: Submission;
  attempt: Attempt;
  onDone: () => void;
}) {
  const { snapshot, run, busy, pending, role } = useProduct();
  const quest = attempt.questSnapshot;
  const locked = busy || pending;
  const alive = useAlive();
  const existing = snapshot.feedback.find(
    (f) => f.submissionId === submission.id,
  );
  const choices: Decision[] =
    quest.type === "project_outsourcing"
      ? ["revision_requested", "accepted"]
      : quest.type === "role_matching"
        ? ["revision_requested", "continue_conversation", "not_proceeding"]
        : ["revision_requested", "practice_completed"];
  const { draft, setDraft, storageError } = useDraft(
    `mvp:review-draft:${role}:${submission.id}`,
    {
      comment: "",
      criteria: quest.criteria.map(() => false),
      decision: choices[0],
    },
  );
  const [confirm, setConfirm] = useState(false);
  const [validation, setValidation] = useState("");
  const finalDecision = draft.decision !== "revision_requested";
  function preview() {
    if (!draft.comment.trim()) {
      setValidation("请填写反馈。");
      return;
    }
    if (
      finalDecision &&
      ["accepted", "practice_completed"].includes(draft.decision) &&
      draft.criteria.some((x) => !x)
    ) {
      setValidation("请先逐项核对完成标准，或请求修订。");
      return;
    }
    setValidation("");
    setConfirm(true);
  }
  async function send() {
    if (locked) return;
    const next = await run({
      type: "reviewSubmission",
      submissionId: submission.id,
      decision: draft.decision,
      comment: draft.comment,
      criteria: draft.criteria,
    });
    if (next && alive.current) {
      setConfirm(false);
      onDone();
    }
  }
  return (
    <section className="quest-review">
      <div className="quest-editor-heading">
        <h2>提交 #{submission.version}</h2>
        <span className="muted">{formatDate(submission.createdAt)}</span>
      </div>
      <p className="quest-submitted-text">{submission.text || "附件交付"}</p>
      <MaterialList materials={submission.materials} />
      {existing ? (
        <div className="quest-feedback">
          <Badge>{existing.decision === "accepted" ? taskResultCopy(existing.decision,isAgencyQuest(quest.id),snapshot.runtimeProfile === "demo_mock") : decisions[existing.decision]}</Badge>
          <p>{existing.comment}</p>
          <ul>
            {quest.criteria.map((c, i) => (
              <li key={i}>
                {existing.criteria[i] ? "✓" : "—"} {c}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <>
          <h3>逐项核对</h3>
          <fieldset disabled={locked}>
            {quest.criteria.map((c, i) => (
              <label className="quest-check" key={i}>
                <input
                  type="checkbox"
                  checked={Boolean(draft.criteria[i])}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      criteria: d.criteria.map((v, j) =>
                        j === i ? e.target.checked : v,
                      ),
                    }))
                  }
                />
                <span>{c}</span>
              </label>
            ))}
            <Field label="反馈">
              <textarea
                rows={5}
                value={draft.comment}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, comment: e.target.value }))
                }
              />
            </Field>
            <Field label="处理结果">
              <select
                value={draft.decision}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    decision: e.target.value as Decision,
                  }))
                }
              >
                {choices.map((d) => (
                  <option key={d} value={d}>
                    {decisions[d]}
                  </option>
                ))}
              </select>
            </Field>
          </fieldset>
          {(validation || storageError) && (
            <p className="quest-error" role="alert">
              {validation || storageError}
            </p>
          )}
          <div className="quest-action-bar">
            <Button
              disabled={locked || quest.type === "neutral_assessment"}
              onClick={preview}
            >
              预览反馈
            </Button>
          </div>
        </>
      )}
      {confirm && (
        <Dialog
          title="确认发送反馈"
          onClose={() => {
            if (!locked) setConfirm(false);
          }}
        >
          <LocalSendNotice action="feedback" taskTitle={quest.title} profile={snapshot.runtimeProfile}/>
          <Badge>{draft.decision === "accepted" ? feedbackPreviewCopy(draft.decision,isAgencyQuest(quest.id),snapshot.runtimeProfile === "demo_mock") : decisions[draft.decision]}</Badge>
          <p className="quest-submitted-text">{draft.comment}</p>
          <ul>
            {quest.criteria.map((c, i) => (
              <li key={i}>
                {draft.criteria[i] ? "✓" : "—"} {c}
              </li>
            ))}
          </ul>
          <div className="quest-dialog-actions">
            <Button
              variant="secondary"
              disabled={locked}
              onClick={() => setConfirm(false)}
            >
              返回修改
            </Button>
            <Button disabled={locked} onClick={() => void send()}>
              {snapshot.runtimeProfile === "demo_mock" ? "确认发送反馈" : "确认发送"}
            </Button>
          </div>
        </Dialog>
      )}
    </section>
  );
}

export default function Quests() {
  const { snapshot, workspace, role, run, busy, pending } = useProduct();
  const navigate = useNavigate();
  const alive = useAlive();
  const [params, setParams] = useSearchParams();
  const locked = busy || pending;
  const id = params.get("quest");
  const view = params.get("view") || "detail";
  const tab = params.get("tab") || "available";
  const filter = params.get("type") || "all";
  const sort = params.get("sort") || "recommended";
  const quest = snapshot.quests.find(
    (q) =>
      q.id === id &&
      (role === "john"
        ? q.publisher === role
        : q.status !== "draft" ||
          snapshot.attempts.some(
            (a) => a.questId === q.id && a.participant === role,
          )),
  );
  const linkedPathNode =
    role === "emma" && quest
      ? getPersonalPath(workspace, snapshot).nodes.find((node) => {
          if (node.questId === quest.id) return true;
          const item = workspace.plan.items.find(
            (plan) => plan.id === node.planItemId,
          );
          return (
            !!item?.attemptId &&
            snapshot.attempts.some(
              (attempt) =>
                attempt.id === item.attemptId &&
                attempt.questId === quest.id &&
                attempt.participant === role,
            )
          );
        })
      : undefined;
  const ownAttempt = quest
    ? snapshot.attempts.find(
        (a) => a.questId === quest.id && a.participant === role,
      )
    : undefined;
  const [dialog, setDialog] = useState<
    "join" | "pause" | "resume" | "close" | null
  >(null);
  const [consent, setConsent] = useState(false);
  const [previewQuest, setPreviewQuest] = useState<Quest | null>(null);
  const [joinVersion, setJoinVersion] = useState<number | null>(null);
  const search = params.toString();
  useEffect(() => {
    setDialog(null);
    setConsent(false);
    setPreviewQuest(null);
  }, [id, role]);
  useEffect(() => {
    if (!id) {
      const frame = requestAnimationFrame(() =>
        window.scrollTo(0, Number(params.get("scroll")) || 0),
      );
      return () => cancelAnimationFrame(frame);
    }
  }, [id]);
  function change(values: Record<string, string | null>, replace = false) {
    const next = new URLSearchParams(search);
    Object.entries(values).forEach(([key, value]) =>
      value === null ? next.delete(key) : next.set(key, value),
    );
    setParams(next, { replace });
  }
  function open(q: Quest, nextView?: string) {
    change({
      quest: q.id,
      view:
        nextView ||
        (role === "john" && q.status === "draft" ? "edit" : "detail"),
      submission: null,
      scroll: String(window.scrollY),
    });
    window.scrollTo(0, 0);
  }
  function goView(nextView: string, extra: Record<string, string | null> = {}) {
    change({ view: nextView, ...extra });
    window.scrollTo(0, 0);
  }
  function back() {
    change({ quest: null, view: null, submission: null });
  }
  async function newQuest() {
    if (locked) return;
    const before = new Set(snapshot.quests.map((q) => q.id));
    const next = await run({ type: "createQuestDraft" });
    const created = next?.quests.find(
      (q) => q.status === "draft" && q.publisher === role && !before.has(q.id),
    );
    if (created && alive.current) open(created, "edit");
  }
  async function join() {
    if (locked || !quest || !consent || joinVersion === null) return;
    const next = await run({
      type: "joinQuest",
      id: quest.id,
      questVersion: joinVersion,
    });
    if (next && alive.current) {
      setDialog(null);
      setConsent(false);
      goView("execute");
    }
  }
  async function publish() {
    if (locked || !previewQuest || !consent) return;
    const next = await run({
      type: "publishQuest",
      id: previewQuest.id,
      baseVersion: previewQuest.version,
    });
    if (next && alive.current) {
      setPreviewQuest(null);
      setConsent(false);
      goView("detail");
    }
  }
  async function availability() {
    if (locked || !quest || !dialog || dialog === "join") return;
    const status =
      dialog === "pause"
        ? "paused"
        : dialog === "resume"
          ? "published"
          : "closed";
    const next = await run({
      type: "setQuestAvailability",
      id: quest.id,
      status,
      baseVersion: quest.version,
    });
    if (next && alive.current) setDialog(null);
  }
  const tabs =
    role === "john"
      ? [
          ["available", "任务管理"],
          ["draft", "草稿"],
          ["submissions", "待反馈"],
        ]
      : [
          ["available", "任务大厅"],
          ["mine", "我的任务"],
          ["completed", "已完成"],
        ];
  let list = snapshot.quests.filter((q) =>
    role === "john"
      ? q.publisher === role
      : q.status === "published" ||
        snapshot.attempts.some(
          (a) => a.questId === q.id && a.participant === role,
        ),
  );
  list = list
    .filter((q) => {
      const attempts = snapshot.attempts.filter((a) => a.questId === q.id);
      if (role === "john") {
        if (tab === "draft") return q.status === "draft";
        if (tab === "submissions")
          return attempts.some((a) => a.status === "awaiting_feedback");
        return q.status !== "draft";
      }
      const a = attempts.find((a) => a.participant === role);
      return tab === "mine"
        ? Boolean(a && a.status !== "completed")
        : tab === "completed"
          ? a?.status === "completed"
          : q.status === "published" && !a;
    })
    .filter((q) => filter === "all" || q.type === filter);
  if (sort === "deadline")
    list = [...list].sort(
      (a, b) =>
        (Date.parse(a.joinDeadline) || Infinity) -
        (Date.parse(b.joinDeadline) || Infinity),
    );
  const relatedAttempts = quest
    ? snapshot.attempts.filter((a) => a.questId === quest.id)
    : [];
  const submissions = relatedAttempts
    .flatMap((a) => snapshot.submissions.filter((s) => s.attemptId === a.id))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const selectedSubmission = submissions.find(
    (s) => s.id === params.get("submission"),
  );
  const selectedAttempt = selectedSubmission
    ? snapshot.attempts.find((a) => a.id === selectedSubmission.attemptId)
    : undefined;
  const activeQuest = ownAttempt?.questSnapshot || quest;
  const feedback = ownAttempt
    ? snapshot.feedback.filter((f) => f.attemptId === ownAttempt.id)
    : [];
  const results = snapshot.results.filter((r) =>
    role === "emma"
      ? r.attemptId === ownAttempt?.id
      : relatedAttempts.some((a) => a.id === r.attemptId),
  );
  const expired = quest ? Date.parse(quest.joinDeadline) < Date.now() : false;
  const [submitConsent, setSubmitConsent] = useState(false);
  useEffect(() => setSubmitConsent(false), [view, id, ownAttempt?.version]);
  async function submit() {
    if (locked || !ownAttempt || !submitConsent) return;
    const next = await run({
      type: "submitAttempt",
      id: ownAttempt.id,
      baseVersion: ownAttempt.version,
      disclosure: ownAttempt.materials.map((m) => m.id),
    });
    if (next && alive.current) goView("feedback");
  }
  async function apply(id: string) {
    if (locked) return;
    const next = await run({ type: "applyResult", id });
    if (next && alive.current)
      navigate(role === "john" ? "/john/report" : "/emma/result");
  }
  useEffect(() => {
    if (
      previewQuest &&
      quest?.status === "published" &&
      quest.version > previewQuest.version
    ) {
      setPreviewQuest(null);
      setConsent(false);
    }
  }, [quest?.status, quest?.version, previewQuest]);
  function resultPanel() {
    return (
      <section className="quest-results">
        <h2>结果与下一步</h2>
        {results.length ? (
          results.map((r) => (
            <article className="quest-result-card" key={r.id}>
              <Badge tone="success">{r.decision === "accepted" ? taskResultCopy(r.decision,isAgencyQuest(snapshot.attempts.find(a=>a.id===r.attemptId)?.questId||""),snapshot.runtimeProfile === "demo_mock") : decisions[r.decision]}</Badge>
              <p>{questTypeLabels[r.questType]}</p>
              <span className="muted">{formatDate(r.createdAt)}</span>
              <div className="quest-dialog-actions">
                {r.applied ? (
                  <Badge>已记录到工作台</Badge>
                ) : (
                  <Button disabled={locked} onClick={() => void apply(r.id)}>
                    记录结果并查看建议
                  </Button>
                )}
              </div>
            </article>
          ))
        ) : (
          <Empty>还没有任务结果。提交内容并收到反馈后，结果会显示在这里。</Empty>
        )}
        <Button
          variant="secondary"
          disabled={locked}
          onClick={() =>
            navigate(role === "john" ? "/john/report" : "/emma/result")
          }
        >
          返回{role === "john" ? "项目蓝图" : "工作台"} <ArrowRight size={17} />
        </Button>
      </section>
    );
  }
  const upworkMode = fixtureViewVersion() === "upwork-v1";
  const previewCase = upworkMode ? upworkCaseById(params.get("case") || "") : undefined;
  const showCasePreviews = upworkMode && !id && tab === "available" && filter === "all";
  if (previewCase) return <div className="quest-page">
    <Button variant="quiet" onClick={() => change({case:null})}><ArrowLeft size={17}/>返回任务列表</Button>
    <header className="quest-detail-heading"><Badge>独立案例 · 只读预览</Badge><h1>{previewCase.title}</h1><p>这个案例不属于当前营销机构，也没有在平台上创建报名或交付任务。</p></header>
    <UpworkSource caseId={previewCase.id}/>
    <QuestContent quest={casePreviewQuest(previewCase)} previewOnly/>
  </div>;
  return (
    <div className="quest-page">
      {upworkMode && !id && <p className="muted">主线是平台建议的本地任务；另外三个是独立真实需求预览，不代表报名成功、能力匹配或客户交付。</p>}
      {!id ? (
        <>
          <header className="quest-page-heading">
            <div>
              <span className="quest-eyebrow">Quest · 任务</span>
              <h1>
                {role === "john" ? "管理你发布的任务" : "选择一个任务试试"}
              </h1>
            </div>
            {role === "john" && (
              <Button disabled={locked} onClick={() => void newQuest()}>
                <Plus size={18} />
                创建任务
              </Button>
            )}
          </header>
          <div className="quest-hub-toolbar">
            <nav className="quest-tabs" aria-label="任务分类">
              {tabs.map(([key, label]) => (
                <button
                  key={key}
                  aria-current={tab === key ? "page" : undefined}
                  onClick={() => change({ tab: key, scroll: "0" }, true)}
                >
                  {label}
                </button>
              ))}
            </nav>
            <div className="quest-filters">
              <select
                aria-label="任务类型"
                value={filter}
                onChange={(e) =>
                  change({ type: e.target.value, scroll: "0" }, true)
                }
              >
                <option value="all">全部类型</option>
                {Object.entries(questTypeLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
              <select
                aria-label="排序"
                value={sort}
                onChange={(e) =>
                  change({ sort: e.target.value, scroll: "0" }, true)
                }
              >
                <option value="recommended">默认排序</option>
                <option value="deadline">报名截止优先</option>
              </select>
            </div>
          </div>
          {list.length || showCasePreviews ? (
            <div className="quest-cards">
              {list.map((q) => {
                const a = snapshot.attempts.find(
                  (a) => a.questId === q.id && a.participant === role,
                );
                const awaiting = snapshot.attempts.filter(
                  (a) => a.questId === q.id && a.status === "awaiting_feedback",
                ).length;
                return (
                  <article className="quest-card" key={q.id}>
                    <div className="quest-card-top">
                      <Badge>{questTypeLabels[q.type]}</Badge>
                      {role === "john" ? (
                        <span className="muted">{questStates[q.status]}</span>
                      ) : (
                        a && (
                          <Badge
                            tone={
                              a.status === "completed" ? "success" : "pending"
                            }
                          >
                            {attemptStates[a.status]}
                          </Badge>
                        )
                      )}
                    </div>
                    <h2>{q.title}</h2>
                    <p className="quest-card-summary">{questCopy(q.summary)}</p>
                    <div className="quest-card-delivery"><span>交付内容</span><p>{q.deliverables.map(questCopy).join(" · ") || "待补充"}</p></div>
                    <Dates quest={q} />
                    <footer>
                      <span>
                        <Clock3 size={15} />
                        {q.effort || "投入待定"}
                      </span>
                      <Button
                        variant="quiet"
                        onClick={() =>
                          open(
                            q,
                            tab === "submissions" ? "submissions" : undefined,
                          )
                        }
                      >
                        {awaiting && role === "john"
                          ? `${awaiting} 项待反馈`
                          : q.status === "draft"
                            ? "编辑草稿"
                            : "查看任务"}
                        <ArrowRight size={18} />
                      </Button>
                    </footer>
                  </article>
                );
              })}
              {showCasePreviews && upworkCases.slice(1).map(item => <article className="quest-card" key={item.id}>
                <div className="quest-card-top"><Badge>独立案例预览</Badge><span className="muted">{item.price}</span></div>
                <h2>{item.title}</h2><p className="quest-card-summary">{item.summary}</p>
                <p className="muted">不属于当前营销机构；只读预览，不能报名。</p>
                <footer><span>真实需求 · 招募状态未核实</span><Button variant="quiet" onClick={() => change({case:item.id})}>查看案例 <ArrowRight size={18}/></Button></footer>
              </article>)}
            </div>
          ) : (
            <Empty>
              暂无任务
              {filter !== "all" && (
                <Button
                  variant="quiet"
                  onClick={() => change({ type: "all" }, true)}
                >
                  清除筛选
                </Button>
              )}
            </Empty>
          )}
        </>
      ) : !quest ? (
        <>
          <Button variant="quiet" disabled={locked} onClick={back}>
            <ArrowLeft size={17} />
            返回任务列表
          </Button>
          <Empty>找不到这个任务，或你没有查看权限。可以返回任务列表选择其他任务。</Empty>
        </>
      ) : (
        <>
          <header className="quest-detail-heading">
            <Button variant="quiet" disabled={locked} onClick={back}>
              <ArrowLeft size={17} />
              返回任务列表
            </Button>
            <div className="quest-detail-title">
              <div>
                <Badge>{questTypeLabels[quest.type]}</Badge>
                <h1>{quest.title}</h1>
                {isAgencyQuest(quest.id) && <UpworkSource task/>}
              </div>
              <Badge tone={ownAttempt ? "pending" : "neutral"}>
                {role === "john"
                  ? questStates[quest.status]
                  : ownAttempt
                    ? attemptStates[ownAttempt.status]
                    : "任务详情"}
              </Badge>
            </div>
            {linkedPathNode && (
              <Button
                className="path-linked-node"
                variant="quiet"
                disabled={locked}
                onClick={() =>
                  navigate(
                    `/emma/path?node=${encodeURIComponent(linkedPathNode.id)}`,
                  )
                }
              >
                关联路径 · {linkedPathNode.title}
                <ArrowRight size={16} />
              </Button>
            )}
            {role === "john" && quest.status !== "draft" && (
              <nav className="quest-tabs" aria-label="任务管理">
                <button
                  disabled={locked}
                  aria-current={view === "detail" ? "page" : undefined}
                  onClick={() => goView("detail")}
                >
                  任务概览
                </button>
                <button
                  disabled={locked}
                  aria-current={
                    view === "submissions" || view === "review"
                      ? "page"
                      : undefined
                  }
                  onClick={() => goView("submissions")}
                >
                  参与与提交 · {relatedAttempts.length}
                </button>
                <button
                  disabled={locked}
                  aria-current={view === "result" ? "page" : undefined}
                  onClick={() => goView("result")}
                >
                  结果
                </button>
              </nav>
            )}
          </header>
          {role === "john" && quest.status === "draft" ? (
            <QuestEditor
              key={`${role}:${quest.id}`}
              quest={quest}
              onSaved={() => {}}
              onPreview={(q) => {
                setPreviewQuest(q);
                setConsent(false);
              }}
            />
          ) : role === "john" &&
            view === "review" &&
            selectedSubmission &&
            selectedAttempt ? (
            <SubmissionReview
              key={selectedSubmission.id}
              submission={selectedSubmission}
              attempt={selectedAttempt}
              onDone={() => goView("submissions")}
            />
          ) : role === "john" && view === "submissions" ? (
            <section className="quest-submissions">
              <h2>参与与提交</h2>
              {relatedAttempts.length ? (
                relatedAttempts.map((a) => {
                  const latest = snapshot.submissions
                    .filter((s) => s.attemptId === a.id)
                    .sort((x, y) => y.version - x.version);
                  return (
                    <article className="quest-submission-row" key={a.id}>
                      <div>
                        <h3>{a.participant === "emma" ? "Emma" : "John"}</h3>
                        <Badge tone="pending">{attemptStates[a.status]}</Badge>
                      </div>
                      <div>
                        {latest.length ? (
                          latest.map((s) => (
                            <Button
                              key={s.id}
                              variant="secondary"
                              onClick={() =>
                                goView("review", { submission: s.id })
                              }
                            >
                              提交 #{s.version} · {formatDate(s.createdAt)}
                              <ArrowRight size={15} />
                            </Button>
                          ))
                        ) : (
                          <span className="muted">尚未提交</span>
                        )}
                      </div>
                    </article>
                  );
                })
              ) : (
                <Empty>尚无参与者</Empty>
              )}
            </section>
          ) : view === "result" ? (
            resultPanel()
          ) : role === "emma" &&
            ownAttempt &&
            ["execute", "submit", "feedback"].includes(view) ? (
            <div className="quest-execution-layout">
              <aside className="quest-brief">
                <Badge>{attemptStates[ownAttempt.status]}</Badge>
                <h2>任务要求</h2>
                <QuestContent quest={ownAttempt.questSnapshot} />
                <Button variant="quiet" onClick={() => goView("detail")}>
                  完整任务详情
                </Button>
              </aside>
              <div className="quest-work-surface">
                {view === "submit" && editableAttempt(ownAttempt) ? (
                  <section>
                    <span className="quest-eyebrow">SUBMISSION</span>
                    <h2>确认这次交付</h2>
                    <LocalSendNotice action="submission" taskTitle={ownAttempt.questSnapshot.title} profile={snapshot.runtimeProfile}/>
                    <p className="quest-submitted-text">{ownAttempt.text}</p>
                    <MaterialList materials={ownAttempt.materials} />
                    <section className="quest-disclosure">
                      <h3>本次披露清单</h3>
                      <ul>
                        <li>交付正文</li>
                        {ownAttempt.materials.map((m) => (
                          <li key={m.id}>{m.name}</li>
                        ))}
                      </ul>
                      <span className="muted">{snapshot.runtimeProfile === "demo_mock" ? "保存在本地任务，供 John 查看" : "发送给任务发布者"}</span>
                    </section>
                    <label className="quest-check">
                      <input
                        type="checkbox"
                        checked={submitConsent}
                        disabled={locked}
                        onChange={(e) => setSubmitConsent(e.target.checked)}
                      />
                      <span>{snapshot.runtimeProfile === "demo_mock" ? "我确认将以上内容与附件保存到本地任务" : "我确认提交以上内容与附件"}</span>
                    </label>
                    <div className="quest-action-bar">
                      <Button
                        variant="secondary"
                        disabled={locked}
                        onClick={() => goView("execute")}
                      >
                        返回编辑
                      </Button>
                      <Button
                        disabled={locked || !submitConsent}
                        onClick={() => void submit()}
                      >
                        {snapshot.runtimeProfile === "demo_mock" ? "确认提交" : "确认提交"}
                      </Button>
                    </div>
                  </section>
                ) : view === "execute" && editableAttempt(ownAttempt) ? (
                  <>
                    {feedback.at(-1) && (
                      <div className="quest-feedback">
                        <Badge tone="pending">
                          {decisions[feedback.at(-1)!.decision]}
                        </Badge>
                        <p>{feedback.at(-1)!.comment}</p>
                      </div>
                    )}
                    <AttemptEditor
                      key={`${role}:${ownAttempt.id}`}
                      attempt={ownAttempt}
                      onPreview={() => goView("submit")}
                    />
                  </>
                ) : (
                  <section className="quest-feedback-view">
                    <Badge
                      tone={
                        ownAttempt.status === "completed"
                          ? "success"
                          : "pending"
                      }
                    >
                      {attemptStates[ownAttempt.status]}
                    </Badge>
                    <h2>
                      {ownAttempt.status === "awaiting_feedback"
                        ? "交付已送达，等待反馈"
                        : ownAttempt.status === "revision_requested"
                          ? "按反馈完善这次交付"
                          : "本次任务记录"}
                    </h2>
                    {feedback.map((f) => (
                      <article className="quest-feedback" key={f.id}>
                        <div className="quest-card-top">
                          <Badge>{decisions[f.decision]}</Badge>
                          <span className="muted">
                            {formatDate(f.createdAt)}
                          </span>
                        </div>
                        <p>{f.comment}</p>
                        <ul>
                          {ownAttempt.questSnapshot.criteria.map((c, i) => (
                            <li key={i}>
                              {f.criteria[i] ? "✓" : "—"} {c}
                            </li>
                          ))}
                        </ul>
                      </article>
                    ))}
                    {snapshot.submissions
                      .filter((s) => s.attemptId === ownAttempt.id)
                      .map((s) => (
                        <details
                          className="quest-submission-history"
                          key={s.id}
                        >
                          <summary>
                            提交 #{s.version} · {formatDate(s.createdAt)}
                          </summary>
                          <p className="quest-submitted-text">{s.text}</p>
                          <MaterialList materials={s.materials} />
                        </details>
                      ))}
                    <div className="quest-action-bar">
                      {editableAttempt(ownAttempt) && (
                        <Button
                          disabled={locked}
                          onClick={() => goView("execute")}
                        >
                          继续
                          {ownAttempt.status === "revision_requested"
                            ? "修订"
                            : "编辑"}
                        </Button>
                      )}
                      {ownAttempt.status === "completed" && (
                        <Button onClick={() => goView("result")}>
                          查看结果 <ArrowRight size={17} />
                        </Button>
                      )}
                    </div>
                  </section>
                )}
              </div>
            </div>
          ) : (
            <div className="quest-detail-surface">
              <QuestContent quest={activeQuest!} />
              {quest.type === "neutral_assessment" && role === "emma" ? (
                <div className="quest-neutral">
                  <Badge tone="pending">暂不可开始</Badge>
                  <h3>任务准备中，开放后可参加</h3>
                  <Button
                    variant="secondary"
                    onClick={() => navigate("/emma/result")}
                  >
                    返回工作台
                  </Button>
                </div>
              ) : (
                <div className="quest-action-bar">
                  {role === "emma" ? (
                    ownAttempt ? (
                      <Button
                        disabled={locked}
                        onClick={() =>
                          goView(
                            editableAttempt(ownAttempt)
                              ? "execute"
                              : ownAttempt.status === "completed"
                                ? "result"
                                : "feedback",
                          )
                        }
                      >
                        {editableAttempt(ownAttempt)
                          ? "继续任务"
                          : ownAttempt.status === "completed"
                            ? "查看结果"
                            : "查看提交与反馈"}
                        <ArrowRight size={17} />
                      </Button>
                    ) : (
                      <>
                        <span className="muted">
                          {expired
                            ? "报名已截止"
                            : quest.status !== "published"
                              ? "暂不接受新参与"
                              : ""}
                        </span>
                        <Button
                          disabled={
                            locked || expired || quest.status !== "published"
                          }
                          onClick={() => {
                            setJoinVersion(quest.version);
                            setConsent(false);
                            setDialog("join");
                          }}
                        >
                          报名任务 <ArrowRight size={17} />
                        </Button>
                      </>
                    )
                  ) : (
                    <>
                      {quest.status === "published" && (
                        <Button
                          variant="secondary"
                          disabled={locked}
                          onClick={() => setDialog("pause")}
                        >
                          暂停报名
                        </Button>
                      )}
                      {quest.status === "paused" && (
                        <Button
                          variant="secondary"
                          disabled={locked}
                          onClick={() => setDialog("resume")}
                        >
                          恢复报名
                        </Button>
                      )}
                      {quest.status !== "closed" && (
                        <Button
                          variant="quiet"
                          disabled={locked}
                          onClick={() => setDialog("close")}
                        >
                          关闭报名
                        </Button>
                      )}
                      <Button
                        disabled={locked}
                        onClick={() => goView("submissions")}
                      >
                        查看参与与提交 <ArrowRight size={17} />
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
      {dialog && quest && (
        <Dialog
          title={
            dialog === "join"
              ? "确认报名任务"
              : dialog === "pause"
                ? "暂停任务报名"
                : dialog === "resume"
                  ? "恢复任务报名"
                  : "关闭任务报名"
          }
          onClose={() => {
            if (!locked) setDialog(null);
          }}
        >
          {dialog === "join" ? (
            <>
              <h3>{quest.title}</h3>
              <Dates quest={quest} />
              <p>{quest.requirements}</p>
              {joinVersion !== quest.version ? (
                <p className="quest-error">
                  任务条件已更新，请关闭后重新确认。
                </p>
              ) : (
                <label className="quest-check">
                  <input
                    type="checkbox"
                    disabled={locked}
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                  />
                  <span>我已核对要求、期限、交付标准与回报</span>
                </label>
              )}
              <div className="quest-dialog-actions">
                <Button
                  variant="secondary"
                  disabled={locked}
                  onClick={() => setDialog(null)}
                >
                  返回
                </Button>
                <Button
                  disabled={locked || !consent || joinVersion !== quest.version}
                  onClick={() => void join()}
                >
                  确认报名
                </Button>
              </div>
            </>
          ) : (
            <>
              <p>{quest.title}</p>
              <p className="muted">已有参与和提交记录保留。{dialog === "pause" ? "暂停后，其他人暂时不能报名。" : dialog === "resume" ? "恢复后，其他人可以继续报名。" : "关闭后，其他人不能再报名。"}</p>
              <div className="quest-dialog-actions">
                <Button
                  variant="secondary"
                  disabled={locked}
                  onClick={() => setDialog(null)}
                >
                  取消
                </Button>
                <Button disabled={locked} onClick={() => void availability()}>
                  确认
                  {dialog === "pause"
                    ? "暂停"
                    : dialog === "resume"
                      ? "恢复"
                      : "关闭"}
                </Button>
              </div>
            </>
          )}
        </Dialog>
      )}
      {previewQuest && (
        <Dialog
          title="发布预览"
          wide
          onClose={() => {
            if (!locked) setPreviewQuest(null);
          }}
        >
          <h2>{previewQuest.title}</h2>
          <Badge>{questTypeLabels[previewQuest.type]}</Badge>
          <QuestContent quest={previewQuest} />
          <label className="quest-check">
            <input
              type="checkbox"
              checked={consent}
              disabled={locked}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <span>确认公开以上任务内容</span>
          </label>
          <div className="quest-dialog-actions">
            <Button
              variant="secondary"
              disabled={locked}
              onClick={() => setPreviewQuest(null)}
            >
              返回编辑
            </Button>
            <Button
              disabled={locked || !consent}
              onClick={() => void publish()}
            >
              确认发布
            </Button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
