import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

if (typeof window !== "undefined") {
  window.addEventListener("focus", () => {
    // Force WebView to re-capture input
    document.body.click(); // synthetic event to wake input pipeline
  });
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
