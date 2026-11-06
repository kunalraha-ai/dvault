/**
 * D-Vault universal form-field mapping engine.
 *
 * Given the metadata of a single field extracted from an active web form
 * (label, placeholder, input type, options… — never its value) this engine
 * determines which vault field could fill it, with a confidence score:
 *
 *   >= 0.85  high    → proposed for approval automatically
 *   >= 0.55  medium  → shown for manual selection
 *    < 0.55  low     → user is asked
 *
 * The engine is fully deterministic and runs on the user's device — website
 * text is treated as untrusted input and is only ever compared against a
 * fixed lexicon. No page content is sent to any LLM unless the user
 * explicitly enables AI-assisted mapping (which itself only ever receives
 * labels, types and options — never values).
 */

import { FIELD_SYNONYMS, BUSINESS_CONTEXT_TOKENS, PERSONAL_CONTEXT_TOKENS } from "./lexicon";
import type { FieldDef, ProfileType } from "./vault-schema";
import { FIELDS } from "./vault-schema";

// ---------------------------------------------------------------------------
// Form field metadata (produced by the extension's content-script inspector)
// ---------------------------------------------------------------------------

export type ExtractedFieldType =
  | "text" | "email" | "tel" | "number" | "date"
  | "textarea" | "select" | "radio" | "checkbox"
  | "unsupported";

export interface FormFieldMetadata {
  /** Stable id for this form (from extension inspector) */
  formId: string;
  /** Unique element id: element.id, name, or generated index */
  id: string;
  /** Best-effort human label computed from <label>, aria-label, placeholder… */
  label: string;
  placeholder?: string;
  type: ExtractedFieldType;
  required: boolean;
  /** For select/radio: the available options */
  options?: string[];
  /** Maximum length constraint if present */
  maxLength?: number;
  /** Numeric range constraints for number inputs */
  min?: number;
  max?: number;
  /** True when the inspector knows D cannot reliably fill this field */
  supported: boolean;
  unsupportedReason?: string;
  /** Raw autocomplete attribute — a hint, treated as untrusted website input */
  autocompleteHint?: string;
  /** Which form (page) this field belongs to, when the page has several */
  formLabel?: string;
}

export interface FormContext {
  url: string;
  host: string;
  title: string;
  /** Number of forms detected on the page */
  formCount: number;
  /** All label text joined — used only for soft context boosting, never stored */
  labelsDigest: string;
}

// ---------------------------------------------------------------------------
// Mapping results
// ---------------------------------------------------------------------------

export type ConfidenceLevel = "high" | "medium" | "low" | "none";

export interface FieldMapping {
  fieldKey: string | null;
  confidence: number;
  level: ConfidenceLevel;
  /** Human explanation shown in the review panel */
  reason: string;
}

export interface MappingCandidate {
  fieldKey: string;
  confidence: number;
  label: string;
}

export interface MappingOutcome {
  mapping: FieldMapping;
  /** Vault has no value stored for the mapped field */
  missingInVault: boolean;
  /** Top alternatives for the manual-selection UI (excludes the chosen one) */
  alternatives: MappingCandidate[];
}

// ---------------------------------------------------------------------------
// Text similarity
// ---------------------------------------------------------------------------

const STOPWORDS = new Set([
  "the", "a", "an", "of", "for", "and", "or", "to", "in", "on", "your", "you",
  "please", "enter", "provide", "this", "that", "is", "are", "what", "which",
  "do", "does", "with", "as", "per", "if", "any", "all", "current", "have",
]);

