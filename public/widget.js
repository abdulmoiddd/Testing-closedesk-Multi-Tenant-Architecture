/**
 * CloseDesk Universal Embeddable Widget SDK
 * Allows embedding the CloseDesk Multimodal AI Front-Desk on ANY website.
 *
 * Features:
 * - Automatic Host Website Visit Tracking (page_view) scoped to tenant_id
 * - Universal Cookie Consent Banner & Visitor Telemetry for Pulse Dashboard (/lg)
 * - Real-Time Geolocation & IP Resolution for Google Radar Map Pins
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

  // Never run widget or banner inside the Pulse Dashboard (/lg)
  if (
    window.location.pathname === "/lg" ||
    window.location.pathname.startsWith("/lg/")
  ) {
    return;
  }

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
    const ua = navigator.userAgent || "";
    let os = "Desktop PC";
    let type = "Desktop";

    if (/Windows/i.test(ua)) os = "Windows PC";
    else if (/Macintosh|Mac OS X/i.test(ua)) os = "Macintosh";
    else if (/Android/i.test(ua)) {
      os = "Android Mobile";
      type = "Mobile";
    } else if (/iPhone|iPad|iPod/i.test(ua)) {
      os = "iOS Device";
      type = "Mobile";
    } else if (/Linux/i.test(ua)) os = "Linux PC";

    if (/Tablet|iPad/i.test(ua)) type = "Tablet";

    return `${os} (${type})`;
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

  // ──────────────────────────────────────────────────────────────────────────
  // 6. Geolocation & IP Telemetry Services
  // ──────────────────────────────────────────────────────────────────────────

  function getUserLocation() {
    return new Promise(function (resolve) {
      if (typeof window === "undefined" || !navigator.geolocation) {
        resolve({ status: "unsupported", lat: null, lng: null });
        return;
      }

      navigator.geolocation.getCurrentPosition(
        function (position) {
          resolve({
            status: "allowed",
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
          });
        },
        function (error) {
          resolve({
            status: "rejected",
            error: error ? error.message : "denied",
            lat: null,
            lng: null,
          });
        },
        { timeout: 8000, enableHighAccuracy: true, maximumAge: 60000 }
      );
    });
  }

  function getIpAndLocation() {
    return new Promise(function (resolve) {
      const controller =
        typeof AbortController !== "undefined" ? new AbortController() : null;
      const timeoutId = setTimeout(function () {
        if (controller) controller.abort();
        resolve({
          ip: "unknown",
          city: "Unknown",
          region: "Unknown",
          country: "Unknown",
          lat: null,
          lng: null,
        });
      }, 4000);

      fetch("https://ipinfo.io/json", {
        signal: controller ? controller.signal : undefined,
      })
        .then(function (res) {
          if (!res.ok) throw new Error("ipinfo error");
          return res.json();
        })
        .then(function (data) {
          clearTimeout(timeoutId);
          let lat = null,
            lng = null;
          if (data && data.loc) {
            const parts = data.loc.split(",");
            lat = parseFloat(parts[0]);
            lng = parseFloat(parts[1]);
          }
          resolve({
            ip: (data && data.ip) || "unknown",
            city: (data && data.city) || "Unknown",
            region: (data && data.region) || "Unknown",
            country: (data && data.country) || "Unknown",
            lat: isNaN(lat) ? null : lat,
            lng: isNaN(lng) ? null : lng,
          });
        })
        .catch(function () {
          // Fallback to secondary IP geolocation if ipinfo is blocked or failed
          fetch("https://freeipapi.com/api/json", {
            signal: controller ? controller.signal : undefined,
          })
            .then(function (res) {
              if (!res.ok) throw new Error("freeipapi error");
              return res.json();
            })
            .then(function (fallback) {
              clearTimeout(timeoutId);
              resolve({
                ip: fallback.ipAddress || "unknown",
                city: fallback.cityName || "Unknown",
                region: fallback.regionName || "Unknown",
                country: fallback.countryName || "Unknown",
                lat: fallback.latitude ? parseFloat(fallback.latitude) : null,
                lng: fallback.longitude ? parseFloat(fallback.longitude) : null,
              });
            })
            .catch(function () {
              clearTimeout(timeoutId);
              resolve({
                ip: "unknown",
                city: "Unknown",
                region: "Unknown",
                country: "Unknown",
                lat: null,
                lng: null,
              });
            });
        });
    });
  }

  function sendCookieConsentPayload(consentStatus, locationData, ipData) {
    try {
      // Prioritize precise GPS coordinates; if denied/unavailable, fallback to IP coordinates
      const effectiveLat =
        locationData && locationData.lat != null
          ? Number(locationData.lat)
          : ipData && ipData.lat != null
          ? Number(ipData.lat)
          : null;

      const effectiveLng =
        locationData && locationData.lng != null
          ? Number(locationData.lng)
          : ipData && ipData.lng != null
          ? Number(ipData.lng)
          : null;

      const effectiveStatus =
        consentStatus === "accepted"
          ? effectiveLat != null
            ? "allowed"
            : locationData && locationData.status
            ? locationData.status
            : "unsupported"
          : "rejected";

      const payload = {
        anonId: anonId,
        username: "Visitor_" + anonId.substring(4, 12),
        deviceName: getReadableDeviceName(),
        consentStatus: consentStatus,
        ipAddress: (ipData && ipData.ip) || "unknown",
        ipLocation: ipData || {},
        location: {
          status: effectiveStatus,
          lat: effectiveLat,
          lng: effectiveLng,
        },
        language: navigator.language || "en-US",
        timeZone:
          Intl && Intl.DateTimeFormat
            ? Intl.DateTimeFormat().resolvedOptions().timeZone
            : "UTC",
        rawUserAgent: navigator.userAgent || "unknown",
        hostUrl: window.location.origin,
        pagePath: window.location.pathname + window.location.search,
        tenant_id: tenantId,
      };

      const endpoint = baseUrl + "/api/cookie-consent";
      if (navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify(payload)], {
          type: "application/json",
        });
        navigator.sendBeacon(endpoint, blob);
      } else {
        fetch(endpoint, {
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

  // ──────────────────────────────────────────────────────────────────────────
  // 7. Cookie Consent Banner UI & Lifecycle
  // ──────────────────────────────────────────────────────────────────────────

  const CONSENT_STORAGE_KEY = "closedesk_cookie_consent";

  function getStoredConsent() {
    try {
      const stored = localStorage.getItem(CONSENT_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (_) {}
    return null;
  }

  function setStoredConsent(status) {
    try {
      const data = { status: status, timestamp: Date.now() };
      localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(data));
      // Also write first-party cookie for cross-subdomain resilience
      document.cookie = `closedesk_cookie_consent=${encodeURIComponent(
        status
      )}; max-age=31536000; path=/; SameSite=Lax`;
    } catch (_) {}
  }

  function injectBannerStyles() {
    if (document.getElementById("closedesk-cookie-styles")) return;
    const style = document.createElement("style");
    style.id = "closedesk-cookie-styles";
    style.textContent = `
      #closedesk-cookie-banner {
        position: fixed;
        bottom: 24px;
        left: 24px;
        width: 380px;
        max-width: calc(100vw - 32px);
        z-index: 2147483646;
        background: rgba(13, 17, 23, 0.96) !important;
        backdrop-filter: blur(16px) !important;
        -webkit-backdrop-filter: blur(16px) !important;
        border: 1px solid rgba(255, 255, 255, 0.14) !important;
        border-radius: 20px !important;
        box-shadow: 0 20px 45px -10px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.06) !important;
        padding: 20px !important;
        color: #f1f5f9 !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
        font-size: 14px !important;
        line-height: 1.5 !important;
        box-sizing: border-box !important;
        opacity: 0;
        transform: translateY(16px) scale(0.96);
        transition: opacity 0.35s cubic-bezier(0.16, 1, 0.3, 1), transform 0.35s cubic-bezier(0.16, 1, 0.3, 1) !important;
        pointer-events: auto !important;
      }
      #closedesk-cookie-banner * {
        box-sizing: border-box !important;
      }
      #closedesk-cookie-banner.closedesk-visible {
        opacity: 1 !important;
        transform: translateY(0) scale(1) !important;
      }
      #closedesk-cookie-banner button {
        font-family: inherit !important;
        outline: none !important;
      }
      #closedesk-cookie-banner .cd-accept-btn:hover {
        filter: brightness(1.1);
        box-shadow: 0 6px 20px rgba(124, 58, 237, 0.5) !important;
        transform: translateY(-1px);
      }
      #closedesk-cookie-banner .cd-reject-btn:hover {
        background: rgba(255, 255, 255, 0.12) !important;
        color: #ffffff !important;
      }
      #closedesk-cookie-banner .cd-close-btn:hover {
        color: #ffffff !important;
      }
      @media (max-width: 640px) {
        #closedesk-cookie-banner {
          bottom: 12px !important;
          left: 12px !important;
          right: 12px !important;
          width: auto !important;
          max-width: calc(100vw - 24px) !important;
          padding: 18px !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function showCookieBanner() {
    if (document.getElementById("closedesk-cookie-banner")) return;
    injectBannerStyles();

    const banner = document.createElement("div");
    banner.id = "closedesk-cookie-banner";
    banner.innerHTML = `
      <div style="display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 12px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="width: 36px; height: 36px; border-radius: 12px; background: linear-gradient(135deg, rgba(139, 92, 246, 0.25), rgba(59, 130, 246, 0.25)); border: 1px solid rgba(139, 92, 246, 0.4); display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0;">
            🍪
          </div>
          <div>
            <div style="font-weight: 700; font-size: 15px; color: #ffffff; letter-spacing: -0.01em;">Cookie & Location Policy</div>
            <div style="font-size: 11px; color: #a855f7; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Security & Telemetry</div>
          </div>
        </div>
        <button id="closedesk-cookie-close" class="cd-close-btn" aria-label="Close" style="background: none; border: none; color: #64748b; font-size: 18px; cursor: pointer; padding: 4px; line-height: 1; border-radius: 6px; transition: color 0.15s;">✕</button>
      </div>

      <p style="margin: 0 0 16px 0; font-size: 13px; color: #94a3b8; line-height: 1.55;">
        We use essential cookies and log basic device telemetry (including optional location access) to verify platform security and deliver responsive AI dispatch services.
      </p>

      <div style="display: flex; flex-direction: column; gap: 8px;">
        <button id="closedesk-cookie-accept" class="cd-accept-btn" style="width: 100%; padding: 11px 16px; border-radius: 12px; font-size: 13.5px; font-weight: 600; color: #ffffff; background: linear-gradient(135deg, #7c3aed, #4f46e5); border: none; cursor: pointer; box-shadow: 0 4px 14px rgba(124, 58, 237, 0.35); transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 6px;">
          <span>Accept All Cookies</span>
        </button>
        <button id="closedesk-cookie-reject" class="cd-reject-btn" style="width: 100%; padding: 9px 16px; border-radius: 12px; font-size: 13px; font-weight: 500; color: #cbd5e1; background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.1); cursor: pointer; transition: all 0.2s;">
          Reject Non-Essential
        </button>
      </div>
    `;

    function closeBanner() {
      banner.classList.remove("closedesk-visible");
      setTimeout(function () {
        if (banner.parentNode) {
          banner.parentNode.removeChild(banner);
        }
      }, 350);
    }

    // Attach Click Handlers
    const acceptBtn = banner.querySelector("#closedesk-cookie-accept");
    const rejectBtn = banner.querySelector("#closedesk-cookie-reject");
    const closeBtn = banner.querySelector("#closedesk-cookie-close");

    acceptBtn.addEventListener("click", async function () {
      acceptBtn.disabled = true;
      rejectBtn.disabled = true;
      acceptBtn.innerHTML = `<span>Saving preferences...</span>`;

      setStoredConsent("accepted");

      // Request precise GPS and fetch IP data concurrently
      const [locationData, ipData] = await Promise.all([
        getUserLocation(),
        getIpAndLocation(),
      ]);

      sendCookieConsentPayload("accepted", locationData, ipData);
      closeBanner();
    });

    rejectBtn.addEventListener("click", function () {
      acceptBtn.disabled = true;
      rejectBtn.disabled = true;

      setStoredConsent("rejected");

      sendCookieConsentPayload(
        "rejected",
        { status: "rejected", lat: null, lng: null },
        { ip: "unknown" }
      );
      closeBanner();
    });

    closeBtn.addEventListener("click", function () {
      closeBanner();
    });

    document.body.appendChild(banner);

    // Trigger smooth enter animation
    setTimeout(function () {
      banner.classList.add("closedesk-visible");
    }, 100);
  }

  // Silent ping for returning visitors who previously accepted
  async function executeSilentTelemetry() {
    try {
      const ipData = await getIpAndLocation();
      sendCookieConsentPayload(
        "accepted",
        {
          status: "allowed",
          lat: ipData.lat || null,
          lng: ipData.lng || null,
        },
        ipData
      );
    } catch (_) {}
  }

  // Evaluate consent state on boot
  function initCookieConsent() {
    const consent = getStoredConsent();
    if (consent && consent.status === "accepted") {
      // User previously accepted; refresh telemetry silently to light up Radar Map
      executeSilentTelemetry();
    } else {
      // User has not consented or previously rejected: present banner
      setTimeout(showCookieBanner, 600);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 8. Create Floating Widget Container & Embedded Iframe
  // ──────────────────────────────────────────────────────────────────────────

  const container = document.createElement("div");
  container.id = "closedesk-widget-container";
  container.style.cssText =
    "position: fixed; bottom: 20px; right: 20px; z-index: 2147483647; width: 280px; height: 96px; max-width: 95vw; max-height: 95vh; pointer-events: none; background: transparent !important; transition: width 0.3s cubic-bezier(0.16, 1, 0.3, 1), height 0.3s cubic-bezier(0.16, 1, 0.3, 1), bottom 0.3s cubic-bezier(0.16, 1, 0.3, 1), right 0.3s cubic-bezier(0.16, 1, 0.3, 1); display: flex; flex-direction: column; justify-content: flex-end; align-items: flex-end; overflow: visible;";

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

  // 9. Mount when DOM is ready
  function mount() {
    if (!document.body) {
      window.addEventListener("DOMContentLoaded", mount);
      return;
    }
    document.body.appendChild(container);
    initCookieConsent();
  }

  mount();

  // 10. Handle Responsive Resizing via PostMessage
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
