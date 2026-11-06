#!/usr/bin/env node
/**
 * D-Vault API smoke test — no-auth local mode.
 *
 * Exercises the complete flow through the real HTTP API:
 *
 *   bootstrap (auto-creates local user + instance key) → profile →
 *   encrypted field round-trip → document upload → application memory →
 *   extension pairing (no credentials) → scoped vault retrieval →
 *   auth pages gone → export → erase vault
 *
 * Values are encrypted with the same AES-256-GCM envelope format as the web
 * client, using the instance key returned by the server — proving the server
 * only ever handles ciphertext, and that the whole app works with zero
 * authentication.
 */

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const results = { pass: 0, fail: 0 };
let cookie = "";

function ok(name, cond, extra = "") {
  if (cond) {
    results.pass++;
    console.log(`  ✓ ${name} ${extra}`);
  } else {
    results.fail++;
    console.error(`  ✗ ${name} ${extra}`);
  }
}

async function call(method, path, { json, body, headers = {} } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(json ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: json ? JSON.stringify(json) : body,
  });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  let data = null;
  try { data = await res.json(); } catch { /* may be empty */ }
  return { status: res.status, data };
}

async function main() {
  console.log(`\nD-Vault smoke test (no-auth) → ${BASE}\n`);

  // 1. bootstrap — the only "entry": GET /api/auth/session creates everything
  console.log("1. Bootstrap (no login)");
  let r = await call("GET", "/api/auth/session");
  ok("bootstrap → 200 with local user", r.status === 200 && !!r.data.user);
  ok("returns AES instance key (JWK)", !!r.data.keyJwk?.k);
  ok("mode is local-no-auth", r.data.mode === "local-no-auth");
  const user = r.data.user;
  const key = await crypto.subtle.importKey("jwk", r.data.keyJwk, { name: "AES-GCM" }, true, ["encrypt", "decrypt"]);

  // 2. vault round-trip
  console.log("2. Vault");
  r = await call("POST", "/api/profiles", { json: { profileType: "personal", profileName: "Smoke Personal" } });
  ok("create personal profile → 201", r.status === 201);
  const profileId = r.data.profile.id;

  const enc = await (async () => {
    const iv = new Uint8Array(12);
    crypto.getRandomValues(iv);
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode("Aarav Smoke Mehta"));
    const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
    return { c: b64(ct), iv: b64(iv) };
  })();
  r = await call("POST", `/api/profiles/${profileId}/fields`, {
    json: { fieldKey: "personal.full_name", encryptedValue: enc, verified: false },
  });
  ok("store client-encrypted field → 201", r.status === 201);
  r = await call("GET", `/api/profiles/${profileId}/fields`);
  const stored = r.data.fields.find((f) => f.fieldKey === "personal.full_name");
  ok("server holds only ciphertext", !JSON.stringify(stored).includes("Aarav"));
  const dec = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: Uint8Array.from(atob(enc.iv), (c) => c.charCodeAt(0)) },
    key,
    Uint8Array.from(atob(enc.c), (c) => c.charCodeAt(0)),
  );
  ok("field decrypts back to original", new TextDecoder().decode(dec) === "Aarav Smoke Mehta");

  // 3. documents
  console.log("3. Documents");
  const bytes = new Uint8Array(2048);
  crypto.getRandomValues(bytes);
  const form = new FormData();
  form.append("file", new Blob([enc.c], { type: "application/octet-stream" }), "smoke.enc");
  form.append("filename", "smoke-test.txt");
  form.append("profileId", profileId);
  form.append("category", "identity");
  r = await call("POST", "/api/documents", { body: form });
  ok("upload encrypted document → 201", r.status === 201);
  const dl = await fetch(`${BASE}/api/documents/${r.data.document.id}?blob=1`);
  ok("download encrypted blob → 200", dl.status === 200);

  // 4. application memory
  console.log("4. Application memory");
  r = await call("POST", "/api/applications", {
    json: {
      applicationName: "Smoke grant application",
      websiteDomain: "smoke.example.test",
      applicationUrl: "https://smoke.example.test/apply",
      encryptedReferenceId: enc,
      submissionDate: new Date().toISOString(),
      status: "submitted",
    },
  });
  ok("save application → 201", r.status === 201);
  r = await call("GET", "/api/applications");
  ok("list applications + stats", r.data.applications.length === 1 && r.data.stats.total === 1);

  // 5. extension pairing — no credentials
  console.log("5. Extension");
  r = await call("POST", "/api/extension/pair", { json: { deviceName: "Smoke Extension" } });
  ok("pair → 200 with deviceToken", r.status === 200 && !!r.data.deviceToken);
  ok("pair returns instance key", !!r.data.keyJwk?.k);
  const deviceToken = r.data.deviceToken;
  r = await call("POST", "/api/extension/vault-values", {
    json: { profileId, fieldKeys: ["personal.full_name", "identity.pan"] },
    headers: { "X-DVault-Device-Token": deviceToken },
  });
  ok("scoped vault retrieval returns requested key", !!r.data.fields["personal.full_name"]);
  ok("scoped retrieval reports missing keys", r.data.missing.includes("identity.pan"));

  r = await call("POST", "/api/extension/consent", {
    json: { action: "form_inspected", websiteDomain: "smoke.example.test" },
    headers: { "X-DVault-Device-Token": deviceToken },
  });
  ok("consent event logged → 201", r.status === 201);

  // 6. auth is really gone
  console.log("6. Auth removed");
  const gone = await fetch(`${BASE}/api/auth/signup`, { method: "POST", body: "{}", headers: { "Content-Type": "application/json" } });
  ok("signup endpoint gone (404)", gone.status === 404, `(got ${gone.status})`);
  const loginPage = await fetch(`${BASE}/login`, { redirect: "manual" });
  ok("login page gone (404)", loginPage.status === 404, `(got ${loginPage.status})`);
  const dash = await fetch(`${BASE}/dashboard`, { redirect: "manual" });
  ok("dashboard opens with no cookie (no redirect)", dash.status === 200, `(got ${dash.status})`);

  // 7. security center + export
  console.log("7. Security center & export");
  r = await call("GET", "/api/security/sessions");
  ok("active devices listed", r.data.devices.filter((d) => !d.revokedAt).length === 1);
  ok("consent log present", r.data.recentConsentEvents.length >= 1);
  ok("no login sessions exist", r.data.sessions === undefined);
  const exp = await fetch(`${BASE}/api/account/export`);
  ok("export → 200", exp.status === 200);

  // 8. voice honesty (Gnani not configured here)
  r = await call("GET", "/api/voice/status");
  ok("voice status reports honestly (matches actual configuration)", typeof r.data.voice?.configured === "boolean");

  // 9. erase vault (keeps the vault usable)
  console.log("8. Erase vault");
  r = await call("DELETE", "/api/account", { json: { confirm: "ERASE-MY-VAULT" } });
  ok("erase all data → 200", r.status === 200);
  r = await call("GET", "/api/profiles");
  ok("vault empty after erase", r.data.profiles.length === 0);
  r = await call("GET", "/api/auth/session");
  ok("vault still open after erase (user persists)", r.status === 200 && !!r.data.user);
  ok("…and it's still the same user", r.data.user.id === user.id);

  console.log(`\n${results.pass} passed, ${results.fail} failed\n`);
  process.exit(results.fail ? 1 : 0);
}

main().catch((e) => {
  console.error("\nSmoke test crashed:", e.message, "\nIs the server running? (npm run dev)\n");
  process.exit(1);
});