export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[•·]/g, " ")
    .replace(/\(.*?\)/g, " ")      // drop parenthetical qualifiers
    .replace(/[^a-z0-9\s]/g, " ")  // strip punctuation (keeps "co-founder" split)
    // expand English contractions so the parser sees full words
    .replace(/\bwhat's\b/g, "what is")
    .replace(/\bwho's\b/g, "who is")
    .replace(/\bwhere's\b/g, "where is")
    .replace(/\bwhen's\b/g, "when is")
    .replace(/\bhow's\b/g, "how is")
    .replace(/\bit's\b/g, "it is")
    .replace(/\bthat's\b/g, "that is")
    .replace(/\bwhat're\b/g, "what are")
    .replace(/\bwho're\b/g, "who are")
    .replace(/\bmy\s+name's\b/g, "my name is")
    .replace(/\bi'm\b/g, "i am")
    .replace(/\bdon't\b/g, "do not")
    .replace(/\bcan't\b/g, "can not")
    .replace(/\s+/g, " ")
    .trim();
}

function bigrams(s: string): Set<string> {
  const t = s.replace(/\s/g, "");
  const out = new Set<string>();
  for (let i = 0; i < t.length - 1; i++) out.add(t.slice(i, i + 2));
  return out;
}

/** Dice coefficient over character bigrams: robust for short phrases. */
function diceSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const A = bigrams(a);
  const B = bigrams(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const g of A) if (B.has(g)) inter++;
  return (2 * inter) / (A.size + B.size);
}

function tokens(s: string): string[] {
  return normalizeText(s)
    .split(" ")
    .filter((w) => w && !STOPWORDS.has(w));
}

/** 0..1: how many meaningful tokens of `phrase` appear in `text`. */
function tokenContainment(text: string, phrase: string): number {
  const tTokens = tokens(text);
  if (!tTokens.length) return 0;
  const pTokens = tokens(phrase);
  if (!pTokens.length) return 0;
  const tSet = new Set(tTokens);
  let hit = 0;
  for (const w of pTokens) if (tSet.has(w)) hit++;
  const coverage = hit / pTokens.length;
  const density = hit / tTokens.length; // label that is *mostly* the phrase scores higher
  return coverage * 0.75 + density * 0.25;
}

// ---------------------------------------------------------------------------
// Input-type compatibility
// ---------------------------------------------------------------------------

const TYPE_COMPAT: Record<ExtractedFieldType, string[]> = {
  email: ["email"],
  tel: ["tel", "text"],
  date: ["date"],
  number: ["number"],
  select: ["select", "text"],
  radio: ["select", "text"],
  checkbox: [],
  textarea: ["textarea", "text"],
  text: ["text", "email", "tel", "number", "date", "select", "url", "textarea"],
  unsupported: [],
};

/** Maps HTML input types onto vault input types. */
const HTML_TYPE_HINT: Record<string, string> = {
  email: "email",
  tel: "tel",
  number: "number",
  date: "date",
};

function typeCompatibility(field: FormFieldMetadata, def: FieldDef): number {
  const allowed = TYPE_COMPAT[field.type] ?? TYPE_COMPAT.text;
  if (allowed.length === 0) return 0; // checkbox: D does not check boxes
  if (allowed.includes(def.inputType)) return 1;
  // email input wants an email vault field; accept text as fallback
  if (field.type === "email" && def.inputType === "url") return 0.5;
  return 0.3;
}

function autocompleteHintKey(hint?: string): string | null {
  if (!hint) return null;
  const h = hint.toLowerCase();
  const direct: Record<string, string> = {
    "email": "contact.email",
    "given-name": "personal.first_name",
    "additional-name": "personal.middle_name",
    "family-name": "personal.last_name",
    "name": "personal.full_name",
    "organization": "business.company_name",
    "url": "business.website",
    "tel": "contact.phone",
    "postal-code": "contact.postal_code",
    "address-line1": "contact.current_address",
    "bday": "personal.dob",
  };
  if (direct[h]) return direct[h];
  if (h.startsWith("email")) return "contact.email";
  if (h.startsWith("tel")) return "contact.phone";
  return null;
}

// ---------------------------------------------------------------------------
// The mapper
// ---------------------------------------------------------------------------

export interface MapOptions {
  profileType?: ProfileType | null;
  /** Field keys the vault actually has values for (empty = report all missing) */
  availableKeys?: Set<string>;
  /** Page-level context for soft boosting */
  formContext?: FormContext;
}

function contextBoost(key: string, ctx?: FormContext): number {
  if (!ctx) return 0;
  const digest = normalizeText(ctx.labelsDigest + " " + ctx.title);
  const isBusinessKey = key.startsWith("business.");
  const hasBusinessTokens = BUSINESS_CONTEXT_TOKENS.some((t) => digest.includes(t));
  const hasPersonalTokens = PERSONAL_CONTEXT_TOKENS.some((t) => digest.includes(t));
  if (isBusinessKey && hasBusinessTokens) return 0.05;
  if (!isBusinessKey && hasPersonalTokens && !hasBusinessTokens) return 0.05;
  return 0;
}

/**
 * Score a single website form field against every vault field (optionally
 * restricted to one profile type). Returns the best mapping plus
 * alternatives for the manual-selection UI.
 */
export function mapFormField(
  field: FormFieldMetadata,
  options: MapOptions = {},
): MappingOutcome {
  const searchLabel = [
    field.label,
    field.placeholder,
    field.formLabel,
  ].filter(Boolean).join(" ");
  const norm = normalizeText(searchLabel);

  const candidates: MappingCandidate[] = [];
  let best: { key: string; score: number; matchedPhrase: string; via: string } | null = null;

  for (const def of FIELDS) {
    if (options.profileType && def.profileType !== options.profileType) continue;

    // -- direct lexicon matching -------------------------------------------
    let synScore = 0;
    let matchedPhrase = "";
    for (const phrase of FIELD_SYNONYMS[def.key] ?? []) {
      const p = normalizeText(phrase);
      let score = 0;
      if (norm === p) score = 1;
      else if (norm.includes(p)) score = 0.92;
      else if (p.includes(norm) && norm.length >= 3) score = 0.8;
      else {
        const cont = tokenContainment(norm, p);
        const dice = diceSimilarity(norm, p);
        score = Math.max(cont * 0.85, dice * 0.7);
      }
      if (score > synScore) {
        synScore = score;
        matchedPhrase = phrase;
      }
    }

    // -- type compatibility --------------------------------------------------
    const typeScore = typeCompatibility(field, def);
    if (typeScore === 0) continue;

    // -- autocomplete hint (weak but useful signal) --------------------------
    let hintScore = 0;
    const hintKey = autocompleteHintKey(field.autocompleteHint);
    if (hintKey === def.key) hintScore = 0.6;

    const labelBonus = field.label ? 0.05 : 0; // real labels beat bare placeholders
    const requiredBonus = 0; // required-ness does not influence identity of match
    let total =
      synScore * 0.72 + typeScore * 0.14 + hintScore * 0.09 + labelBonus + contextBoost(def.key, options.formContext);

    // Sensitive fields need a stronger signal before D proposes them on its own:
    // they are still fillable, but land in "manual selection" more often.
    if (def.sensitive) total *= 0.9;

    // penalize field/label type contradictions
    if (field.type === "email" && def.inputType !== "email") total -= 0.25;
    if (field.type === "tel" && def.inputType !== "tel" && def.inputType !== "text") total -= 0.25;
    if (field.type === "date" && def.inputType !== "date") total -= 0.3;
    if (field.type === "number" && def.inputType !== "number" && def.inputType !== "text") total -= 0.2;
    if (field.type === "textarea" && def.inputType !== "textarea" && def.inputType !== "text") total -= 0.15;

    total = Math.max(0, Math.min(1, total));

    if (!best || total > best.score) {
      best = { key: def.key, score: total, matchedPhrase, via: "lexicon" };
    }
    if (total > 0.3) {
      candidates.push({ fieldKey: def.key, confidence: total, label: def.label });
    }
  }

  // fallback when nothing scored: number inputs still shouldn't map wildly
  const level: ConfidenceLevel = !best
    ? "none"
    : best.score >= 0.85
      ? "high"
      : best.score >= 0.55
        ? "medium"
        : best.score >= 0.3
          ? "low"
          : "none";

  const alternatives = candidates
    .filter((c) => !best || c.fieldKey !== best.key)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5);

  const available = options.availableKeys;
  const missingInVault = Boolean(
    best && available && !available.has(best.key),
  );

  return {
    mapping: {
      fieldKey: best && level !== "none" ? best.key : null,
      confidence: best ? Number(best.score.toFixed(3)) : 0,
      level,
      reason: best && level !== "none"
        ? `"${field.label || field.placeholder || field.id}" looks like ${best.matchedPhrase}`
        : "No matching vault field",
    },
    missingInVault,
    alternatives,
  };
}

/** Map a whole form's fields at once. */
export function mapForm(
  fields: FormFieldMetadata[],
  options: MapOptions = {},
): MappingOutcome[] {
  return fields.map((f) => mapFormField(f, options));
}

/**
 * Pick a sensible value transformation for a select field given the chosen
 * vault value (exact > case-insensitive > starts-with). Returns null when the
 * vault value does not fit any option.
 */
export function matchSelectOption(
  options: string[],
  value: string,
): string | null {
  if (!options || !options.length) return null;
  const v = value.trim();
  const norm = (s: string) => s.trim().toLowerCase();
  const exact = options.find((o) => o === v) ?? options.find((o) => norm(o) === norm(v));
  if (exact) return exact;
  const partial = options.find(
    (o) => norm(o).startsWith(norm(v)) || norm(v).startsWith(norm(o)),
  );
  if (partial) return partial;
  return null;
}
