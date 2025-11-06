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
    
    const isNonErrorException = 
      event.message?.includes('An uncaught exception') ||
      (!event.error && event.message?.includes('exception'));
    
    if (isReplitAnalyticsInitError || isNonErrorException) {
      event.preventDefault();
      event.stopPropagation();
      if (isReplitAnalyticsInitError) {
        console.debug('[1fox] Suppressed Replit Analytics SDK initialization warning');
      } else {
        console.debug('[1fox] Suppressed non-Error exception (already handled in component)');
      }
      return false;
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    const isReplitAnalyticsInitError = 
      event.reason?.context === 'AnalyticsSDKApiError' && 
      event.reason?.message === undefined;
    
    const isNonErrorRejection = !event.reason || typeof event.reason !== 'object' || !(event.reason instanceof Error);
    
    if (isReplitAnalyticsInitError || isNonErrorRejection) {
      event.preventDefault();
      event.stopPropagation();
      if (isReplitAnalyticsInitError) {
        console.debug('[1fox] Suppressed Replit Analytics SDK promise rejection');
      } else {
        console.debug('[1fox] Suppressed non-Error promise rejection (already handled in component)');
      }
    }
  });
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
  });
}

createRoot(document.getElementById("root")!).render(<App />);
