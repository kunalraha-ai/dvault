/**
 * D-Vault multilingual intent engine (Indian languages).
 *
 * Extends the deterministic English parser with command patterns and field
 * vocabulary for Hindi (Devanagari + romanized/Hinglish), Marathi, Tamil,
 * Telugu, Kannada and Bengali, matching Gnani.ai's STT language coverage.
 *
 * Design: rule-based patterns run BEFORE the English parser. Every parsed
 * command still goes through the same confirmation/review flow — this only
 * widens *understanding*, never the safety rules.
 *
 * Honest scope (docs/LIMITATIONS.md): Hindi/Hinglish commands are supported
 * end-to-end (get, remember, fill, save-application, search, profile).
 * Marathi/Tamil/Telugu/Kannada/Bengali support the core commands
 * (get, fill, save-application, search). English remains the most complete.
 */

import type { ParsedIntent, Intent } from "./intents";
import { FIELD_MAP } from "./vault-schema";

// ---------------------------------------------------------------------------
// Field vocabulary — subject phrases → vault field keys
// ---------------------------------------------------------------------------

/** Substring hints per language (normalized, lowercase). */
const FIELD_HINTS: [string, string][] = [
  // Hindi compound phrases FIRST — the longest hint wins, so "पिता का नाम" beats "नाम"
  ["पिता का नाम", "family.father_name"],
  ["पापा का नाम", "family.father_name"],
  ["माता का नाम", "family.mother_name"],
  ["मां का नाम", "family.mother_name"],
  ["माँ का नाम", "family.mother_name"],
  ["कंपनी का नाम", "business.company_name"],
  ["स्थायी पता", "contact.permanent_address"],
  ["शहर", "contact.city"],
  ["जन्म तिथि", "personal.dob"],
  ["जन्मदिन", "personal.dob"],
  ["தந்தை பெயர்", "family.father_name"],
  ["தாய் பெயர்", "family.mother_name"],
  ["తండ్రి పేరు", "family.father_name"],
  ["తల్లి పేరు", "family.mother_name"],
  ["ತಂದೆ ಹೆಸರು", "family.father_name"],
  ["ತಾಯಿ ಹೆಸರು", "family.mother_name"],
  ["বাবার নাম", "family.father_name"],
  ["মায়ের নাম", "family.mother_name"],
  ["वडिलांचे नाव", "family.father_name"],
  ["आईचे नाव", "family.mother_name"],
  // Hindi / Hinglish
  ["नाम", "personal.full_name"],
  ["naam", "personal.full_name"],
  ["पूरा नाम", "personal.full_name"],
  ["पता", "contact.current_address"],
  ["pata", "contact.current_address"],
  ["स्थायी पता", "contact.permanent_address"],
  ["आधार", "identity.aadhaar"],
  ["aadhaar", "identity.aadhaar"],
  ["aadhar", "identity.aadhaar"],
  ["aadha", "identity.aadhaar"],
  ["आधार", "identity.aadhaar"],
  ["पैन", "identity.pan"],
  ["pan", "identity.pan"],
  ["ईमेल", "contact.email"],
  ["इमेल", "contact.email"],
  ["email", "contact.email"],
  ["फोन", "contact.phone"],
  ["मोबाइल", "contact.phone"],
  ["mobile", "contact.phone"],
  ["जन्म", "personal.dob"],
  ["जन्मदिन", "personal.dob"],
  ["पिता", "family.father_name"],
  ["पापा", "family.father_name"],
  ["pita", "family.father_name"],
  ["माता", "family.mother_name"],
  ["मां", "family.mother_name"],
  ["माँ", "family.mother_name"],
  ["कंपनी", "business.company_name"],
  ["company", "business.company_name"],
  ["फर्म", "business.company_name"],
  ["टीम", "business.team_size"],
  ["कर्मचारी", "business.team_size"],
  ["वेबसाइट", "business.website"],
  ["website", "business.website"],
  // Marathi
  ["नाव", "personal.full_name"],
  ["पत्ता", "contact.current_address"],
  ["आधार", "identity.aadhaar"],
  ["वडील", "family.father_name"],
  ["आई", "family.mother_name"],
  ["कंपनी", "business.company_name"],
  ["ईमेल", "contact.email"],
  ["फोन", "contact.phone"],
  // Tamil
  ["பெயர்", "personal.full_name"],
  ["peyar", "personal.full_name"],
  ["முகவரி", "contact.current_address"],
  ["ஆதார்", "identity.aadhaar"],
  ["பான்", "identity.pan"],
  ["மின்னஞ்சல்", "contact.email"],
  ["போன்", "contact.phone"],
  ["தந்தை", "family.father_name"],
  ["அப்பா", "family.father_name"],
  ["தாய்", "family.mother_name"],
  ["அம்மா", "family.mother_name"],
  ["நிறுவனம்", "business.company_name"],
  ["இணையதளம்", "business.website"],
  // Telugu
  ["పేరు", "personal.full_name"],
  ["peru", "personal.full_name"],
  ["చిరునామా", "contact.current_address"],
  ["ఆధార్", "identity.aadhaar"],
  ["పాన్", "identity.pan"],
  ["ఇమెయిల్", "contact.email"],
  ["ఫోన్", "contact.phone"],
  ["తండ్రి", "family.father_name"],
  ["నాన్న", "family.father_name"],
  ["తల్లి", "family.mother_name"],
  ["అమ్మ", "family.mother_name"],
  ["కంపెనీ", "business.company_name"],
  ["వెబ్సైట్", "business.website"],
  // Kannada
  ["ಹೆಸರು", "personal.full_name"],
  ["hesaru", "personal.full_name"],
  ["ವಿಳಾಸ", "contact.current_address"],
  ["ಆಧಾರ್", "identity.aadhaar"],
  ["ಪಾನ್", "identity.pan"],
  ["ಇಮೇಲ್", "contact.email"],
  ["ಫೋನ್", "contact.phone"],
  ["ತಂದೆ", "family.father_name"],
  ["ಅಪ್ಪ", "family.father_name"],
  ["ತಾಯಿ", "family.mother_name"],
  ["ಅಮ್ಮ", "family.mother_name"],
  ["ಕಂಪನಿ", "business.company_name"],
  ["ವೆಬ್ಸೈಟ್", "business.website"],
  // Bengali
  ["নাম", "personal.full_name"],
  ["ঠিকানা", "contact.current_address"],
  ["আধার", "identity.aadhaar"],
  ["আধার", "identity.aadhaar"],
  ["আধার", "identity.aadhaar"],
  ["ইমেইল", "contact.email"],
  ["ফোন", "contact.phone"],
  ["বাবা", "family.father_name"],
  ["মা", "family.mother_name"],
  ["কোম্পানি", "business.company_name"],
  ["ওয়েবসাইট", "business.website"],
];

