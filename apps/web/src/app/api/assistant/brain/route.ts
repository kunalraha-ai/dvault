import { NextRequest } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { apiError, corsJson, optionsResponse, resolveUser } from "@/lib/api";
import { llmJson, llmStatus } from "@/lib/ai/llm";
import { rateLimit, limitOrFail } from "@/lib/rate-limit";
import { FIELD_MAP, FIELDS } from "@/lib/core";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

const schema = z.object({
  utterance: z.string().min(1).max(300),
  language: z.string().max(10).default("en-IN"),
  speakSensitive: z.boolean().default(false),
});

const INTENTS = [
  "GET_PERSONAL_INFORMATION", "GET_BUSINESS_INFORMATION",
  "SAVE_INFORMATION", "UPDATE_INFORMATION",
  "FILL_ACTIVE_FORM", "ANALYZE_ACTIVE_FORM",
  "SAVE_APPLICATION", "SEARCH_APPLICATIONS",
  "GET_APPLICATION_DETAILS", "UPLOAD_DOCUMENT",
  "SET_ACTIVE_PROFILE", "GREETING", "UNKNOWN",
] as const;

/** Decrypt a single AES-GCM envelope using the instance key. */
async function decryptField(
  keyJwk: JsonWebKey,
  envelope: { c: string; iv: string },
): Promise<string | null> {
  try {
    const subtle = crypto.webcrypto.subtle;
    const key = await subtle.importKey("jwk", keyJwk, { name: "AES-GCM" }, true, ["decrypt"]);
    const ct = Uint8Array.from(atob(envelope.c), (ch) => ch.charCodeAt(0));
    const iv = Uint8Array.from(atob(envelope.iv), (ch) => ch.charCodeAt(0));
    const pt = await subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
    return new TextDecoder().decode(pt);
  } catch {
    return null;
  }
}

/**
 * POST /api/assistant/brain — Kimi K2.7 IS the brain.
 *
 * The server loads + decrypts the user's vault data (it holds the instance
 * key in no-auth local mode), sends the utterance + vault context to
 * Kimi K2.7 on Cloudflare Workers AI, and returns Kimi's natural response.
 * Gnani TTS then speaks that response in the user's selected language.
 *
 * Privacy note: in this no-auth local mode the vault data goes to the
 * Cloudflare Workers AI endpoint — a documented trade-off the user opted
 * into by requesting LLM-as-brain. Sensitive identifiers are masked in
 * the LLM context unless the user explicitly enabled speakSensitive.
 */
