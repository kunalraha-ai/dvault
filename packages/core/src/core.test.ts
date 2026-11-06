import { describe, it, expect } from "vitest";
import {
  parseIntent, stripWakePhrase, resolveFieldPhrase,
  mapFormField, matchSelectOption, normalizeText,
} from "@dvault/core";

// ---------------------------------------------------------------------------
// Intent engine — the spec's example commands
// ---------------------------------------------------------------------------

describe("intent engine", () => {
  it("parses GET_PERSONAL_INFORMATION for 'D, what is my full name?'", () => {
    const r = parseIntent("D, what is my full name?");
    expect(r.intent).toBe("GET_PERSONAL_INFORMATION");
    expect(r.field_key).toBe("personal.full_name");
    expect(r.requires_confirmation).toBe(false);
  });

  it("parses GET for permanent address", () => {
    const r = parseIntent("D, what is my permanent address?");
    expect(r.intent).toBe("GET_PERSONAL_INFORMATION");
    expect(r.field_key).toBe("contact.permanent_address");
  });

  it("parses SAVE_INFORMATION from 'remember that my father's name is Rahul Sharma'", () => {
    const r = parseIntent("D, remember that my father's name is Rahul Sharma.");
    expect(r.intent).toBe("SAVE_INFORMATION");
    expect(r.field_key).toBe("family.father_name");
    expect(r.value).toBe("Rahul Sharma");
    expect(r.requires_confirmation).toBe(true);
  });

  it("parses FILL_ACTIVE_FORM with business profile", () => {
    const r = parseIntent("D, fill this application using my business profile.");
    expect(r.intent).toBe("FILL_ACTIVE_FORM");
    expect(r.profile_type).toBe("business");
    expect(r.requires_confirmation).toBe(true);
  });

  it("parses FILL_ACTIVE_FORM plain", () => {
    const r = parseIntent("D, fill this form.");
    expect(r.intent).toBe("FILL_ACTIVE_FORM");
    expect(r.requires_confirmation).toBe(true);
  });

  it("parses SET_ACTIVE_PROFILE", () => {
    const r = parseIntent("D, use my business profile");
    expect(r.intent).toBe("SET_ACTIVE_PROFILE");
    expect(r.profile_type).toBe("business");
  });

  it("parses business fact: 'our company has 12 employees now'", () => {
    const r = parseIntent("D, our company has 12 employees now.");
    expect(r.intent).toBe("UPDATE_INFORMATION");
    expect(r.field_key).toBe("business.team_size");
    expect(r.value).toBe("12");
    expect(r.requires_confirmation).toBe(true);
  });

  it("parses GET_BUSINESS_INFORMATION: 'how many employees does my company have?'", () => {
    const r = parseIntent("D, how many employees does my company have?");
    expect(r.intent).toBe("GET_BUSINESS_INFORMATION");
    expect(r.field_key).toBe("business.team_size");
  });

  it("parses SAVE_APPLICATION", () => {
    const r = parseIntent("D, save this application.");
    expect(r.intent).toBe("SAVE_APPLICATION");
    expect(r.requires_confirmation).toBe(true);
  });

  it("parses GET_APPLICATION_DETAILS for a reference number query", () => {
    const r = parseIntent("D, what was my startup grant application reference number?");
    expect(r.intent).toBe("GET_APPLICATION_DETAILS");
    expect(r.field_requested).toBe("reference");
    expect(r.query).toBeTruthy();
  });

  it("parses SEARCH_APPLICATIONS recent", () => {
    const r = parseIntent("D, show my recent applications.");
    expect(r.intent).toBe("SEARCH_APPLICATIONS");
    expect(r.timeframe).toBe("recent");
  });

  it("parses SEARCH_APPLICATIONS by status", () => {
    const r = parseIntent("D, which applications are pending?");
    expect(r.intent).toBe("SEARCH_APPLICATIONS");
    expect(r.status).toBe("pending");
  });

  it("parses SEARCH_APPLICATIONS last month", () => {
    const r = parseIntent("D, find the application I submitted last month");
    expect(r.intent).toBe("SEARCH_APPLICATIONS");
    expect(r.timeframe).toBe("last_month");
  });

  it("parses 'when did I apply for X'", () => {
    const r = parseIntent("D, when did I apply for the scholarship?");
    expect(r.intent).toBe("GET_APPLICATION_DETAILS");
    expect(r.query).toBe("the scholarship");
  });

  it("parses UPLOAD_DOCUMENT", () => {
    const r = parseIntent("D, upload a document");
    expect(r.intent).toBe("UPLOAD_DOCUMENT");
  });

  it("returns UNKNOWN with a helpful explanation for gibberish", () => {
    const r = parseIntent("flibbertigibbet banana");
    expect(r.intent).toBe("UNKNOWN");
    expect(r.explanation.length).toBeGreaterThan(10);
  });

  it("strips the wake phrase and trailing punctuation", () => {
    expect(stripWakePhrase("D, what is my full name?")).toBe("what is my full name");
    expect(stripWakePhrase("hey d fill this form")).toBe("fill this form");
  });

  it("resolves field phrases fuzzily", () => {
    expect(resolveFieldPhrase("full name")?.key).toBe("personal.full_name");
    expect(resolveFieldPhrase("permanent address")?.key).toBe("contact.permanent_address");
    expect(resolveFieldPhrase("employees")?.key).toBe("business.team_size");
  });
});

