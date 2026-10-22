/**
 * CloseDesk Universal Embeddable Widget SDK
 * Allows embedding the CloseDesk Multimodal AI Front-Desk on ANY website.
 *
 * Features:
 * - Automatic Host Website Visit Tracking (page_view) scoped to tenant_id
 * - Shared Visitor UUID across host page and chatbot iframe
 * - Full-Duplex WebRTC Voice & Multimodal Camera inspection
 * - Responsive auto-sizing (Pill launcher -> full-screen modal)
 * - 100% transparent iframe rendering without background blocking
 *
 * Usage:
 * <script src="https://YOUR_DOMAIN/widget.js" data-tenant="brightstar_hvac" defer></script>
 */
(function () {
  if (typeof window === "undefined") return;
  if (window.__CLOSEDESK_INITIALIZED__) return;
  window.__CLOSEDESK_INITIALIZED__ = true;

  // 1. Locate the current script tag and extract tenant configuration
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

  // 3. Persistent Anonymous Visitor Identifier
  function getAnonVisitorId() {
    try {
      let id = localStorage.getItem("closedesk_anon_id");
      if (!id) {
        id =
          "vis_" +
          Date.now() +
          "_" +
          Math.random().toString(36).substring(2, 9);
        localStorage.setItem("closedesk_anon_id", id);
      }
      return id;
    } catch (_) {
      return "vis_" + Date.now();
    }
  }

  const anonId = getAnonVisitorId();

  // 4. Device Identification
  function getReadableDeviceName() {
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/i.test(ua)) return "iOS Device";
    if (/Android/i.test(ua)) return "Android Mobile";
    if (/Windows/i.test(ua)) return "Windows PC";
    if (/Macintosh|Mac OS X/i.test(ua)) return "Macintosh";
    if (/Linux/i.test(ua)) return "Linux PC";
    return "Desktop PC";
  }

  // 5. Host Website Visit Tracking (Multi-Tenant Scoped)
  function trackHostVisit() {
    try {
      const payload = {
        event_type: "page_view",
        tenant_id: tenantId,
        anonId: anonId,
        username: "Visitor_" + anonId.substring(4, 12),
        deviceName: getReadableDeviceName(),
        pagePath: window.location.pathname + window.location.search,
        hostUrl: window.location.origin,
        referrer: document.referrer || "Direct",
        details: document.title || "Host Website Page",
      };

      if (navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify(payload)], {
          type: "application/json",
        });
        navigator.sendBeacon(baseUrl + "/api/analytics", blob);
      } else {
        fetch(baseUrl + "/api/analytics", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-tenant-id": tenantId,
          },
          body: JSON.stringify(payload),
          keepalive: true,
        }).catch(function () {});
      }
    } catch (_) {}
  }

  trackHostVisit();

  // 6. Create Floating Widget Container
  // Initial size is set to the collapsed launcher size (280px x 96px) to avoid blocking host content.
  const container = document.createElement("div");
  container.id = "closedesk-widget-container";
  container.style.cssText =
    "position: fixed; bottom: 20px; right: 20px; z-index: 2147483647; width: 280px; height: 96px; max-width: 95vw; max-height: 95vh; pointer-events: none; background: transparent !important; transition: width 0.3s cubic-bezier(0.16, 1, 0.3, 1), height 0.3s cubic-bezier(0.16, 1, 0.3, 1), bottom 0.3s cubic-bezier(0.16, 1, 0.3, 1), right 0.3s cubic-bezier(0.16, 1, 0.3, 1); display: flex; flex-direction: column; justify-content: flex-end; align-items: flex-end; overflow: visible;";

  // 7. Create Headless Iframe
  const iframe = document.createElement("iframe");
  iframe.id = "closedesk-chat-frame";
  iframe.src = `${baseUrl}/embed/chatbot?tenant=${encodeURIComponent(
    tenantId
  )}&anonId=${encodeURIComponent(anonId)}&host=${encodeURIComponent(
    window.location.origin
  )}`;
  iframe.allow = "microphone; camera; autoplay";
  iframe.setAttribute("allowtransparency", "true");
  iframe.style.cssText =
    "width: 100%; height: 100%; border: none; background: transparent !important; pointer-events: auto; color-scheme: normal; display: block; overflow: hidden;";

  container.appendChild(iframe);

  // 8. Mount when DOM is ready
  function mount() {
    if (!document.body) {
      window.addEventListener("DOMContentLoaded", mount);
      return;
    }
    document.body.appendChild(container);
  }

  mount();

  // 9. Handle Responsive Resizing via PostMessage
  window.addEventListener("message", function (event) {
    if (!event.data || typeof event.data !== "object") return;
    if (event.data.type === "CLOSEDESK_WIDGET_RESIZE") {
      const isMobile = window.innerWidth < 640;
      if (event.data.isExpanded) {
        if (isMobile) {
          container.style.width = "100vw";
          container.style.height = "100vh";
          container.style.maxWidth = "100vw";
          container.style.maxHeight = "100vh";
          container.style.bottom = "0px";
          container.style.right = "0px";
        } else {
          container.style.width = "420px";
          container.style.height = "720px";
          container.style.maxWidth = "95vw";
          container.style.maxHeight = "95vh";
          container.style.bottom = "20px";
          container.style.right = "20px";
        }
      } else {
        const isPeek = !!event.data.hasPeek;
        container.style.width = isPeek ? "330px" : "280px";
        container.style.height = isPeek ? "260px" : "96px";
        container.style.maxWidth = "95vw";
        container.style.maxHeight = "95vh";
        container.style.bottom = "20px";
        container.style.right = "20px";
      }
    }
  });
})();
