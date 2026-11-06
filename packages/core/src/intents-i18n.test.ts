import { describe, it, expect } from "vitest";
import { parseIntent, resolveFieldI18N } from "./intents-i18n";
import { parseIntent as parseIntentFull } from "./intents";

// ---------------------------------------------------------------------------
// Multilingual intent engine — Indian languages
// ---------------------------------------------------------------------------

describe("multilingual intents: Hindi (Devanagari + Hinglish)", () => {
  it("मेरा नाम क्या है? → GET personal.full_name", () => {
    const r = parseIntentFull("D, मेरा नाम क्या है?");
    expect(r.intent).toBe("GET_PERSONAL_INFORMATION");
    expect(r.field_key).toBe("personal.full_name");
  });

  it("mera aadhaar number kya hai → GET identity.aadhaar", () => {
    const r = parseIntentFull("D, mera aadhaar number kya hai");
    expect(r.intent).toBe("GET_PERSONAL_INFORMATION");
    expect(r.field_key).toBe("identity.aadhaar");
  });

  it("याद रखो कि मेरे पिता का नाम राहुल शर्मा है → SAVE family.father_name", () => {
    const r = parseIntentFull("D, याद रखो कि मेरे पिता का नाम राहुल शर्मा है");
    expect(r.intent).toBe("SAVE_INFORMATION");
    expect(r.field_key).toBe("family.father_name");
    expect(r.value).toBe("राहुल शर्मा");
    expect(r.requires_confirmation).toBe(true);
  });

  it("यह फॉर्म भरो → FILL_ACTIVE_FORM", () => {
    const r = parseIntentFull("D, यह फॉर्म भरो");
    expect(r.intent).toBe("FILL_ACTIVE_FORM");
    expect(r.requires_confirmation).toBe(true);
  });

  it("form bhar do → FILL_ACTIVE_FORM (Hinglish)", () => {
    const r = parseIntentFull("D, form bhar do");
    expect(r.intent).toBe("FILL_ACTIVE_FORM");
  });

  it("आवेदन सेव करो → SAVE_APPLICATION", () => {
    const r = parseIntentFull("D, आवेदन सेव करो");
    expect(r.intent).toBe("SAVE_APPLICATION");
    expect(r.requires_confirmation).toBe(true);
  });

  it("मेरे कंपनी का फॉर्म भरो → FILL with business profile", () => {
    const r = parseIntentFull("D, कंपनी फॉर्म भरो");
    expect(r.intent).toBe("FILL_ACTIVE_FORM");
    expect(r.profile_type).toBe("business");
  });

  it("मेरा ईमेल बताओ → GET contact.email", () => {
    const r = parseIntentFull("D, मेरा ईमेल बताओ");
    expect(r.intent).toBe("GET_PERSONAL_INFORMATION");
    expect(r.field_key).toBe("contact.email");
  });
});

describe("multilingual intents: Tamil / Telugu / Kannada / Bengali / Marathi", () => {
  it("என் பெயர் என்ன? → GET personal.full_name", () => {
    const r = parseIntentFull("D, என் பெயர் என்ன?");
    expect(r.intent).toBe("GET_PERSONAL_INFORMATION");
    expect(r.field_key).toBe("personal.full_name");
  });

  it("என் ஆதார் எண் என்ன? → GET identity.aadhaar", () => {
    const r = parseIntentFull("D, என் ஆதார் எண் என்ன?");
    expect(r.field_key).toBe("identity.aadhaar");
  });

  it("இந்த படிவத்தை நிரப்பு → FILL_ACTIVE_FORM", () => {
    const r = parseIntentFull("D, இந்த படிவத்தை நிரப்பு");
    expect(r.intent).toBe("FILL_ACTIVE_FORM");
  });

  it("నా పేరు ఏమిటి? → GET personal.full_name", () => {
    const r = parseIntentFull("D, నా పేరు ఏమిటి?");
    expect(r.intent).toBe("GET_PERSONAL_INFORMATION");
    expect(r.field_key).toBe("personal.full_name");
  });

  it("నా తండ్రి పేరు ఏమిటి? → GET family.father_name", () => {
    const r = parseIntentFull("D, నా తండ్రి పేరు ఏమిటి?");
    expect(r.field_key).toBe("family.father_name");
  });

  it("ನನ್ನ ಹೆಸರು ಏನು? → GET personal.full_name", () => {
    const r = parseIntentFull("D, ನನ್ನ ಹೆಸರು ಏನು?");
    expect(r.intent).toBe("GET_PERSONAL_INFORMATION");
    expect(r.field_key).toBe("personal.full_name");
  });

  it("আমার নাম কি? → GET personal.full_name", () => {
    const r = parseIntentFull("D, আমার নাম কি?");
    expect(r.intent).toBe("GET_PERSONAL_INFORMATION");
    expect(r.field_key).toBe("personal.full_name");
  });

  it("माझे नाव काय? → GET personal.full_name", () => {
    const r = parseIntentFull("D, माझे नाव काय?");
    expect(r.intent).toBe("GET_PERSONAL_INFORMATION");
    expect(r.field_key).toBe("personal.full_name");
  });

  it("माझा आधार क्रमांक काय? → GET identity.aadhaar", () => {
    const r = parseIntentFull("D, माझा आधार क्रमांक काय?");
    expect(r.field_key).toBe("identity.aadhaar");
  });
});

describe("multilingual: English still works identically", () => {
  it("what is my full name? → GET (English path untouched)", () => {
    const r = parseIntentFull("D, what is my full name?");
    expect(r.intent).toBe("GET_PERSONAL_INFORMATION");
    expect(r.field_key).toBe("personal.full_name");
  });

  it("fill this form using my business profile → FILL (English path untouched)", () => {
    const r = parseIntentFull("D, fill this form using my business profile");
    expect(r.intent).toBe("FILL_ACTIVE_FORM");
    expect(r.profile_type).toBe("business");
  });
});

describe("resolveFieldI18N", () => {
  it("resolves native and romanized phrases", () => {
    expect(resolveFieldI18N("नाम")).toBe("personal.full_name");
    expect(resolveFieldI18N("आधार नंबर")).toBe("identity.aadhaar");
    expect(resolveFieldI18N("aadhaar number")).toBe("identity.aadhaar");
    expect(resolveFieldI18N("தந்தை பெயர்")).toBe("family.father_name");
    expect(resolveFieldI18N("unrecognised thing")).toBeNull();
  });

  it("longest hint wins", () => {
    expect(resolveFieldI18N("पूरा नाम")).toBe("personal.full_name");
  });
});
