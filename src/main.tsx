
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./styles/globals.css";
import { I18nProvider } from "./i18n.tsx";

// Ensure root element exists
const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found, please check index.html");
}

try {
  createRoot(rootElement).render(
    <I18nProvider>
      <App />
    </I18nProvider>
  );
} catch (error) {
  console.error("App initialization failed:", error);
  rootElement.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #000; color: #fff; font-family: Arial, sans-serif; text-align: center; padding: 20px;">
        <div>
          <h1>App Load Failed</h1>
          <p>Please reload the page or contact support</p>
          <button onclick="window.location.reload()" style="margin-top: 20px; padding: 10px 20px; background: #fff; color: #000; border: none; border-radius: 4px; cursor: pointer;">
            Reload
          </button>
        </div>
      </div>
    `;
}