// ---------------------------------------------------------------------------
// Mapping engine — the mock grant form's exact labels
// ---------------------------------------------------------------------------

const ctx = {
  url: "https://bharat-innovate.example.test/grant",
  host: "bharat-innovate.example.test",
  title: "Bharat Innovate Startup Grant — Application Form",
  formCount: 1,
  labelsDigest: "Registered company name Company website Founder name Team size Annual recurring revenue",
};

describe("mapping engine (mock grant form)", () => {
  const F = (label: string, type = "text" as const, extra: Record<string, unknown> = {}) => ({
    formId: "active", id: label.toLowerCase().replace(/\s+/g, "-"), label, type,
    required: true, supported: true, ...extra,
  });

  it("maps 'Registered company name' → business.company_name with high confidence", () => {
    const r = mapFormField(F("Registered company name"), { profileType: "business", formContext: ctx });
    expect(r.mapping.fieldKey).toBe("business.company_name");
    expect(r.mapping.level).toBe("high");
  });

  it("maps 'Company website' → business.website", () => {
    const r = mapFormField(F("Company website", "text"), { profileType: "business", formContext: ctx });
    expect(r.mapping.fieldKey).toBe("business.website");
  });

  it("maps 'Founder LinkedIn profile' → business.founder_linkedin", () => {
    const r = mapFormField(F("Founder LinkedIn profile"), { profileType: "business", formContext: ctx });
    expect(r.mapping.fieldKey).toBe("business.founder_linkedin");
  });

  it("maps 'Team size (number of employees)' → business.team_size", () => {
    const r = mapFormField(F("Team size (number of employees)", "number"), { profileType: "business", formContext: ctx });
    expect(r.mapping.fieldKey).toBe("business.team_size");
  });

  it("maps 'Annual recurring revenue (₹)' → business.arr", () => {
    const r = mapFormField(F("Annual recurring revenue (₹)", "number"), { profileType: "business", formContext: ctx });
    expect(r.mapping.fieldKey).toBe("business.arr");
  });

  it("maps 'What problem are you solving?' → business.problem", () => {
    const r = mapFormField(F("What problem are you solving?", "textarea"), { profileType: "business", formContext: ctx });
    expect(r.mapping.fieldKey).toBe("business.problem");
  });

  it("maps 'Name of father' → family.father_name (personal profile)", () => {
    const r = mapFormField(F("Name of father"), { profileType: "personal" });
    expect(r.mapping.fieldKey).toBe("family.father_name");
  });

  it("maps 'Applicant full name' → personal.full_name", () => {
    const r = mapFormField(F("Applicant full name"), { profileType: "personal" });
    expect(r.mapping.fieldKey).toBe("personal.full_name");
    expect(r.mapping.level).toBe("high");
  });

  it("uses context for bare labels: 'Email' in a business form → company email; personal form → contact email", () => {
    const biz = mapFormField(F("Email"), { profileType: "business", formContext: ctx });
    expect(biz.mapping.fieldKey).toBe("business.company_email");
    const personal = mapFormField(F("Email"), { profileType: "personal" });
    expect(personal.mapping.fieldKey).toBe("contact.email");
  });

  it("flags low/none for an unrecognizable label", () => {
    const r = mapFormField(F("Zork midsummer frobnicate"), { profileType: "personal" });
    expect(["low", "none"]).toContain(r.mapping.level);
  });

  it("reports alternatives for the manual-selection UI", () => {
    const r = mapFormField(F("Contact number"), { profileType: "personal" });
    expect(r.mapping.fieldKey).toBe("contact.phone");
    expect(r.alternatives.some((a) => a.fieldKey.startsWith("contact."))).toBe(true);
  });

  it("never proposes checkbox fields", () => {
    const r = mapFormField(F("Accept terms", "checkbox", { supported: true }));
    expect(r.mapping.fieldKey).toBeNull();
  });
});

describe("mapping helpers", () => {
  it("matches select options case-insensitively and by prefix", () => {
    expect(matchSelectOption(["Private Limited", "LLP"], "private limited")).toBe("Private Limited");
    expect(matchSelectOption(["Pre-seed", "Seed", "Series A"], "seed round")).toBe("Seed");
    expect(matchSelectOption(["Male", "Female"], "other")).toBeNull();
  });

  it("normalizes label text: strips punctuation and parentheses", () => {
    expect(normalizeText("Annual recurring revenue (₹) — enter amount")).not.toContain("(");
    expect(normalizeText("Father's Name")).toBe("father s name");
  });
});
