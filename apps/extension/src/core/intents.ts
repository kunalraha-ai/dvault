/**
 * D-Vault intent engine.
 *
 * Converts a natural-language command ("D, what is my full name?") into a
 * structured intent object, e.g.:
 *
 *   {
 *     "intent": "GET_PERSONAL_INFORMATION",
 *     "field_key": "personal.full_name",
 *     "requires_confirmation": false
 *   }
 *
 * The engine is deterministic and runs entirely on the user's device. When an
 * optional LLM is configured server-side, `/api/ai/intent` may refine the
 * result, but the deterministic engine is the default and is always the
 * fallback. Sensitive values are never needed at this layer — the engine works
 * with field KEYS, not values.
 */

import { FIELD_SYNONYMS } from "./lexicon";
import { FIELD_MAP, FIELDS } from "./vault-schema";
import { normalizeText } from "./mapping";
import { parseIntentI18N } from "./intents-i18n";

export type Intent =
  | "GET_PERSONAL_INFORMATION"
  | "GET_BUSINESS_INFORMATION"
  | "SAVE_INFORMATION"
  | "UPDATE_INFORMATION"
  | "FILL_ACTIVE_FORM"
  | "ANALYZE_ACTIVE_FORM"
  | "SAVE_APPLICATION"
  | "SEARCH_APPLICATIONS"
  | "GET_APPLICATION_DETAILS"
  | "UPLOAD_DOCUMENT"
  | "SET_ACTIVE_PROFILE"
  | "UNKNOWN";

export interface ParsedIntent {
  intent: Intent;
  field_key?: string;
  value?: string;
  profile_type?: "personal" | "business";
  query?: string;
  status?: string;
  timeframe?: "recent" | "last_month" | "last_year" | "all";
  field_requested?: "reference" | "date" | "url" | "status";
  requires_confirmation: boolean;
  confidence: number;
  explanation: string;
  /** Normalized transcript after stripping the wake phrase */
  utterance: string;
}

// ---------------------------------------------------------------------------
// Field phrase resolution
// ---------------------------------------------------------------------------

function bigrams(s: string): Set<string> {
  const t = s.replace(/\s/g, "");
  const out = new Set<string>();
  for (let i = 0; i < t.length - 1; i++) out.add(t.slice(i, i + 2));
  return out;
}

function dice(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const A = bigrams(a);
  const B = bigrams(b);
  let inter = 0;
  for (const g of A) if (B.has(g)) inter++;
  return (2 * inter) / (A.size + B.size || 1);
}

