import { RuntimeRouting } from "./components/RuntimeRouting";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import App from "./App";
import { RecoveryBoundary } from "./components/RecoveryBoundary";
import "./styles.css";
import "./pages/workbench-polish.css";
import "./pages/surfaces-polish.css";
import "./pages/local-ui-v7.css";
import "./pages/visual-material-v8.css";
import "./pages/ui-v09.css";
import "./pages/three-surface.css";
import "./pages/conversation-flow.css";
import "./navigation.css";
import "./form-controls.css";
import "./glass-surfaces.css";
import "./onboarding-shell.css";
createRoot(document.getElementById("root")!).render(
  <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "")}>
    <RuntimeRouting>
    <RecoveryBoundary>
      <App />
    </RecoveryBoundary>
    </RuntimeRouting>
  </BrowserRouter>,
);
