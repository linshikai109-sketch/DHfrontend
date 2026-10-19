import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
  type ButtonHTMLAttributes,
} from "react";
import { X } from "lucide-react";
import { canReturnFocus, tabBoundaryTarget } from "./dialog-focus";
import { trackDialogViewport } from "./dialog-viewport";
import "./dialog-layout.css";

const modalStack: HTMLDialogElement[] = [];
const focusSelector = 'button, a[href], input, select, textarea, summary, [tabindex], [contenteditable="true"]';
function focusableWithin(root: HTMLElement) {
  return Array.from(root.querySelectorAll<HTMLElement>(focusSelector)).filter(el =>
    el.tabIndex >= 0 && !el.matches(":disabled") && !el.closest("[inert], [hidden]") && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden"
  );
}
export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "quiet" | "danger";
}) {
  return <button {...props} className={`button ${variant} ${className}`} />;
}
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "pending";
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function Dialog({
  title,
  onClose,
  children,
  wide = false,
  returnFocus,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  returnFocus?: HTMLElement | null;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  const returnRef = useRef(returnFocus);
  closeRef.current = onClose;
  returnRef.current = returnFocus;
  useEffect(() => {
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const el = ref.current!;
    const stopViewportTracking = trackDialogViewport(el);
    modalStack.push(el);
    if (!el.open) el.showModal();
    const initial = () => focusableWithin(el).find(node => node.hasAttribute("autofocus")) ?? focusableWithin(el)[0] ?? el;
    initial().focus({ preventScroll: true });
    const topmost = () => modalStack[modalStack.length - 1] === el;
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !topmost()) return;
      const activeModal = document.activeElement?.closest("dialog[open]");
      if (activeModal && activeModal !== el) return;
      const items = focusableWithin(el);
      const target = tabBoundaryTarget(items, document.activeElement as HTMLElement, event.shiftKey);
      if (target || !items.length) {
        event.preventDefault();
        (target ?? el).focus({ preventScroll: true });
      }
    };
    const retain = (event: FocusEvent) => {
      // A child native modal is entitled to focus even if it does not use this wrapper.
      const otherModal = event.target instanceof Element ? event.target.closest("dialog[open]") : null;
      if (topmost() && !el.contains(event.target as Node) && !otherModal) initial().focus({ preventScroll: true });
    };
    document.addEventListener("keydown", trap, true);
    document.addEventListener("focusin", retain);
    return () => {
      stopViewportTracking();
      document.removeEventListener("keydown", trap, true);
      document.removeEventListener("focusin", retain);
      const index = modalStack.indexOf(el);
      if (index >= 0) modalStack.splice(index, 1);
      if (el.open) el.close();
      queueMicrotask(() => {
        if (el.isConnected && el.open) return;
        const parent = modalStack[modalStack.length - 1] ?? Array.from(document.querySelectorAll<HTMLDialogElement>("dialog[open]")).at(-1);
        const targets = [active, returnRef.current, document.querySelector<HTMLElement>("[data-dialog-return-focus]"), document.querySelector<HTMLElement>('[aria-label="个人菜单"], [aria-label="打开功能面板"], [aria-label="打开导航"]')];
        let restored = false;
        for (const target of targets) {
          if (!canReturnFocus(target) || !target || getComputedStyle(target).visibility === "hidden" || (parent && !parent.contains(target))) continue;
          target.focus({ preventScroll: true });
          if (document.activeElement === target) { restored = true; break; }
        }
        if (restored) return;
        if (parent) (focusableWithin(parent)[0] ?? parent).focus({ preventScroll: true });
        else {
          const main = document.querySelector<HTMLElement>("main");
          if (main) {
            const previous = main.getAttribute("tabindex");
            main.tabIndex = -1;
            main.focus({ preventScroll: true });
            if (previous === null) main.removeAttribute("tabindex");
            else main.setAttribute("tabindex", previous);
          }
        }
      });
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      tabIndex={-1}
      className={`dialog shared-dialog ${wide ? "wide" : ""}`}
      onCancel={(e) => {
        e.stopPropagation();
        e.preventDefault();
        closeRef.current();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeRef.current();
      }}
    >
      <div className="dialog-head">
        <h2 id={titleId}>{title}</h2>
        <Button variant="quiet" aria-label="关闭" onClick={onClose}>
          <X size={20} />
        </Button>
      </div>
      <div className="dialog-body">{children}</div>
    </dialog>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}
export function formatDate(value: string) {
  if (!value) return "待定";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "待定"
    : new Intl.DateTimeFormat("zh-CN", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Shanghai",
      }).format(date);
}
