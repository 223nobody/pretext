import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";
import { ErrorBoundary } from "./components/ui/ErrorBoundary";
import "./styles/index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.warn("Pretext Reader service worker registration failed:", error);
    });
  });
}

if (import.meta.env.DEV && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
      .catch((error) => {
        console.warn("Pretext Reader service worker cleanup failed:", error);
      });

    if ("caches" in window) {
      void caches
        .keys()
        .then((keys) => Promise.all(keys.filter((key) => key.startsWith("pretext-")).map((key) => caches.delete(key))))
        .catch((error) => {
          console.warn("Pretext Reader cache cleanup failed:", error);
        });
    }
  });
}
