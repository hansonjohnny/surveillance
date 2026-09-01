import type { Location } from "@/types";
import { Crosshair, Minus, Moon, Plus, Sun } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Linking, Platform, Text, TouchableOpacity, View } from "react-native";
import WebView, { type WebViewMessageEvent } from "react-native-webview";

const MAPTILER_KEY = process.env.EXPO_PUBLIC_MAPTILER_API_KEY;

function buildHtml(lat: number, lng: number) {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
html, body { width:100%; height:100%; overflow:hidden; background:#0d0d14; }
#map { position:relative; width:100%; height:100%; overflow:hidden; touch-action:none; }
#tiles { position:absolute; top:0; left:0; filter:sepia(1) hue-rotate(165deg) saturate(4) brightness(1.3); transition:filter 0.3s; }
#marker { position:absolute; transform:translate(-50%,-50%); z-index:10; cursor:pointer; }
.dot  { width:14px; height:14px; border-radius:50%; background:#00E5FF;
        box-shadow:0 0 12px 4px rgba(0,229,255,0.7); position:relative; z-index:2; }
.ring { position:absolute; top:50%; left:50%; width:14px; height:14px; border-radius:50%;
        background:rgba(0,229,255,0.35); transform:translate(-50%,-50%);
        animation:pulse 2s ease-out infinite; }
@keyframes pulse {
  0%   { transform:translate(-50%,-50%) scale(1); opacity:0.6; }
  100% { transform:translate(-50%,-50%) scale(3); opacity:0;   }
}
</style>
</head>
<body>
<div id="map">
  <div id="tiles"></div>
  <canvas id="pathCanvas" style="position:absolute;top:0;left:0;z-index:1;pointer-events:none;"></canvas>
  <div id="marker">
    <div style="position:relative;width:32px;height:32px;display:flex;align-items:center;justify-content:center;">
      <div class="ring"></div>
      <div class="dot"></div>
    </div>
  </div>
</div>
<script>
var TILE = 256;
var zoom = 17;
var centerLat = ${lat};
var centerLng = ${lng};
var actualLat = ${lat};
var actualLng = ${lng};
var following = true;
var isDark = true;

function lng2x(ln, z) { return (ln + 180) / 360 * Math.pow(2, z) * TILE; }
function lat2y(la, z) {
  var r = la * Math.PI / 180;
  return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * Math.pow(2, z) * TILE;
}
function x2lng(x, z) { return x / (Math.pow(2, z) * TILE) * 360 - 180; }
function y2lat(y, z) {
  return Math.atan(Math.sinh(Math.PI * (1 - 2 * y / (Math.pow(2, z) * TILE)))) * 180 / Math.PI;
}
function tileUrl(tx, ty, z) {
  var style = isDark ? 'dataviz-dark' : 'dataviz';
  return 'https://api.maptiler.com/maps/' + style + '/256/' + z + '/' + tx + '/' + ty + '.png?key=${MAPTILER_KEY}';
}
function applyTheme() {
  var t = document.getElementById('tiles');
  t.style.filter = isDark
    ? 'sepia(1) hue-rotate(165deg) saturate(4) brightness(1.3)'
    : 'none';
  document.body.style.background = isDark ? '#0d0d14' : '#e8e4de';
}

// ── Path trail (breadcrumb of recorded GPS points, colored by risk level) ────
var pathPoints = [];
var pathCanvas = document.getElementById('pathCanvas');
var pathCtx = pathCanvas.getContext('2d');
function resizeCanvas() {
  pathCanvas.width = window.innerWidth;
  pathCanvas.height = window.innerHeight;
}
function riskColor(level) {
  if (level === 'high') return '#FF3D3D';
  if (level === 'medium') return '#FFD740';
  if (level === 'low') return '#00E676';
  return '#00E5FF';
}
function renderPath() {
  if (!pathCtx || pathCanvas.width === 0) return;
  pathCtx.clearRect(0, 0, pathCanvas.width, pathCanvas.height);
  if (pathPoints.length === 0) return;
  var cpx = lng2x(centerLng, zoom);
  var cpy = lat2y(centerLat, zoom);
  var vpLeft = cpx - pathCanvas.width / 2;
  var vpTop = cpy - pathCanvas.height / 2;
  var coords = pathPoints.map(function(p) {
    return {
      x: lng2x(p.lng, zoom) - vpLeft,
      y: lat2y(p.lat, zoom) - vpTop,
      risk: p.riskLevel,
    };
  });
  pathCtx.lineWidth = 3;
  pathCtx.lineJoin = 'round';
  pathCtx.lineCap = 'round';
  pathCtx.globalAlpha = 0.85;
  for (var i = 1; i < coords.length; i++) {
    pathCtx.strokeStyle = riskColor(coords[i - 1].risk);
    pathCtx.beginPath();
    pathCtx.moveTo(coords[i - 1].x, coords[i - 1].y);
    pathCtx.lineTo(coords[i].x, coords[i].y);
    pathCtx.stroke();
  }
  // Dot at each breadcrumb — keeps the trail visible even before enough
  // ground distance has been covered to see a line.
  pathCtx.globalAlpha = 0.9;
  coords.forEach(function(c) {
    pathCtx.fillStyle = riskColor(c.risk);
    pathCtx.beginPath();
    pathCtx.arc(c.x, c.y, 2.5, 0, Math.PI * 2);
    pathCtx.fill();
  });
}

function render() {
  var W = window.innerWidth;
  var H = window.innerHeight;
  if (!W || !H) return;
  var tiles  = document.getElementById('tiles');
  var marker = document.getElementById('marker');
  var cpx = lng2x(centerLng, zoom);
  var cpy = lat2y(centerLat, zoom);
  var vpLeft = cpx - W / 2;
  var vpTop  = cpy - H / 2;
  var maxT = Math.pow(2, zoom);
  var tx0 = Math.floor(vpLeft / TILE) - 1;
  var ty0 = Math.floor(vpTop  / TILE) - 1;
  var tx1 = Math.ceil((vpLeft + W) / TILE) + 1;
  var ty1 = Math.ceil((vpTop  + H) / TILE) + 1;
  tiles.innerHTML = '';
  for (var tx = tx0; tx <= tx1; tx++) {
    for (var ty = ty0; ty <= ty1; ty++) {
      if (ty < 0 || ty >= maxT) continue;
      var wtx = ((tx % maxT) + maxT) % maxT;
      var img = document.createElement('img');
      img.src = tileUrl(wtx, ty, zoom);
      img.style.cssText = 'position:absolute;width:256px;height:256px;'
        + 'left:' + Math.round(tx * TILE - vpLeft) + 'px;'
        + 'top:'  + Math.round(ty * TILE - vpTop)  + 'px;';
      tiles.appendChild(img);
    }
  }
  marker.style.left = Math.round(lng2x(actualLng, zoom) - vpLeft) + 'px';
  marker.style.top  = Math.round(lat2y(actualLat, zoom) - vpTop)  + 'px';
  renderPath();
}

// Touch pan
var drag = false, pinch = false;
var t0x = 0, t0y = 0, startCLat, startCLng;
var pinchDist0 = 0, pinchZoom0 = zoom;
function touchDist(e) {
  return Math.hypot(e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY);
}
document.addEventListener('touchstart', function(e) {
  e.preventDefault();
  if (e.touches.length === 1) {
    drag = true; pinch = false;
    t0x = e.touches[0].clientX; t0y = e.touches[0].clientY;
    startCLat = centerLat; startCLng = centerLng;
  } else if (e.touches.length === 2) {
    drag = false; pinch = true;
    pinchDist0 = touchDist(e); pinchZoom0 = zoom;
  }
}, { passive: false });
document.addEventListener('touchmove', function(e) {
  e.preventDefault();
  if (drag && e.touches.length === 1) {
    following = false;
    var dx = e.touches[0].clientX - t0x;
    var dy = e.touches[0].clientY - t0y;
    centerLng = x2lng(lng2x(startCLng, zoom) - dx, zoom);
    centerLat = y2lat(lat2y(startCLat, zoom) - dy, zoom);
    render();
  } else if (pinch && e.touches.length === 2) {
    var nz = Math.round(pinchZoom0 + Math.log2(touchDist(e) / pinchDist0));
    nz = Math.max(2, Math.min(19, nz));
    if (nz !== zoom) { zoom = nz; render(); }
  }
}, { passive: false });
document.addEventListener('touchend', function() { drag = false; pinch = false; }, { passive: true });

// Marker tap → open Google Maps
var markerEl = document.getElementById('marker');
markerEl.addEventListener('touchstart', function(e) { e.stopPropagation(); }, { passive: false });
markerEl.addEventListener('touchend', function(e) {
  e.stopPropagation();
  var msg = JSON.stringify({ type: 'openMaps', lat: actualLat, lng: actualLng });
  // Native WebView: window.ReactNativeWebView.postMessage is how the app
  // receives messages (onMessage prop). On web this same HTML runs inside
  // a plain <iframe> instead (see LiveMap.tsx), which has no such bridge —
  // fall back to standard window.postMessage to the parent frame there.
  if (window.ReactNativeWebView) { window.ReactNativeWebView.postMessage(msg); }
  else if (window.parent) { window.parent.postMessage(msg, '*'); }
}, { passive: false });

// ── Exposed functions called via injectJavaScript ───────────────────────────
window.zoomIn     = function() { zoom = Math.min(19, zoom + 1); render(); };
window.zoomOut    = function() { zoom = Math.max(2,  zoom - 1); render(); };
window.recenter   = function() { following = true; centerLat = actualLat; centerLng = actualLng; render(); };
window.toggleTheme = function() { isDark = !isDark; applyTheme(); render(); };
window.updateLocation = function(la, ln) {
  actualLat = la; actualLng = ln;
  if (following) { centerLat = la; centerLng = ln; }
  render();
};
window.setPath = function(points) {
  pathPoints = points;
  render();
};

resizeCanvas();
setTimeout(function() { resizeCanvas(); render(); }, 300);
window.addEventListener('resize', function() { resizeCanvas(); render(); });

// Native drives the functions above directly via injectJavaScript, which
// evaluates JS straight into this context — this listener is never
// triggered there. It exists only for the web <iframe> path (see
// LiveMap.tsx), which has no injectJavaScript equivalent and talks to
// this page over postMessage instead.
window.addEventListener('message', function(e) {
  var data = e.data;
  if (!data || typeof data !== 'object') return;
  if (data.type === 'updateLocation') window.updateLocation(data.lat, data.lng);
  else if (data.type === 'setPath') window.setPath(data.points);
  else if (data.type === 'zoomIn') window.zoomIn();
  else if (data.type === 'zoomOut') window.zoomOut();
  else if (data.type === 'recenter') window.recenter();
  else if (data.type === 'toggleTheme') window.toggleTheme();
});
</script>
</body>
</html>`;
}

type PathPoint = {
  lat: number;
  lng: number;
  riskLevel?: "low" | "medium" | "high" | null;
};
type Props = { location: Location | null; path?: PathPoint[] };

// react-native-webview has no web implementation at all (its own web
// fallback just renders "does not support this platform" text — verified
// in node_modules/react-native-webview/src/WebView.tsx) — the same
// self-contained HTML this builds for native runs on web too, just inside
// a plain <iframe> instead, with postMessage standing in for
// injectJavaScript/onMessage (neither of which exist on an iframe). See
// the "message" listener/postMessage fallback inside buildHtml's own
// script above for the other half of this bridge.
const isWeb = Platform.OS === "web";

export function LiveMap({ location, path = [] }: Props) {
  const webViewRef = useRef<WebView>(null);
  // Untyped ref (not HTMLIFrameElement) -- this project's tsconfig doesn't
  // pull in DOM lib types (a React Native app has no DOM on native), so a
  // real DOM element type isn't available to reference here. Only ever
  // read on the isWeb branch below.
  const iframeRef = useRef<any>(null);
  // Capture the first real GPS fix once — prevents WebView source from
  // being rebuilt on subsequent location updates, which would reload the map.
  const initialRef = useRef<{ lat: number; lng: number } | null>(null);
  if (location && !initialRef.current) {
    initialRef.current = { lat: location.lat, lng: location.lng };
  }
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    if (!location) return;
    if (isWeb) {
      iframeRef.current?.contentWindow?.postMessage(
        { type: "updateLocation", lat: location.lat, lng: location.lng },
        "*",
      );
      return;
    }
    if (!webViewRef.current) return;
    webViewRef.current.injectJavaScript(
      `window.updateLocation(${location.lat}, ${location.lng}); true;`,
    );
  }, [location]);

  useEffect(() => {
    if (path.length === 0) return;
    const points = path.map((p) => ({
      lat: p.lat,
      lng: p.lng,
      riskLevel: p.riskLevel ?? null,
    }));
    if (isWeb) {
      iframeRef.current?.contentWindow?.postMessage({ type: "setPath", points }, "*");
      return;
    }
    if (!webViewRef.current) return;
    webViewRef.current.injectJavaScript(`window.setPath(${JSON.stringify(points)}); true;`);
  }, [path]);

  // Web equivalent of the native onMessage prop — listens for the same
  // { type: 'openMaps', ... } message buildHtml's script sends, just over
  // window.postMessage instead of the WebView bridge.
  useEffect(() => {
    if (!isWeb) return;
    function onMessage(e: MessageEvent) {
      try {
        const msg = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        if (msg?.type === "openMaps") {
          Linking.openURL(`https://maps.google.com/?q=${msg.lat},${msg.lng}`);
        }
      } catch {}
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Show a placeholder until the first GPS fix arrives.
  if (!initialRef.current) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0d0d14",
        }}
      >
        <Text style={{ color: "#555568", fontSize: 14 }}>
          Waiting for GPS...
        </Text>
      </View>
    );
  }

  // fn is one of the window.* function names buildHtml's script exposes
  // (e.g. "window.zoomIn") -- native evaluates it directly via
  // injectJavaScript; web posts the matching message type instead (see
  // the "message" listener inside buildHtml's script).
  function inject(fn: string) {
    if (isWeb) {
      const type = fn.replace("window.", "");
      iframeRef.current?.contentWindow?.postMessage({ type }, "*");
      return;
    }
    webViewRef.current?.injectJavaScript(`${fn}(); true;`);
  }

  function handleMessage(e: WebViewMessageEvent) {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === "openMaps") {
        Linking.openURL(`https://maps.google.com/?q=${msg.lat},${msg.lng}`);
      }
    } catch {}
  }

  function handleThemeToggle() {
    setIsDark((prev) => !prev);
    inject("window.toggleTheme");
  }

  return (
    <View className="flex-1">
      {isWeb ? (
        // srcDoc embeds the same self-contained HTML/JS buildHtml produces
        // for native, sandboxed the same way an <iframe> always is —
        // communication in/out goes over postMessage (see the effects and
        // inject() above), since injectJavaScript/onMessage don't exist here.
        <iframe
          ref={iframeRef}
          srcDoc={buildHtml(initialRef.current.lat, initialRef.current.lng)}
          style={{ flex: 1, border: "none", backgroundColor: "#0d0d14" }}
        />
      ) : (
        <WebView
          ref={webViewRef}
          className="flex-1"
          style={{ backgroundColor: "#0d0d14" }}
          source={{
            html: buildHtml(initialRef.current.lat, initialRef.current.lng),
            baseUrl: "https://maptiler.com",
          }}
          scrollEnabled={false}
          bounces={false}
          originWhitelist={["*"]}
          javaScriptEnabled
          domStorageEnabled
          mixedContentMode="always"
          onMessage={handleMessage}
        />
      )}

      {/* Map controls — NativeWind overlay */}
      <View className="absolute right-4 bottom-12 gap-2">
        {/* Theme toggle */}
        <TouchableOpacity
          onPress={handleThemeToggle}
          className="w-11 h-11 rounded-xl items-center justify-center border border-white/20"
          style={{ backgroundColor: "rgba(10,10,15,0.88)" }}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Toggle theme"
        >
          {isDark ? (
            <Sun size={18} color="#00E5FF" strokeWidth={1.5} />
          ) : (
            <Moon size={18} color="#f0f0f5" strokeWidth={1.5} />
          )}
        </TouchableOpacity>

        {/* Zoom in */}
        <TouchableOpacity
          onPress={() => inject("window.zoomIn")}
          className="w-11 h-11 rounded-xl items-center justify-center border border-white/20"
          style={{ backgroundColor: "rgba(10,10,15,0.88)" }}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Zoom in"
        >
          <Plus size={20} color="#f0f0f5" strokeWidth={1.5} />
        </TouchableOpacity>

        {/* Zoom out */}
        <TouchableOpacity
          onPress={() => inject("window.zoomOut")}
          className="w-11 h-11 rounded-xl items-center justify-center border border-white/20"
          style={{ backgroundColor: "rgba(10,10,15,0.88)" }}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Zoom out"
        >
          <Minus size={20} color="#f0f0f5" strokeWidth={1.5} />
        </TouchableOpacity>

        {/* Recenter */}
        <TouchableOpacity
          onPress={() => inject("window.recenter")}
          className="w-11 h-11 rounded-xl items-center justify-center border border-white/20"
          style={{ backgroundColor: "rgba(10,10,15,0.88)" }}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Recenter map"
        >
          <Crosshair size={18} color="#00E5FF" strokeWidth={1.5} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
