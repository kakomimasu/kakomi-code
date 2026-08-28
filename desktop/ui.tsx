import { createRoot } from "react-dom/client";
import "./style.css";
import { App } from "./ui/app.tsx";
import { AppErrorBoundary } from "./ui/error-boundary.tsx";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("画面の読み込み先が見つかりません。");

createRoot(rootElement).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>,
);