export async function POST(req: NextRequest) {
  const auth = await resolveUser(req);
  if (!auth) return apiError("Not authenticated", 401);

  const rl = rateLimit(`brain:${auth.user.id}`, 30, 60_000);
  const fail = limitOrFail(rl);
  if (fail) return fail;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiError("Invalid input", 422);
  const { utterance, language, speakSensitive } = parsed.data;

  const llm = llmStatus();
  if (!llm.configured) {
    return corsJson({
      ok: false,
      configured: false,
      error: "Kimi K2.7 not configured. Set LLM_API_KEY / CF_API_TOKEN + CF_ACCOUNT_ID in apps/web/.env, restart the server, and D will use the LLM as its brain. The deterministic on-device engine handles common commands in the meantime.",
    }, { status: 503 });
  }

  // ── load + decrypt vault data ──────────────────────────────────────────
  const user = await prisma.user.findUnique({ where: { id: auth.user.id } });
  if (!user) return apiError("Vault not found", 404);
  const keyJwk = JSON.parse(user.vaultKeyJwk) as JsonWebKey;

  const profiles = await prisma.profile.findMany({
    where: { userId: user.id },
    include: { fields: true },
  });

  // decrypt all fields, grouped by profile
  const vaultContext: string[] = [];
  const today = new Date();
  for (const profile of profiles) {
    const type = profile.profileType === "business" ? "BUSINESS" : "PERSONAL";
    vaultContext.push(`\n${type} PROFILE: "${profile.profileName}"`);
    for (const field of profile.fields) {
      const def = FIELD_MAP[field.fieldKey];
      const label = def?.label ?? field.fieldKey;
      let value: string | null = null;
      try {
        const env = JSON.parse(field.encryptedValue) as { c: string; iv: string };
        value = await decryptField(keyJwk, env);
      } catch { /* skip undecryptable */ }
      if (!value) continue;
      // mask sensitive identifiers unless the user opted in
      if (def?.sensitive && !speakSensitive) {
        const visible = value.length <= 4
          ? "••••"
          : value.slice(0, 2) + "••••" + value.slice(-2);
        vaultContext.push(`  ${field.fieldKey} (${label}): [MASKED — ${visible}]`);
      } else {
        vaultContext.push(`  ${field.fieldKey} (${label}): ${value}`);
        // ── precompute derived values so the LLM never does date math ──
        if (field.fieldKey === "personal.dob") {
          const dob = new Date(value);
          if (!isNaN(dob.getTime())) {
            let age = today.getFullYear() - dob.getFullYear();
            const m = today.getMonth() - dob.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
            vaultContext.push(`  _derived.age (computed age): ${age} years old`);
            vaultContext.push(`  _derived.dob_formatted: ${dob.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}`);
          }
        }
      }
    }
  }

  // ── load recent applications for context ────────────────────────────────
  const apps = await prisma.application.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  if (apps.length > 0) {
    vaultContext.push("\nRECENT APPLICATIONS:");
    for (const app of apps) {
      let ref = "(no ref)";
      try {
        const env = JSON.parse(app.encryptedReferenceId ?? "null") as { c: string; iv: string } | null;
        if (env) ref = await decryptField(keyJwk, env) ?? "(no ref)";
      } catch { /* skip */ }
      vaultContext.push(`  ${app.applicationName} — ${app.websiteDomain} — ref: ${ref} — status: ${app.status} — date: ${app.submissionDate?.toLocaleDateString() ?? "unknown"}`);
    }
  }

  // ── Kimi system prompt ──────────────────────────────────────────────────
  // Build a complete field catalog so Kimi ALWAYS knows the valid keys
  const fieldCatalog = FIELDS.map((f) =>
    `${f.key} (${f.label})`,
  ).join("\n");

  const system =
    "You are D, the voice assistant for D-Vault — a personal information vault. " +
    "You have the user's complete vault below. Answer their question naturally, " +
    "using the actual values from the vault. You understand Hindi, English, Hinglish, " +
    "Tamil, Telugu, Kannada, Bengali, Marathi, Gujarati, Punjabi and Malayalam.\n\n" +
    `TODAY'S DATE: ${today.toISOString().split("T")[0]} (${today.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })})\n\n` +
    "VAULT DATA:\n" + vaultContext.join("\n") + "\n\n" +
    "ALL VAULT FIELD KEYS (use these EXACT keys for field_key):\n" + fieldCatalog + "\n\n" +
    "CRITICAL RULES:\n" +
    "1. ONLY use values that are ACTUALLY in the vault data above. " +
    "If a value is not in the vault, say \"I don't have that stored yet\" — NEVER invent, guess, or hallucinate values.\n" +
    "2. For age questions: the precomputed age is in _derived.age. " +
    "Use that value directly — NEVER calculate age yourself. The birth date is in _derived.dob_formatted.\n" +
    "3. For any date/time calculations, use TODAY'S DATE above. Never do mental date math.\n" +
    "4. For questions about their information: include the actual value in your response.\n" +
    "5. For 'fill this form' type commands: respond with intent FILL_ACTIVE_FORM.\n" +
    "6. For 'save/remember/my X is Y' commands: respond with intent " +
    "SAVE_INFORMATION or UPDATE_INFORMATION with field_key set to the EXACT key from " +
    "the ALL VAULT FIELD KEYS list above (e.g. personal.full_name, personal.first_name, " +
    "personal.last_name, contact.city, family.father_name, business.company_name). " +
    "The field_key MUST NOT be null — pick the closest match. " +
    "For 'my name is X' → personal.full_name. For 'my first name is X' → personal.first_name. " +
    "For 'my city is X' → contact.city. For 'my email is X' → contact.email.\n" +
    "7. For multi-field saves like 'save my name X, email Y, city Z': return a JSON array " +
    "of objects: [{\"field_key\":\"personal.full_name\",\"value\":\"X\"},{\"field_key\":\"contact.email\",\"value\":\"Y\"}]. " +
    "Set intent to SAVE_INFORMATION and include the array as the value of a key called \"fields\".\n" +
    "8. For 'save this application': respond with intent SAVE_APPLICATION.\n" +
    "9. For 'show my applications': respond with intent SEARCH_APPLICATIONS.\n" +
    "10. For greetings or general chat: respond with intent GREETING and a friendly reply.\n" +
    "11. Reply in the user's language — if they speak Hindi, reply in Hindi.\n" +
    "12. Keep responses SHORT and conversational (1-2 sentences max).\n" +
    "13. If the vault data is marked [MASKED], do NOT reveal the full value.\n" +
    "14. If a field is missing from the vault entirely, still provide the correct field_key " +
    "so it can be saved — the field will be created.\n\n" +
    'Return ONLY JSON: {"response": "...", "intent": "...", "field_key": "..." or null, ' +
    '"value": "..." or null, "profile_type": "personal"|"business"|null, ' +
    '"fields": [{"field_key":"...","value":"..."}] or null, ' +
    '"language": "' + language + '"}';

  const user2 = `User said: "${utterance}"\nLanguage: ${language}\nSpeakSensitive: ${speakSensitive}`;

  const result = await llmJson<{
    response?: string;
    intent?: string;
    field_key?: string | null;
    value?: string | null;
    profile_type?: string | null;
    language?: string;
  }>(system, user2);

  if (!result.ok) {
    return corsJson({ ok: false, configured: true, error: result.error }, { status: 502 });
  }

  const data = result.data;
  const intent = INTENTS.includes(data.intent as (typeof INTENTS)[number]) ? data.intent : "GREETING";
  const fieldKey = data.field_key && FIELD_MAP[data.field_key] ? data.field_key : null;

  // ── server-side field resolution fallback ────────────────────────────────
  // If Kimi understood SAVE/UPDATE but didn't return a field_key, resolve
  // it from the utterance + response text by matching vault field labels
  // and common synonyms.
  let resolvedKey = fieldKey;
  if ((intent === "SAVE_INFORMATION" || intent === "UPDATE_INFORMATION") && !resolvedKey) {
    // search both the utterance AND the response text
    const searchText = `${utterance} ${data.response ?? ""} ${data.value ?? ""}`.toLowerCase();

    // 1) Try exact field label matches (longest label wins)
    let bestKey: string | null = null;
    let bestLen = 0;
    for (const [key, def] of Object.entries(FIELD_MAP)) {
      const label = def.label.toLowerCase();
      if (label.length > bestLen && label.length > 3 && searchText.includes(label)) {
        bestKey = key;
        bestLen = label.length;
      }
    }

    // 2) Try comprehensive synonyms from the utterance
    if (!bestKey) {
      const synonyms: Record<string, string> = {
        // personal
        "full legal name": "personal.full_name", "full name": "personal.full_name",
        "my name": "personal.full_name", "your name": "personal.full_name",
        "complete name": "personal.full_name", "name": "personal.full_name",
        "first name": "personal.first_name", "given name": "personal.first_name",
        "middle name": "personal.middle_name",
        "last name": "personal.last_name", "surname": "personal.last_name",
        "family name": "personal.last_name",
        "date of birth": "personal.dob", "birthday": "personal.dob", "born": "personal.dob",
        "dob": "personal.dob",
        "gender": "personal.gender", "sex": "personal.gender",
        "nationality": "personal.nationality", "citizenship": "personal.nationality",
        "marital status": "personal.marital_status",
        // references (IDs from forms)
        "reference number": "reference.number", "confirmation number": "reference.number",
        "ref number": "reference.number", "reference id": "reference.number",
        "virtual id": "reference.virtual_id", "vid": "reference.virtual_id",
        "tracking id": "reference.tracking_id", "tracking number": "reference.tracking_id",
        "acknowledgement id": "reference.acknowledgement_id",
        "application id": "reference.application_id",
        // family
        "father": "family.father_name", "dad": "family.father_name", "papa": "family.father_name",
        "mother": "family.mother_name", "mom": "family.mother_name", "mum": "family.mother_name",
        "guardian": "family.guardian_name",
        "emergency contact": "family.emergency_contact",
        // identity
        "aadhaar": "identity.aadhaar", "aadhar": "identity.aadhaar",
        "pan": "identity.pan", "pan card": "identity.pan",
        "passport": "identity.passport",
        "driving licence": "identity.driving_licence", "driving license": "identity.driving_licence",
        "voter id": "identity.voter_id",
        // contact
        "email": "contact.email", "e-mail": "contact.email", "mail": "contact.email",
        "phone": "contact.phone", "mobile": "contact.phone", "phone number": "contact.phone",
        "mobile number": "contact.phone", "contact number": "contact.phone",
        "city": "contact.city", "town": "contact.city",
        "address": "contact.current_address", "current address": "contact.current_address",
        "permanent address": "contact.permanent_address", "home address": "contact.permanent_address",
        "pin code": "contact.postal_code", "pincode": "contact.postal_code", "postal code": "contact.postal_code",
        "zip": "contact.postal_code", "zip code": "contact.postal_code",
        "state": "contact.state", "province": "contact.state",
        "country": "contact.country",
        // education
        "school": "education.school", "university": "education.university", "college": "education.university",
        "degree": "education.degree", "course": "education.course",
        "graduation year": "education.graduation_year", "cgpa": "education.cgpa",
        "marks": "education.marks", "percentage": "education.marks",
        "certificates": "education.certificates", "certificate": "education.certificates",
        // employment
        "employer": "employment.current_employer", "company": "employment.current_employer",
        "designation": "employment.designation", "job title": "employment.designation",
        "work experience": "employment.work_experience", "experience": "employment.work_experience",
        "linkedin": "employment.profile_url", "resume": "employment.resume",
        // business
        "company name": "business.company_name", "business name": "business.company_name",
        "firm name": "business.company_name", "organization name": "business.company_name",
        "brand name": "business.brand_name",
        "website": "business.website", "company website": "business.website",
        "company email": "business.company_email", "business email": "business.company_email",
        "company phone": "business.company_phone", "business phone": "business.company_phone",
        "company address": "business.company_address",
        "incorporation date": "business.incorporation_date",
        "company type": "business.company_type",
        "registration number": "business.registration_number",
        "gstin": "business.gstin", "gst": "business.gstin",
        "industry": "business.industry", "sector": "business.industry",
        "business stage": "business.business_stage",
        "founder name": "business.founder_name", "founder": "business.founder_name",
        "co-founder": "business.cofounder_names", "cofounder": "business.cofounder_names",
        "founder email": "business.founder_email",
        "founder linkedin": "business.founder_linkedin",
        "founder bio": "business.founder_bio",
        "product name": "business.product_name", "product": "business.product_name",
        "product description": "business.product_description",
        "problem": "business.problem", "problem statement": "business.problem",
        "solution": "business.solution",
        "target market": "business.target_market",
        "business model": "business.business_model",
        "revenue model": "business.revenue_model",
        "traction": "business.traction",
        "customers": "business.customer_count", "number of customers": "business.customer_count",
        "mrr": "business.mrr", "monthly revenue": "business.mrr",
        "arr": "business.arr", "annual revenue": "business.arr",
        "funding stage": "business.funding_stage",
        "team": "business.team_size", "team size": "business.team_size",
        "employees": "business.team_size", "number of employees": "business.team_size",
        "staff": "business.team_size", "headcount": "business.team_size",
        "incubator": "business.incubator",
        "accelerator": "business.accelerator",
        "pitch deck": "business.pitch_deck",
      };
      for (const [phrase, key] of Object.entries(synonyms)) {
        if (searchText.includes(phrase) && phrase.length > bestLen) {
          bestKey = key;
          bestLen = phrase.length;
        }
      }
    }
    if (bestKey) resolvedKey = bestKey;
  }

  // ── normalize date values for DOB fields (AFTER resolution) ─────────────
  let finalValue = data.value ?? null;
  if (resolvedKey === "personal.dob" && finalValue) {
    const parsed = new Date(finalValue);
    if (!isNaN(parsed.getTime()) && !/^\d{4}-\d{2}-\d{2}/.test(finalValue)) {
      // parseable but not ISO (e.g. "17 July 2006") → build ISO from parts
      // (use local date parts, NOT toISOString which shifts by timezone)
      const y = parsed.getFullYear();
      const mo = parsed.getMonth() + 1;
      const d = parsed.getDate();
      finalValue = `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    } else if (isNaN(parsed.getTime())) {
      // try "17 July 2006" style explicitly
      const m = finalValue.match(/(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i);
      if (m) {
        const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
        const mo = months.findIndex(x => x.toLowerCase() === m[2].toLowerCase());
        if (mo >= 0) finalValue = `${m[3]}-${String(mo + 1).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}`;
      }
    }
  }

  const finalProfileType = data.profile_type === "business" || data.profile_type === "personal"
    ? data.profile_type
    : resolvedKey && FIELD_MAP[resolvedKey]?.profileType === "business"
      ? "business"
      : null;

  return corsJson({
    ok: true,
    configured: true,
    model: llm.model,
    brain: {
      response: data.response ?? "I'm here to help.",
      intent,
      field_key: resolvedKey,
      value: finalValue,
      profile_type: finalProfileType,
      language: data.language ?? language,
    },
  });
}

export async function OPTIONS() {
  return optionsResponse();
}
