import { createContext } from "react";
import type { Command, Role, Snapshot, Workspace } from "./domain/types";
import type { setDemoFault } from "./domain/service";
interface ProductContext {
  snapshot: Snapshot;
  workspace: Workspace;
  role: Role;
  run: (command: Command) => Promise<Snapshot | null>;
  busy: boolean;
  error: string;
  pending: boolean;
  notice?: string;
  clearNotice?: () => void;
  clearError: () => void;
  recover: () => Promise<void>;
  setFault: typeof setDemoFault;
}
export const Context = createContext<ProductContext | null>(null);
