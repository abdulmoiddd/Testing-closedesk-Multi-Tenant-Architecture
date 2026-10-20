/**
 * CloseDesk Universal Embeddable Widget SDK
 * Allows embedding the CloseDesk Multimodal AI Front-Desk on ANY website.
 *
 * Usage:
 * <script src="https://YOUR_DOMAIN/widget.js" data-tenant="brightstar_hvac" defer></script>
 */
(function () {
  if (window.__CLOSEDESK_INITIALIZED__) return;
  window.__CLOSEDESK_INITIALIZED__ = true;

  // 1. Locate the current script tag and extract attributes
  const currentScript =
    document.currentScript ||
    document.querySelector('script[src*="widget.js"]');
  const tenantId =
    (currentScript && currentScript.getAttribute("data-tenant")) ||
    window.__CLOSEDESK_TENANT_ID__ ||
    "default";

  // 2. Derive base URL from the script source
  let baseUrl = window.location.origin;
  if (currentScript && currentScript.src) {
    try {
      const parsed = new URL(currentScript.src);
      baseUrl = parsed.origin;
    } catch (_) {}
  }

  // 3. Create Container
  const container = document.createElement("div");
  container.id = "closedesk-widget-container";
  container.style.cssText =
    "position: fixed; bottom: 20px; right: 20px; z-index: 2147483647; width: 420px; height: 680px; max-width: 95vw; max-height: 90vh; pointer-events: none; transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); display: flex; flex-direction: column; justify-content: flex-end; align-items: flex-end;";

  // 4. Create Iframe
  const iframe = document.createElement("iframe");
  iframe.id = "closedesk-chat-frame";
  iframe.src = `${baseUrl}/embed/chatbot?tenant=${encodeURIComponent(tenantId)}`;
  iframe.allow = "microphone; camera; autoplay";
  iframe.style.cssText =
    "width: 100%; height: 100%; border: none; background: transparent; pointer-events: auto; color-scheme: normal;";

  container.appendChild(iframe);

  // 5. Append when DOM is ready
  function mount() {
    if (!document.body) {
      window.addEventListener("DOMContentLoaded", mount);
      return;
    }
    document.body.appendChild(container);
  }

  mount();

  // 6. Listen for state messages from inside the widget (e.g., resizing on mobile)
  window.addEventListener("message", function (event) {
    if (!event.data || typeof event.data !== "object") return;
    if (event.data.type === "CLOSEDESK_WIDGET_RESIZE") {
      if (event.data.isExpanded) {
        container.style.width = window.innerWidth < 640 ? "100vw" : "420px";
        container.style.height = window.innerWidth < 640 ? "100vh" : "680px";
        container.style.bottom = window.innerWidth < 640 ? "0px" : "20px";
        container.style.right = window.innerWidth < 640 ? "0px" : "20px";
      } else {
        container.style.width = "80px";
        container.style.height = "80px";
      }
    }
  });
})();
