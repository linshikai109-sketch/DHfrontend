import { Component, type ReactNode } from "react";

/** Preserve saved data when an unexpected render failure interrupts a page. */
export class RecoveryBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <main className="entry" role="alert">
          <h1>页面未能载入</h1>
          <button className="button primary" onClick={() => location.reload()}>
            重新载入
          </button>
        </main>
      );
    return this.props.children;
  }
}
