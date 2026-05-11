// model.js — Random Forest inference langsung di browser
// Digunakan oleh: Chrome Extension & Web App
// Model di-export dari model.pkl (25 tree, 30 fitur)
// Tidak perlu API, tidak perlu internet

const SHORTENERS = ["bit.ly","goo.gl","tinyurl","ow.ly","t.co","is.gd","shorte.st","adf.ly"];

function extractFeatures(url) {
  let parsed;
  try {
    parsed = new URL(url.startsWith("http") ? url : "https://" + url);
  } catch {
    return null;
  }

  const domain = parsed.hostname.toLowerCase();
  const urlLower = url.toLowerCase();

  const f = {};
  f.UsingIP          = /^(\d{1,3}\.){3}\d{1,3}$/.test(domain) ? 1 : -1;
  f.LongURL          = url.length >= 75 ? 1 : -1;
  f.ShortURL         = SHORTENERS.some(s => urlLower.includes(s)) ? 1 : -1;
  f["Symbol@"]       = url.includes("@") ? 1 : -1;
  f["Redirecting//"] = (url.split("//").length - 1) > 1 ? 1 : -1;
  f["PrefixSuffix-"] = domain.includes("-") ? 1 : -1;
  f.SubDomains       = (domain.split(".").length - 2) > 1 ? 1 : -1;
  f.HTTPS            = parsed.protocol === "https:" ? 1 : -1;
  f.DomainRegLen     = domain.length >= 10 ? 1 : -1;
  f.Favicon             =  1;
  f.NonStdPort          = -1;
  f.HTTPSDomainURL      =  1;
  f.RequestURL          =  1;
  f.AnchorURL           =  0;
  f.LinksInScriptTags   =  0;
  f.ServerFormHandler   = -1;
  f.InfoEmail           = urlLower.includes("mailto:") ? 1 : -1;
  f.AbnormalURL         =  1;
  f.WebsiteForwarding   = -1;
  f.StatusBarCust       = -1;
  f.DisableRightClick   = -1;
  f.UsingPopupWindow    = -1;
  f.IframeRedirection   = -1;
  f.AgeofDomain         = -1;
  f.DNSRecording        =  1;
  f.WebsiteTraffic      =  0;
  f.PageRank            = -1;
  f.GoogleIndex         =  1;
  f.LinksPointingToPage =  1;
  f.StatsReport         = -1;

  const ORDER = [
    "UsingIP","LongURL","ShortURL","Symbol@","Redirecting//",
    "PrefixSuffix-","SubDomains","HTTPS","DomainRegLen","Favicon",
    "NonStdPort","HTTPSDomainURL","RequestURL","AnchorURL","LinksInScriptTags",
    "ServerFormHandler","InfoEmail","AbnormalURL","WebsiteForwarding","StatusBarCust",
    "DisableRightClick","UsingPopupWindow","IframeRedirection","AgeofDomain","DNSRecording",
    "WebsiteTraffic","PageRank","GoogleIndex","LinksPointingToPage","StatsReport"
  ];

  return ORDER.map(k => f[k]);
}

function predictTree(tree, X) {
  let node = tree;
  while (!node.leaf) {
    node = X[node.f] <= node.th ? node.l : node.r;
  }
  return node.v;
}

// Untuk web app — load dari path relatif
// Untuk extension — load dari chrome.runtime.getURL
async function predictURL(url) {
  const features = extractFeatures(url);
  if (!features) return { label: "error", confidence: 0, features: {} };

  if (!window._forest) {
    // Cek apakah berjalan di extension atau web app
    const forestUrl = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL)
      ? chrome.runtime.getURL("forest.json")
      : "./forest.json";
    const resp = await fetch(forestUrl);
    window._forest = await resp.json();
  }

  let neg = 0, pos = 0;
  for (const tree of window._forest) {
    const [v0, v1] = predictTree(tree, features);
    v0 > v1 ? neg++ : pos++;
  }

  const total = neg + pos;
  const isPhishing = neg > pos;
  const confidence = isPhishing ? neg / total : pos / total;

  const feat = {
    "Menggunakan IP address": features[0] === 1,
    "URL sangat panjang":     features[1] === 1,
    "URL diperpendek":        features[2] === 1,
    "Ada simbol @":           features[3] === 1,
    "Redirect ganda":         features[4] === 1,
    "Tanda - di domain":      features[5] === 1,
    "Subdomain berlebihan":   features[6] === 1,
    "HTTPS tidak aktif":      features[7] !== 1,
  };

  return {
    label: isPhishing ? "phishing" : "safe",
    confidence: Math.round(confidence * 10000) / 10000,
    features: feat
  };
}
