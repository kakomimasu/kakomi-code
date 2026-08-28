import { createRoot } from "react-dom/client";
import { App } from "./ui/app.tsx";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("画面の読み込み先が見つかりません。");

createRoot(rootElement).render(<App />);