function normalizeI18N(s: string): string {
  return s
    .toLowerCase()
    .replace(/[。।॥|•·।?؟,.;:"'()\-–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Resolve a subject phrase (any supported language) to a vault field key. */
export function resolveFieldI18N(phrase: string): string | null {
  const q = normalizeI18N(phrase);
  if (!q) return null;
  // longest hint wins (so "पूरा नाम" beats "नाम")
  let bestKey: string | null = null;
  let bestLen = 0;
  for (const [hint, key] of FIELD_HINTS) {
    if (q.includes(hint) && hint.length > bestLen) {
      bestLen = hint.length;
      bestKey = key;
    }
  }
  return bestKey;
}

// ---------------------------------------------------------------------------
// Command rules
// ---------------------------------------------------------------------------

interface Rule {
  intent: "FILL_ACTIVE_FORM" | "SAVE_APPLICATION" | "SEARCH_APPLICATIONS" | "SET_ACTIVE_PROFILE";
  re: RegExp;
  profile?: "personal" | "business";
}

const RULES: Rule[] = [
  // ---------- FILL (all languages) ----------
  { intent: "FILL_ACTIVE_FORM", re: /(?:यह|इस|ਇਹ)?\s*(?:फॉर्म|फ़ॉर्म|फार्म|एप्लीकेशन|आवेदन|फॉर्म)\s*(?:को|का|की)?\s*(?:भरो|भर दो|भरें|भरदो|पूरा करो|भर)/i },
  { intent: "FILL_ACTIVE_FORM", re: /\b(?:form|phorm|farm)\b[^.]{0,24}\b(?:bharo|bhar do|bharna|fill karo|fill kar|fill)\b/i },
  { intent: "FILL_ACTIVE_FORM", re: /(?:இந்த|இது)?\s*(?:படிவம்|படிவத்தை|ஃபார்ம்|அப்ளிகேஷன்)\s*(?:ஐ)?\s*(?:நிரப்பு|நிரப்புங்கள்|நிரப்பவும்|பூரத்து)/i },
  { intent: "FILL_ACTIVE_FORM", re: /(?:ఈ|ఇది)?\s*(?:ఫారం|ఫారము|ఫార్మ్|అప్లికేషన్)\s*(?:ని|ను)?\s*(?:నింపు|నింపండి|పూర్తి చేయి)/i },
  { intent: "FILL_ACTIVE_FORM", re: /(?:ಈ|ಇದನ್ನು)?\s*(?:ಫಾರ್ಮ್|ಫಾರಮ್|ಅಪ್ಲಿಕೇಶನ್)\s*(?:ಅನ್ನು)?\s*(?:ತುಂಬಿಸು|ತುಂಬಿಸಿ|ಪೂರ್ಣಗೊಳಿಸು)/i },
  { intent: "FILL_ACTIVE_FORM", re: /(?:এই|এটা)?\s*(?:ফর্ম|ফার্ম|অ্যাপ্লিকেশন|আবেদন)\s*(?:টি|কে)?\s*(?:পূরণ|ভরো|ভরে দাও|পূরণ করো)/i },
  { intent: "FILL_ACTIVE_FORM", re: /(?:हा|या|ही)?\s*(?:फॉर्म|अर्ज|एप्लिकेशन)\s*(?:भरा|भर|भरा मी|पूर्ण करा)/i },
  // ---------- SAVE APPLICATION ----------
  { intent: "SAVE_APPLICATION", re: /(?:आवेदन|एप्लीकेशन|अर्ज)\s*(?:को|का)?\s*(?:सेव|सहेज|सहेजो|बचाओ|साठव)(?:\s*करो|करें|करा)?/i },
  { intent: "SAVE_APPLICATION", re: /\b(?:application|avedan)\b[^.]{0,16}\b(?:save|sambhal|store)\b|\b(?:save|save karo)\b[^.]{0,16}\b(?:application|avedan)\b/i },
  { intent: "SAVE_APPLICATION", re: /(?:விண்ணப்பம்|படிவம்)\s*(?:ஐ)?\s*(?:சேமி|சேமிக்கவும்|பதிவு)/i },
  { intent: "SAVE_APPLICATION", re: /(?:అప్లికేషన్|దరఖాస్తు)\s*(?:ను)?\s*(?:సేవ్|నిల్వ)/i },
  { intent: "SAVE_APPLICATION", re: /(?:ಅಪ್ಲಿಕೇಶನ್|ಅರ್ಜಿ)\s*(?:ಅನ್ನು)?\s*(?:ಉಳಿಸು|ಸೇವ್)/i },
  { intent: "SAVE_APPLICATION", re: /(?:আবেদন|অ্যাপ্লিকেশন)\s*(?:টি|কে)?\s*(?:সেভ|সংরক্ষণ|রক্ষা)/i },
  { intent: "SAVE_APPLICATION", re: /(?:अर्ज|आवेदन)\s*(?:सेव|साठवा|जतन)/i },
  // ---------- SEARCH / LIST APPLICATIONS ----------
  { intent: "SEARCH_APPLICATIONS", re: /(?:आवेदन|एप्लीकेशन|अर्ज)\s*(?:दिखाओ|दिखाएं|सूची|सूची दिखाओ)/i },
  { intent: "SEARCH_APPLICATIONS", re: /(?:விண்ணப்பங்களை|விண்ணப்பம்|பட்டியல்)\s*(?:காட்டு|காட்டுங்கள்|பட்டியல்)/i },
  { intent: "SEARCH_APPLICATIONS", re: /(?:దరఖాస్తులు|అప్లికేషన్)\s*(?:చూపించు|జాబితా)/i },
  { intent: "SEARCH_APPLICATIONS", re: /(?:ಅರ್ಜಿಗಳನ್ನು|ಅಪ್ಲಿಕೇಶನ್)\s*(?:ತೋರಿಸು|ಪಟ್ಟಿ)/i },
  { intent: "SEARCH_APPLICATIONS", re: /(?:আবেদন|অ্যাপ্লিকেশন)\s*(?:দেখাও|তালিকা)/i },
  { intent: "SEARCH_APPLICATIONS", re: /(?:अर्ज|आवेदन)\s*(?:दाखवा|यादी)/i },
];

/** Possessive + question patterns per language for "what is my X". */
const GET_RULES: { re: RegExp; capture: number }[] = [
  // Hindi: "मेरा नाम क्या है" / "मेरा नाम बताओ" / "mera naam kya hai" / "मैं किस शहर में रहता हूँ"
  { re: /(?:मेरा|मेरी|मेरे|अपना|mera|meri|mere|apna)\s+(.+?)\s+(?:क्या है|क्या हैं|क्या हे|क्या|बताओ|बताइए|बता|kya hai|kya he|kya h|batao|bataiye|bata)\s*\??$/i, capture: 1 },
  // Hindi SOV: "मैं किस शहर में रहता हूँ" (I in which city live)
  { re: /मैं\s+(?:किस|कहाँ|कहां)\s+(.+?)\s+(?:में|में)\s+(?:रहता|रहती|रहते|रहा|rahta|rahti)\s+(?:हूँ|हैं|hu|hun)\s*\??$/i, capture: 1 },
  // English: "name of the place where I live"
  { re: /name\s+of\s+the\s+place\s+where\s+(?:you|i)\s+(?:currently\s+)?(?:live|reside|stay)/i, capture: -1 },
  // Marathi: "माझे नाव काय" / "माझे नाव सांगा"
  { re: /(?:माझे|माझा|माझी|majhe|majha)\s+(.+?)\s+(?:काय|काय आहे|सांगा|सांग|kay|sanga)\s*\??$/i, capture: 1 },
  // Tamil: "என் பெயர் என்ன" / "en peyar enna"
  { re: /(?:என்|en)\s+(.+?)\s+(?:என்ன|என்னவொன்று|சொல்லு|சொல்லுங்கள்|enna|sollu|solllu)\s*\??$/i, capture: 1 },
  // Telugu: "నా పేరు ఏమిటి" / "na peru emiti"
  { re: /(?:నా|na)\s+(.+?)\s+(?:ఏమిటి|ఏమిట‌|చెప్పు|emiti|cheppu)\s*\??$/i, capture: 1 },
  // Kannada: "ನನ್ನ ಹೆಸರು ಏನು" / "nanna hesaru enu"
  { re: /(?:ನನ್ನ|nanna)\s+(.+?)\s+(?:ಏನು|ಏನು\?|ಹೇಳು|enu|helu)\s*\??$/i, capture: 1 },
  // Bengali: "আমার নাম কি" / "amar naam ki"
  { re: /(?:আমার|amar)\s+(.+?)\s+(?:কি|কী|বলো|বলুন|ki|bolo|balun)\s*\??$/i, capture: 1 },
];

/** REMEMBER rules. Hindi/Hinglish are SOV — the value comes BEFORE the final
 *  है, so we capture the whole pre-copula segment and split it on the field
 *  hint programmatically (see splitSubjectValue). */
const REMEMBER_RULES: { re: RegExp; segment: number }[] = [
  // "याद रखो कि मेरे पिता का नाम राहुल शर्मा है" — segment = "मेरे पिता का नाम राहुल शर्मा"
  { re: /(?:याद रखो|याद रखिए|याद रखना|yaad rakho|yaad rakh|rakhna|remember karo)\s*(?:कि|ki|की)?\s*(.+?)\s*(?:है|हैं|hai|he|h)\s*$/i, segment: 1 },
  // "मेरा नाम राहुल शर्मा है" (plain statement, no "remember")
  { re: /^(?:मेरा|मेरी|मेरे|mera|meri|mere)\s+(.+?)\s*(?:है|हैं|hai|he)\s*$/i, segment: 1 },
  // generic multilingual with "is"/=: "remember/निऩைவில்/గుర్తు/ನೆನಪು/মনে … <subject> is <value>"
  { re: /(?:remember|याद|நினைவில்|గుర్తు|ನೆನಪು|মনে|लक्ष|smaran)\b[^.]{0,40}?(.+?)\s+(?:is|=)\s+(.+)$/i, segment: -1 },
];

/** Split an SOV pre-copula segment into (fieldKey, value) using the hint
 *  vocabulary: the longest hint in the segment marks the field phrase; the
 *  words after it are the value. */
function splitSubjectValue(segment: string): { key: string; value: string } | null {
  const q = segment.toLowerCase().replace(/\s+/g, " ").trim();
  let bestHint = "";
  let bestKey = "";
  for (const [hint, key] of FIELD_HINTS) {
    const idx = q.indexOf(hint);
    if (idx !== -1 && hint.length > bestHint.length) {
      bestHint = hint;
      bestKey = key;
    }
  }
  if (!bestKey) return null;
  let value = q.slice(q.indexOf(bestHint) + bestHint.length).trim();
  // strip connector words left over from the field phrase
  value = value.replace(/^(?:का|की|के|को|है|ka|ki|ke|ko|number|नंबर|न।|no\.?|id)\s+/i, "").trim();
  return { key: bestKey, value };
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

const fail = (utterance: string, explanation: string): ParsedIntent => ({
  intent: "UNKNOWN",
  requires_confirmation: false,
  confidence: 0,
  explanation,
  utterance,
});

/**
 * Parse an utterance in a supported Indian language. Returns null when no
 * multilingual rule matches (the caller falls back to the English parser).
 */
export function parseIntentI18N(rawUtterance: string): ParsedIntent | null {
  const utterance = rawUtterance.trim();
  if (!utterance) return null;

  // ---- "what is my X" ----
  for (const { re, capture } of GET_RULES) {
    const m = utterance.match(re);
    if (m) {
      if (capture === -1) {
        // fixed-field match (no capture group) — "name of the place where I live" → city
        const key = "contact.city";
        const def = FIELD_MAP[key];
        return {
          intent: "GET_PERSONAL_INFORMATION",
          field_key: key,
          requires_confirmation: false,
          confidence: 0.82,
          explanation: `Your ${def?.label ?? key} — shown on screen.`,
          utterance,
        };
      }
      const key = resolveFieldI18N(m[capture]);
      if (!key) return fail(utterance, "I heard the question but didn't recognise that field in this language — try English wording for now.");
      const def = FIELD_MAP[key];
      return {
        intent: def?.profileType === "business" ? "GET_BUSINESS_INFORMATION" : "GET_PERSONAL_INFORMATION",
        field_key: key,
        requires_confirmation: false,
        confidence: 0.88,
        explanation: `${def?.label ?? key} — shown on screen, spoken per your privacy settings.`,
        utterance,
      };
    }
  }

  // ---- "remember that my X is Y" ----
  for (const { re, segment } of REMEMBER_RULES) {
    const m = utterance.match(re);
    if (m) {
      const split = segment === -1
        ? { key: resolveFieldI18N(m[1]) ?? "", value: m[2].trim() }
        : splitSubjectValue(m[1]);
      if (split && split.key) {
        const def = FIELD_MAP[split.key];
        return {
          intent: "SAVE_INFORMATION",
          field_key: split.key,
          value: split.value,
          requires_confirmation: true,
          confidence: 0.85,
          explanation: `Save “${def?.label ?? split.key}” as “${split.value}”? Review before I store it.`,
          utterance,
        };
      }
    }
  }

  // ---- fixed-phrase intents ----
  for (const rule of RULES) {
    if (rule.re.test(utterance)) {
      const out: ParsedIntent = {
        intent: rule.intent as Intent,
        requires_confirmation: rule.intent === "SAVE_APPLICATION" || rule.intent === "FILL_ACTIVE_FORM",
        confidence: 0.9,
        explanation:
          rule.intent === "FILL_ACTIVE_FORM"
            ? "I'll inspect the active form and propose a mapping for your review."
            : rule.intent === "SAVE_APPLICATION"
              ? "I can save this application after you confirm."
              : "Searching your saved applications.",
        utterance,
      };
      // attach a profile when the utterance names one
      if (/business|कंपनी|कारोबार|வணிக|நிறுவன|వ్యాపార|ವ್ಯಾಪಾರ|ব্যবসা|व्यवसाय/i.test(utterance)) {
        out.profile_type = "business";
      } else if (/personal|निजी|தனிப்பட்ட|వ్యక్తిಗత|ವೈಯಕ್ತಿಕ|ব্যক্তিগত|वैयक्तिक/i.test(utterance)) {
        out.profile_type = "personal";
      }
      return out;
    }
  }

  return null;
}
