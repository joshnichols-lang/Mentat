import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

if (!(window as any).__errorHandlersRegistered) {
  (window as any).__errorHandlersRegistered = true;
  
  window.addEventListener('error', (event) => {
    const isReplitAnalyticsInitError = 
      event.error?.context === 'AnalyticsSDKApiError' && 
      event.message === 'Analytics SDK:' &&
      !event.error?.message;
    
    if (isReplitAnalyticsInitError) {
      event.preventDefault();
      event.stopPropagation();
      console.debug('[1fox] Suppressed Replit Analytics SDK initialization warning (non-critical platform noise)');
      return false;
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    const isReplitAnalyticsInitError = 
      event.reason?.context === 'AnalyticsSDKApiError' && 
      event.reason?.message === undefined;
    
    if (isReplitAnalyticsInitError) {
      event.preventDefault();
      event.stopPropagation();
      console.debug('[1fox] Suppressed Replit Analytics SDK promise rejection (non-critical platform noise)');
    }
  });
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
  });
}

createRoot(document.getElementById("root")!).render(<App />);
