"use client";

import React, { useState, useMemo, memo, useRef, useEffect, useCallback } from "react";
import { APIProvider, Map, AdvancedMarker, useMap } from "@vis.gl/react-google-maps";

// High-Tech Custom Marker with Sonar Radar Wave Rings
const CustomGoogleMarker = memo(({ cookie, isJustNow, isActive, onMarkerClick }) => {
  // 1. Instantly fallback to the IP location data we already saved to avoid loading lag
  const fallbackLocation = cookie.ipLocation?.city 
    ? `${cookie.ipLocation.city}, ${cookie.ipLocation.country || ""}`.replace(/,\s*$/, "")
    : "";

  const [placeName, setPlaceName] = useState(fallbackLocation);
  const [isLoading, setIsLoading] = useState(!fallbackLocation);

  useEffect(() => {
    // Only fetch if we are active AND we don't have a place name yet
    if (!isActive || placeName) {
      setIsLoading(false);
      return;
    }

    const fetchPlaceName = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${cookie.location.lat}&longitude=${cookie.location.lng}&localityLanguage=en`
        );
        if (res.ok) {
          const data = await res.json();
          const city = data.city || data.locality || data.principalSubdivision || "";
          const country = data.countryName || "";
          
          if (city || country) {
            setPlaceName([city, country].filter(Boolean).join(", "));
          } else {
            // Graceful fallback if API succeeds but has no readable city name
            setPlaceName(`Lat: ${Number(cookie.location.lat).toFixed(2)}, Lng: ${Number(cookie.location.lng).toFixed(2)}`);
          }
        } else {
          setPlaceName(`Lat: ${Number(cookie.location.lat).toFixed(2)}, Lng: ${Number(cookie.location.lng).toFixed(2)}`);
        }
      } catch (error) {
        console.error("Failed to reverse geocode for map:", error);
        setPlaceName(`Lat: ${Number(cookie.location.lat).toFixed(2)}, Lng: ${Number(cookie.location.lng).toFixed(2)}`);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchPlaceName();
  }, [isActive, cookie.location.lat, cookie.location.lng, placeName]);

  return (
    <AdvancedMarker
      position={{ lat: Number(cookie.location.lat), lng: Number(cookie.location.lng) }}
      onClick={() => onMarkerClick(cookie.id, cookie.location)}
      zIndex={isActive ? 100 : isJustNow ? 50 : 1}
    >
      <div className="relative flex flex-col items-center justify-center cursor-pointer select-none">
        {/* Multi-layered Sonar Radar Beacon Effect for Active/New Devices */}
        {isJustNow && (
          <div className="absolute top-[12px] left-[12px] -translate-x-1/2 -translate-y-1/2 pointer-events-none w-0 h-0 flex items-center justify-center">
            <div className="sonar-beacon-core" />
            <div className="sonar-wave sonar-delay-1" />
            <div className="sonar-wave sonar-delay-2" />
            <div className="sonar-wave sonar-delay-3" />
          </div>
        )}

        {/* Marker Icon Pin */}
        <div className="relative group/pin transition-transform duration-200 hover:scale-125 z-10">
          <svg width="24" height="24" viewBox="0 0 24 24">
            <path
              d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"
              fill="var(--primary)"
              stroke="var(--background)"
              strokeWidth="1.5"
            />
          </svg>
          {isJustNow && (
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 border border-white dark:border-black"></span>
            </span>
          )}
        </div>

        {/* Selected Marker Detail Card */}
        {isActive && (
          <div className="absolute bottom-[34px] flex flex-col items-center pointer-events-none bg-white dark:bg-gray-900 px-3 py-1.5 rounded-xl shadow-xl border border-gray-200 dark:border-gray-800 min-w-max animate-in fade-in zoom-in-95 duration-200 z-50">
            <span className="text-xs font-bold text-gray-900 dark:text-white tracking-wide leading-tight">{cookie.username}</span>
            <span className="text-[10px] font-semibold text-[var(--primary)] leading-tight mt-0.5">
              {placeName || (isLoading ? "Fetching location..." : "Location unknown")}
            </span>
            <div className="w-2 h-2 bg-white dark:bg-gray-900 border-r border-b border-gray-200 dark:border-gray-800 rotate-45 absolute -bottom-1 left-1/2 -translate-x-1/2"></div>
          </div>
        )}
      </div>
    </AdvancedMarker>
  );
});

// Country Heatmap using Google Maps GeoJSON Data Layer
const HeatmapLayer = memo(({ mappedCookies }) => {
  const map = useMap();
  const geoJsonLoaded = useRef(false);

  const { countryCounts, maxDeviceCount } = useMemo(() => {
    const counts = {};
    let max = 0;
    mappedCookies.forEach((cookie) => {
      const matchedCountryName = cookie.ipLocation?.country;
      if (matchedCountryName) {
        counts[matchedCountryName] = (counts[matchedCountryName] || 0) + 1;
        if (counts[matchedCountryName] > max) max = counts[matchedCountryName];
      }
    });
    return { countryCounts: counts, maxDeviceCount: max };
  }, [mappedCookies]);

  useEffect(() => {
    if (!map) return;
    if (!geoJsonLoaded.current) {
      map.data.loadGeoJson("https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json");
      geoJsonLoaded.current = true;
      map.data.addListener("click", (event) => {
        const bounds = new window.google.maps.LatLngBounds();
        event.feature.getGeometry().forEachLatLng((latLng) => {
          bounds.extend(latLng);
        });
        map.fitBounds(bounds);
      });
    }

    map.data.setStyle((feature) => {
      const countryName = feature.getProperty("name");
      const count = countryCounts[countryName] || 0;
      let fillOpacity = 0.03;
      if (count > 0) {
        const minOpacity = 0.15;
        const maxOpacity = 0.85;
        if (maxDeviceCount <= 1) {
          fillOpacity = maxOpacity;
        } else {
          fillOpacity = minOpacity + ((count - 1) / (maxDeviceCount - 1)) * (maxOpacity - minOpacity);
        }
      }
      return {
        fillColor: "var(--primary)",
        fillOpacity: fillOpacity,
        strokeColor: "var(--foreground-muted)",
        strokeOpacity: 0.15,
        strokeWeight: 0.5,
        cursor: count > 0 ? "pointer" : "default" 
      };
    });
  }, [map, countryCounts, maxDeviceCount]);

  return null;
});

export default function CookieMap({ mappedCookies, viewMode, now, activeMapMarker, setActiveMapMarker }) {
  const [mapCenter, setMapCenter] = useState({ lat: 20, lng: 0 });
  const [mapZoom, setMapZoom] = useState(3);

  // Removed the local state `const [activeMapMarker, setActiveMapMarker]` that was blocking the prop!

  const handleZoomIn = (e) => { e.stopPropagation(); setMapZoom((prev) => Math.min(prev + 1, 15)); };
  const handleZoomOut = (e) => { e.stopPropagation(); setMapZoom((prev) => Math.max(prev - 1, 2)); };
  const handleResetMap = (e) => {
    if (e) e.stopPropagation();
    setMapZoom(3);
    setMapCenter({ lat: 20, lng: 0 });
    setActiveMapMarker(null);
  };

  const handleMarkerClick = useCallback((id, location) => {
    setActiveMapMarker((prev) => (prev === id ? null : id));
    if (location) {
      setMapCenter({ lat: Number(location.lat), lng: Number(location.lng) });
      setMapZoom(14); 
    }
  }, [setActiveMapMarker]);

  return (
    <div className="lg:col-span-3 theme-glass-card border border-[var(--border-color)] rounded-3xl relative overflow-hidden flex items-center justify-center min-h-[420px] shadow-sm group bg-[var(--card-bg)]">
      
      {/* High-Tech Sonar Ripple Animations Scoped styles */}
      <style>{`
        @keyframes sonarWave {
          0% { width: 14px; height: 14px; opacity: 0.95; box-shadow: 0 0 10px 2px var(--primary); }
          50% { opacity: 0.45; }
          100% { width: 110px; height: 110px; opacity: 0; box-shadow: 0 0 25px 6px var(--primary); }
        }
        @keyframes beaconCoreBreath {
          0%, 100% { transform: scale(0.9); opacity: 0.8; }
          50% { transform: scale(1.4); opacity: 1; box-shadow: 0 0 18px 4px var(--primary); }
        }
        .sonar-beacon-core {
          position: absolute; width: 12px; height: 12px; border-radius: 9999px;
          background: var(--primary); box-shadow: 0 0 10px 2px var(--primary);
          animation: beaconCoreBreath 2s ease-in-out infinite;
        }
        .sonar-wave {
          position: absolute; border-radius: 9999px; border: 1.5px solid var(--primary);
          background: radial-gradient(circle, var(--primary) 0%, transparent 60%);
          animation: sonarWave 2.8s cubic-bezier(0.1, 0.7, 0.3, 1) infinite;
          pointer-events: none;
        }
        .sonar-delay-1 { animation-delay: 0s; }
        .sonar-delay-2 { animation-delay: 0.9s; }
        .sonar-delay-3 { animation-delay: 1.8s; }
        .gmnoprint, .gm-style-cc { display: none !important; }
      `}</style>

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,var(--primary)_0%,transparent_70%)] opacity-[0.04] pointer-events-none z-[5]"></div>

      <div className="absolute top-6 left-6 z-30 pointer-events-none bg-[var(--background)]/75 backdrop-blur-md border border-[var(--border-color)] px-4 py-3 rounded-2xl shadow-sm">
        <h3 className="text-sm font-bold text-[var(--foreground)] flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          {viewMode === "active" ? "Live Global Tracker" : "Archived Global Tracker"}
        </h3>
        <p className="text-[10px] text-[var(--foreground-muted)] mt-1 font-mono uppercase tracking-wider">
          {mappedCookies.length} nodes active
        </p>
      </div>

      <div className="absolute inset-0 z-[10]">
        <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}>
          <Map
            mapId={process.env.NEXT_PUBLIC_GOOGLE_MAP_ID}
            zoom={mapZoom}
            center={mapCenter}
            onCameraChanged={(ev) => {
              setMapZoom(ev.detail.zoom);
              setMapCenter(ev.detail.center);
            }}
            onClick={() => setActiveMapMarker(null)}
            disableDefaultUI={true}
            gestureHandling="greedy"
          >
            <HeatmapLayer mappedCookies={mappedCookies} />

            {mappedCookies.map((c) => {
              const isJustNow = now - new Date(c.updatedAt).getTime() < 60000;
              return (
                <CustomGoogleMarker
                  key={c.id}
                  cookie={c}
                  isJustNow={isJustNow}
                  isActive={activeMapMarker === c.id}
                  onMarkerClick={handleMarkerClick}
                />
              );
            })}
          </Map>
        </APIProvider>
      </div>

      {/* Map Controls */}
      <div className="absolute bottom-6 right-6 flex items-center bg-[var(--background)]/80 backdrop-blur-md border border-[var(--border-color)] rounded-full z-30 shadow-lg p-1">
        <button onClick={handleZoomIn} title="Zoom In" className="w-8 h-8 flex items-center justify-center text-[var(--foreground)] rounded-full hover:bg-[var(--card-bg)] hover:text-[var(--primary)] transition-colors cursor-pointer">
          <svg className="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
        </button>
        <div className="w-[1px] h-4 bg-[var(--border-color)] mx-1"></div>
        <button onClick={handleZoomOut} title="Zoom Out" className="w-8 h-8 flex items-center justify-center text-[var(--foreground)] rounded-full hover:bg-[var(--card-bg)] hover:text-[var(--primary)] transition-colors cursor-pointer">
          <svg className="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4" /></svg>
        </button>
        <div className="w-[1px] h-4 bg-[var(--border-color)] mx-1"></div>
        <button onClick={handleResetMap} title="Reset View" className="w-8 h-8 flex items-center justify-center text-[var(--foreground)] rounded-full hover:bg-[var(--card-bg)] hover:text-[var(--primary)] transition-colors cursor-pointer">
          <svg className="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
        </button>
      </div>
    </div>
  );
}