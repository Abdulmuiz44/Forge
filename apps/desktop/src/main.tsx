import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { NotificationProvider } from "./context/NotificationContext";
import { Toaster } from "./components/Toaster";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <NotificationProvider>
      <Toaster />
      <App />
    </NotificationProvider>
  </React.StrictMode>,
);