/** Resolve a free phrase ("permanent address") to a vault field key. */
export function resolveFieldPhrase(
  phrase: string,
): { key: string; confidence: number } | null {
  const q = normalizeText(phrase);
  if (!q) return null;
  let bestKey: string | null = null;
  let bestScore = 0;
  for (const [key, phrases] of Object.entries(FIELD_SYNONYMS)) {
    for (const p of phrases) {
      const np = normalizeText(p);
      let score = 0;
      if (np === q) score = 1;
      else if (np.includes(q) || q.includes(np)) score = 0.82;
      else score = dice(np, q);
      if (score > bestScore) {
        bestScore = score;
        bestKey = key;
      }
    }
  }
  // also match on canonical labels
  for (const def of FIELDS) {
    const nl = normalizeText(def.label);
    let score = nl === q ? 1 : nl.includes(q) || q.includes(nl) ? 0.82 : dice(nl, q);
    if (score > bestScore) {
      bestScore = score;
      bestKey = def.key;
    }
  }
  if (bestKey && bestScore >= 0.55) {
    return { key: bestKey, confidence: bestScore };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Utterance normalization
// ---------------------------------------------------------------------------

export function stripWakePhrase(text: string): string {
  return text
    .replace(/^\s*(hey\s+|ok\s+|okay\s+)?[dD]\s*[,:\-]?\s*/, "")
    .replace(/^\s*(hey|ok|okay)\s+vault\s*[,:\-]?\s*/i, "")
    .replace(/[.?!।॥؟?]+$/, "")
    .trim();
}

// ---------------------------------------------------------------------------
// The parser
// ---------------------------------------------------------------------------

export function parseIntent(rawUtterance: string): ParsedIntent {
  const utterance = stripWakePhrase(rawUtterance);
  const fail = (explanation: string): ParsedIntent => ({
    intent: "UNKNOWN",
    requires_confirmation: false,
    confidence: 0,
    explanation,
    utterance,
  });

  if (!utterance) return fail("I didn't catch that. Try “D, fill this form” or “D, remember that…”");

  // Multilingual (Indian language) rules run first; when none match we fall
  // through to the English parser below.
  const i18n = parseIntentI18N(utterance);
  if (i18n) return i18n;

  const text = normalizeText(utterance);

  // ------------------------------------------------------------- profile set
  const useProfile = text.match(
    /(?:use|switch to|activate)\s+(?:my|the)?\s*(personal|business|company)\s*profile/,
  );
  if (useProfile) {
    const p = useProfile[1] === "business" || useProfile[1] === "company" ? "business" : "personal";
    return {
      intent: "SET_ACTIVE_PROFILE",
      profile_type: p,
      requires_confirmation: false,
      confidence: 0.95,
      explanation: `Switching to your ${p} profile.`,
      utterance,
    };
  }

  // ------------------------------------------------------------------- fill
  const fill = text.match(
    /(?:fill|complete|autofill|auto fill|populate)\s*(?:this|the|that|active)?\s*(?:form|application|page)?/,
  );
  if (fill && /(fill|complete|autofill|populate)/.test(text)) {
    const business = /(business|company|startup)/.test(text);
    const personal = /(personal|my personal)/.test(text);
    return {
      intent: "FILL_ACTIVE_FORM",
      profile_type: business ? "business" : personal ? "personal" : undefined,
      requires_confirmation: true,
      confidence: 0.95,
      explanation: business
        ? "I'll inspect the active form and map it to your business profile for review."
        : personal
          ? "I'll inspect the active form and map it to your personal profile for review."
          : "I'll inspect the active form and propose a mapping for your review.",
      utterance,
    };
  }

  // ---------------------------------------------------------------- analyze
  if (/(analyze|analyse|scan|inspect|look at|what fields)/.test(text) && /(form|page|this)/.test(text)) {
    return {
      intent: "ANALYZE_ACTIVE_FORM",
      requires_confirmation: false,
      confidence: 0.9,
      explanation: "Let me inspect the active form and list what I find.",
      utterance,
    };
  }

  // --------------------------------------------------------- save application
  if (/(save|record|store)\s*(this|the|my)?\s*(application|submission)/.test(text)) {
    return {
      intent: "SAVE_APPLICATION",
      requires_confirmation: true,
      confidence: 0.95,
      explanation: "I can save this application with its URL, reference number and a screenshot — after you confirm.",
      utterance,
    };
  }

  // ---------------------------------------------------------- upload document
  if (/(upload|add|scan)\s*(a|an|new)?\s*(document|file|certificate|id)/.test(text)) {
    return {
      intent: "UPLOAD_DOCUMENT",
      requires_confirmation: false,
      confidence: 0.9,
      explanation: "Opening the document vault so you can upload.",
      utterance,
    };
  }

  // --------------------------------------------- application retrieval (dates)
  const whenApplied = text.match(
    /when\s+did\s+i\s+(?:apply|submit)(?:\s+(?:for|to)\s+(.+))?/,
  );
  if (whenApplied) {
    return {
      intent: "GET_APPLICATION_DETAILS",
      query: whenApplied[1]?.trim(),
      field_requested: "date",
      requires_confirmation: false,
      confidence: 0.9,
      explanation: "Looking up that application's submission date.",
      utterance,
    };
  }

  // ------------------------------------------------ application reference lookup
  const refMatch = text.match(
    /what\s+(?:was|is)\s+(?:my|the)?\s*(.+?)\s*(?:reference|acknowledgement|acknowledgment|confirmation)?\s*(?:number|id)?/,
  );
  if (refMatch && /(reference|acknowledg|confirmation)/.test(text)) {
    return {
      intent: "GET_APPLICATION_DETAILS",
      query: refMatch[1].replace(/\s*(application|form)\s*$/, "").trim(),
      field_requested: "reference",
      requires_confirmation: false,
      confidence: 0.9,
      explanation: "Looking up that application's reference number.",
      utterance,
    };
  }

  // -------------------------------------------------------- search applications
  const statusMatch =
    text.match(/(?:which|what)\s+applications\s+are\s+(pending|submitted|approved|rejected|draft)/) ??
    text.match(/show\s+(?:me\s+)?(?:all\s+)?(?:my\s+)?(pending|submitted|approved|rejected|draft)\s+applications/);
  if (statusMatch) {
    return {
      intent: "SEARCH_APPLICATIONS",
      status: statusMatch[1],
      timeframe: "all",
      requires_confirmation: false,
      confidence: 0.9,
      explanation: `Showing ${statusMatch[1]} applications.`,
      utterance,
    };
  }
  if (/(show|list|find|see|display)\b/.test(text) && /(application|submission)/.test(text)) {
    const lastMonth = /last month/.test(text);
    const lastYear = /last year/.test(text);
    const recent = /(recent|latest|last)/.test(text) && !lastMonth && !lastYear;
    const findOne = /(find|locate|open)\s+the?\s+/.test(text);
    const subjectMatch = text.match(/(?:application|grant|job|scholarship|admission|insurance|banking|kyc)\b[^]*?(?:from|in|of|about)\s+([^]+)/);
    return {
      intent: "SEARCH_APPLICATIONS",
      timeframe: lastMonth ? "last_month" : lastYear ? "last_year" : recent ? "recent" : "all",
      query: findOne && subjectMatch ? subjectMatch[1].replace(/last (month|year)/, "").trim() : undefined,
      requires_confirmation: false,
      confidence: 0.85,
      explanation: "Searching your saved applications.",
      utterance,
    };
  }

  // -------------------------------------------------------------- get: how many
  const howMany = text.match(
    /how many\s+(.+?)\s+(?:do|does|are|is|have|has)?\s*(?:we|my company|our company|you|the team|your company)?\s*(?:have|has|had)?/,
  );
  if (howMany) {
    const resolved = resolveFieldPhrase(howMany[1]);
    if (resolved) {
      const def = FIELD_MAP[resolved.key];
      return {
        intent: def?.profileType === "business" ? "GET_BUSINESS_INFORMATION" : "GET_PERSONAL_INFORMATION",
        field_key: resolved.key,
        requires_confirmation: false,
        confidence: resolved.confidence,
        explanation: `Checking your stored value for “${def?.label ?? resolved.key}”.`,
        utterance,
      };
    }
  }
  const howManyPlain = text.match(/^how many\s+(.+)$/);
  if (howManyPlain) {
    const resolved = resolveFieldPhrase(howManyPlain[1]);
    if (resolved) {
      const def = FIELD_MAP[resolved.key];
      return {
        intent: def?.profileType === "business" ? "GET_BUSINESS_INFORMATION" : "GET_PERSONAL_INFORMATION",
        field_key: resolved.key,
        requires_confirmation: false,
        confidence: resolved.confidence,
        explanation: `Checking your stored value for “${def?.label ?? resolved.key}”.`,
        utterance,
      };
    }
  }

  // --------------------------------------------------------- save / remember
  const remember = utterance.match(
    /(?:remember|note|store)\s+that\s+(?:my|our|the|its|his|her)?\s*(.+?)\s+(?:is|are|=)\s+(.+)/i,
  );
  if (remember) {
    const resolved = resolveFieldPhrase(remember[1]);
    if (resolved) {
      const def = FIELD_MAP[resolved.key];
      return {
        intent: "SAVE_INFORMATION",
        field_key: resolved.key,
        value: remember[2].replace(/["']/g, "").trim(),
        requires_confirmation: true,
        confidence: resolved.confidence,
        explanation: `Save “${def?.label ?? resolved.key}” as “${remember[2].trim()}”? You can review before I store it.`,
        utterance,
      };
    }
    return fail(`I understood you want to remember something about “${remember[1]}”, but I don't know that field yet. You can add it manually.`);
  }

  // "my father's name is Rahul Sharma" (no "remember that")
  const isStatement = utterance.match(
    /^\s*(?:my|our|the)\s+(.+?)\s+(?:is|are|=)\s+(.+)/i,
  );
  if (isStatement && !/what|which|when|where|how|why/.test(text)) {
    const resolved = resolveFieldPhrase(isStatement[1]);
    if (resolved) {
      const def = FIELD_MAP[resolved.key];
      return {
        intent: "SAVE_INFORMATION",
        field_key: resolved.key,
        value: isStatement[2].replace(/["']/g, "").trim(),
        requires_confirmation: true,
        confidence: resolved.confidence,
        explanation: `Save “${def?.label ?? resolved.key}” as “${isStatement[2].trim()}”? Review before I store it.`,
        utterance,
      };
    }
  }

  // ------------------------------------------------------ update business facts
  const companyHas = text.match(
    /(?:company|team|startup|we)\s+(?:now\s+)?(?:have|has|is|are)\s+([\d,.]+)\s*(?:people|members|employees|staff|folks)?/,
  );
  if (companyHas && /employee|people|members|staff|team size|folks/.test(text)) {
    return {
      intent: "UPDATE_INFORMATION",
      field_key: "business.team_size",
      value: companyHas[1].replace(/,/g, ""),
      requires_confirmation: true,
      confidence: 0.92,
      explanation: `Update team size to ${companyHas[1]}? You'll confirm before I save.`,
      utterance,
    };
  }
  const updateTo = text.match(
    /(?:update|change|set)\s+(?:my|our|the)?\s*(.+?)\s+to\s+(.+)/,
  );
  if (updateTo) {
    const resolved = resolveFieldPhrase(updateTo[1]);
    if (resolved) {
      const def = FIELD_MAP[resolved.key];
      return {
        intent: "UPDATE_INFORMATION",
        field_key: resolved.key,
        value: updateTo[2].replace(/["']/g, "").trim(),
        requires_confirmation: true,
        confidence: resolved.confidence,
        explanation: `Update “${def?.label ?? resolved.key}” to “${updateTo[2].trim()}”? Review before I save.`,
        utterance,
      };
    }
  }

  // -------------------------------------------------------------- get: what is
  const whatIs = text.match(
    /(?:what|which|where)\s+(?:is|are|was|were)\s+(?:my|the|our|its)?\s*(.+)/,
  );
  if (whatIs) {
    const phrase = whatIs[1].trim();
    const resolved = resolveFieldPhrase(phrase);
    if (resolved) {
      const def = FIELD_MAP[resolved.key];
      return {
        intent: def?.profileType === "business" ? "GET_BUSINESS_INFORMATION" : "GET_PERSONAL_INFORMATION",
        field_key: resolved.key,
        requires_confirmation: false,
        confidence: resolved.confidence,
        explanation: `Retrieving “${def?.label ?? resolved.key}”. Sensitive values are shown masked on screen instead of spoken.`,
        utterance,
      };
    }
  }
  const tellMe = text.match(/(?:tell me|show me|read out)\s+(?:my|the|our)?\s*(.+)/);
  if (tellMe) {
    const resolved = resolveFieldPhrase(tellMe[1]);
    if (resolved) {
      const def = FIELD_MAP[resolved.key];
      return {
        intent: def?.profileType === "business" ? "GET_BUSINESS_INFORMATION" : "GET_PERSONAL_INFORMATION",
        field_key: resolved.key,
        requires_confirmation: false,
        confidence: resolved.confidence,
        explanation: `Retrieving “${def?.label ?? resolved.key}”.`,
        utterance,
      };
    }
  }

  // ── flexible natural-language GET patterns for common questions ──────
  // these handle sentence structures beyond "what is my X"
  const NL_GET_RULES: { re: RegExp; key: string; label: string }[] = [
    // city / residence
    { re: /which\s+city\s+(?:do|did)\s+(?:you|i)\s+(?:live|reside|stay)/i, key: "contact.city", label: "city" },
    { re: /which\s+city\s+(?:do|did)\s+(?:you|i)\s+(?:reside|live)\s*in/i, key: "contact.city", label: "city" },
    { re: /where\s+do\s+(?:you|i)\s+(?:live|reside|stay)/i, key: "contact.city", label: "city" },
    { re: /where\s+are\s+(?:you|i)\s+(?:based|living|staying)/i, key: "contact.city", label: "city" },
    { re: /what.s\s+(?:your|my)\s+(?:hometown|home\s*town|home\s*city)/i, key: "contact.city", label: "city" },
    // dob / age
    { re: /when\s+was\s+(?:i|you)\s+born/i, key: "personal.dob", label: "date of birth" },
    { re: /when\s+(?:were|was)\s+(?:you|i)\s+born/i, key: "personal.dob", label: "date of birth" },
    { re: /what.s\s+(?:your|my)\s+birthday/i, key: "personal.dob", label: "date of birth" },
    { re: /how\s+old\s+are\s+(?:you|i)/i, key: "personal.dob", label: "date of birth" },
    // full name
    { re: /what.s\s+(?:your|my)\s+(?:full\s+)?name/i, key: "personal.full_name", label: "full name" },
    { re: /who\s+am\s+i/i, key: "personal.full_name", label: "full name" },
    { re: /what\s+are\s+(?:you|i)\s+called/i, key: "personal.full_name", label: "full name" },
    // surname / last name
    { re: /what.s\s+(?:your|my)\s+(?:surname|last\s+name|family\s+name)/i, key: "personal.last_name", label: "last name" },
    { re: /who.s\s+(?:your|my)\s+(?:surname|last\s+name)/i, key: "personal.last_name", label: "last name" },
    // first name
    { re: /what.s\s+(?:your|my)\s+(?:first|given)\s+name/i, key: "personal.first_name", label: "first name" },
    // address
    { re: /where\s+do\s+(?:you|i)\s+(?:live|reside|stay)\b/i, key: "contact.current_address", label: "current address" },
    { re: /what.s\s+(?:your|my)\s+(?:home|residential)\s+address/i, key: "contact.current_address", label: "current address" },
    // email / phone
    { re: /what.s\s+(?:your|my)\s+(?:email|e-?mail)/i, key: "contact.email", label: "email" },
    { re: /how\s+can\s+(?:you|i)\s+be\s+(?:reached|contacted)/i, key: "contact.phone", label: "phone number" },
    { re: /what.s\s+(?:your|my)\s+(?:phone|mobile|number|contact)/i, key: "contact.phone", label: "phone number" },
    // father / mother
    { re: /who.s\s+(?:your|my)\s+(?:father|dad|papa)/i, key: "family.father_name", label: "father's name" },
    { re: /what.s\s+(?:your|my)\s+father.s\s+name/i, key: "family.father_name", label: "father's name" },
    { re: /who\s+(?:is|was)\s+(?:your|my)\s+(?:father|dad|papa)/i, key: "family.father_name", label: "father's name" },
    { re: /who.s\s+(?:your|my)\s+(?:mother|mom|mum)/i, key: "family.mother_name", label: "mother's name" },
    { re: /what.s\s+(?:your|my)\s+mother.s\s+name/i, key: "family.mother_name", label: "mother's name" },
    // nationality
    { re: /what.s\s+(?:your|my)\s+nationality/i, key: "personal.nationality", label: "nationality" },
    { re: /which\s+country\s+(?:are\s+you|am\s+i)\s+from/i, key: "personal.nationality", label: "nationality" },
    // company / business
    { re: /what.s\s+(?:your|my|the)\s+(?:company|firm|business)\s+name/i, key: "business.company_name", label: "company name" },
    { re: /what.s\s+(?:your|my)\s+company/i, key: "business.company_name", label: "company name" },
    { re: /how\s+(?:many|much)\s+(?:people|employees|staff|team)/i, key: "business.team_size", label: "team size" },
    { re: /what.s\s+(?:your|my)\s+(?:team\s+size|headcount)/i, key: "business.team_size", label: "team size" },
    { re: /what.s\s+(?:your|my)\s+(?:website|site|url)/i, key: "business.website", label: "company website" },
  ];
  for (const rule of NL_GET_RULES) {
    if (rule.re.test(text)) {
      const def = FIELD_MAP[rule.key];
      return {
        intent: def?.profileType === "business" ? "GET_BUSINESS_INFORMATION" : "GET_PERSONAL_INFORMATION",
        field_key: rule.key,
        requires_confirmation: false,
        confidence: 0.85,
        explanation: `Retrieving your ${rule.label}.`,
        utterance,
      };
    }
  }

  return fail("I'm not sure what to do with that. Try “fill this form”, “save this application”, or “what is my full name”.");
}

/** Example commands surfaced in the assistant UI. */
export const EXAMPLE_COMMANDS: { phrase: string; note: string }[] = [
  { phrase: "D, what is my full name?", note: "Retrieve a stored value" },
  { phrase: "D, what is my permanent address?", note: "Masked on screen, never read aloud in full" },
  { phrase: "D, remember that my father's name is Rahul Sharma.", note: "Saves after your confirmation" },
  { phrase: "D, fill this form using my business profile.", note: "Maps the active form for review" },
  { phrase: "D, our company has 12 employees now.", note: "Update a business field" },
  { phrase: "D, how many employees does my company have?", note: "Ask about business info" },
  { phrase: "D, save this application.", note: "Saves URL, reference and evidence" },
  { phrase: "D, what was my startup grant application reference number?", note: "Application memory" },
  { phrase: "D, show my recent applications.", note: "Browse application history" },
  { phrase: "D, which applications are pending?", note: "Filter by status" },
];
