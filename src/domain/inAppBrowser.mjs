// Detección de navegadores integrados (SPEC 029). Google bloquea el ingreso
// con OAuth desde ellos (error 403 disallowed_useragent), así que Login no
// ofrece el botón de Google y pide abrir la página en Chrome o Safari.
// Función pura por user agent: no accede a `navigator`.
const IN_APP_PATTERNS = Object.freeze([
  { name: "Instagram", test: /Instagram/i },
  { name: "Messenger", test: /Orca-Android|MessengerLite|FBAN\/Messenger|\bMessenger\b/i },
  { name: "Facebook", test: /FBAN|FBAV|FB_IAB|FBIOS/i },
  { name: "WhatsApp", test: /WhatsApp/i },
  { name: "LinkedIn", test: /LinkedInApp/i },
  { name: "TikTok", test: /musical_ly|BytedanceWebview|TikTok|\bTrill\b/i },
  { name: "Snapchat", test: /Snapchat/i },
  { name: "Line", test: /\bLine\//i },
]);

// WebView de Android: el user agent marca "; wv)". WebView de iOS (WKWebView):
// es iPhone/iPad con AppleWebKit pero sin el token "Safari/" que sí traen
// Safari, Chrome (CriOS), Firefox (FxiOS) y Edge (EdgiOS).
const ANDROID_WEBVIEW = /Android[^)]*;\s*wv\)/i;
const IOS_DEVICE = /\b(iPhone|iPad|iPod)\b/i;
const APPLE_WEBKIT = /AppleWebKit/i;
const SAFARI_TOKEN = /Safari\//i;

export function detectInAppBrowser(userAgent) {
  const ua = typeof userAgent === "string" ? userAgent : "";
  if (!ua) return { isInAppBrowser: false, name: null };

  const app = IN_APP_PATTERNS.find((pattern) => pattern.test.test(ua));
  if (app) return { isInAppBrowser: true, name: app.name };

  if (ANDROID_WEBVIEW.test(ua)) {
    return { isInAppBrowser: true, name: "WebView de Android" };
  }
  if (IOS_DEVICE.test(ua) && APPLE_WEBKIT.test(ua) && !SAFARI_TOKEN.test(ua)) {
    return { isInAppBrowser: true, name: "WebView de iOS" };
  }
  return { isInAppBrowser: false, name: null };
}
