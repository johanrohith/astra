const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

const html = read("index.html");
const css = read("style.css");
const app = read("app.js");
const api = read("api/chat.js");
const sw = read("sw.js");
const manifest = JSON.parse(read("manifest.webmanifest"));

const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
const uniqueIds = new Set(ids);
assert.equal(ids.length, uniqueIds.size, "HTML contains duplicate IDs");

const referencedIds = [...app.matchAll(/\$\("#([^"]+)"\)/g)].map(match => match[1]);
const missingIds = [...new Set(referencedIds.filter(id => !uniqueIds.has(id)))];
assert.deepEqual(missingIds, [], "app.js references missing HTML IDs");

const openBraces = (css.match(/{/g) || []).length;
const closeBraces = (css.match(/}/g) || []).length;
assert.equal(openBraces, closeBraces, "CSS braces are unbalanced");

for (const required of [
  "GEMINI_API_KEY",
  "ASTRA_ACCESS_TOKEN",
  "MAX_MESSAGES",
  "google_search"
]) {
  assert.ok(api.includes(required), "API is missing expected configuration: " + required);
}

assert.ok(!/GEMINI_API_KEY|AIza[0-9A-Za-z_-]{20,}/.test(html + app),
  "A provider key or API-key-looking string must not be shipped to the frontend");
assert.ok(manifest.name && manifest.start_url && manifest.icons && manifest.icons.length,
  "PWA manifest is missing required app fields");
assert.ok(fs.existsSync(path.join(root, "assets", "astra-icon.svg")), "PWA icon is missing");
assert.ok(sw.includes("/api/"), "Service worker should avoid caching API responses");

console.log("ASTRA smoke checks passed:");
console.log("- unique HTML IDs and matching app.js selectors");
console.log("- balanced stylesheet braces");
console.log("- expected private API configuration");
console.log("- no provider key in frontend source");
console.log("- valid PWA manifest, icon and API cache exclusion");
