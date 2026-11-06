"use client";

/**
 * Fictional demo data loader.
 *
 * Every value below is FAKE (generated for demonstration, clearly labelled in
 * the UI). The loader runs CLIENT-SIDE: each value is encrypted with the
 * session vault key exactly as if the user typed it — so demo data exercises
 * the full real pipeline (encryption, API, storage, decryption) rather than
 * faking anything.
 */

import { FIELD_MAP } from "@dvault/core";
import { encryptString } from "@dvault/core";
import type { CipherEnvelope } from "@dvault/core";

export interface DemoField { key: string; value: string }
export interface DemoProfileSpec {
  profileType: "personal" | "business";
  profileName: string;
  fields: DemoField[];
}

export const DEMO_PROFILES: DemoProfileSpec[] = [
  {
    profileType: "personal",
    profileName: "Aarav Mehta (Personal)",
    fields: [
      { key: "personal.full_name", value: "Aarav Mehta" },
      { key: "personal.first_name", value: "Aarav" },
      { key: "personal.last_name", value: "Mehta" },
      { key: "personal.dob", value: "1998-04-12" },
      { key: "personal.gender", value: "Male" },
      { key: "personal.nationality", value: "Indian" },
      { key: "family.father_name", value: "Rahul Sharma" },
      { key: "family.mother_name", value: "Kavita Sharma" },
      { key: "family.emergency_contact", value: "Rahul Sharma · +91 90000 00000" },
      { key: "identity.aadhaar", value: "9876 5432 1098" },
      { key: "identity.pan", value: "ABCDE1234F" },
      { key: "contact.email", value: "aarav@example.test" },
      { key: "contact.phone", value: "+91 90000 00000" },
      { key: "contact.current_address", value: "Flat 402, Sunblossom Residency, Koregaon Park, Pune, Maharashtra 411001, India" },
      { key: "contact.permanent_address", value: "27 Nehru Colony, Civil Lines, Nagpur, Maharashtra 440001, India" },
      { key: "contact.city", value: "Pune" },
      { key: "contact.state", value: "Maharashtra" },
      { key: "contact.postal_code", value: "411001" },
      { key: "contact.country", value: "India" },
      { key: "education.university", value: "College of Engineering, Pune (fictional)" },
      { key: "education.degree", value: "B.Tech Computer Science" },
      { key: "education.graduation_year", value: "2020" },
      { key: "education.cgpa", value: "8.6" },
      { key: "employment.current_employer", value: "NovaStack Technologies" },
      { key: "employment.designation", value: "Founder & CEO" },
      { key: "employment.work_experience", value: "6 years" },
      { key: "employment.profile_url", value: "https://www.linkedin.com/in/aarav-mehta-example" },
    ],
  },
  {
    profileType: "business",
    profileName: "NovaStack Technologies (Business)",
    fields: [
      { key: "business.company_name", value: "NovaStack Technologies Pvt Ltd (fictional)" },
      { key: "business.brand_name", value: "NovaStack" },
      { key: "business.website", value: "https://example.test" },
      { key: "business.company_email", value: "hello@novastack.example.test" },
      { key: "business.company_phone", value: "+91 90000 00001" },
      { key: "business.company_address", value: "Level 3, Creaticity Tower, Pune, Maharashtra 411014, India" },
      { key: "business.registered_office", value: "Level 3, Creaticity Tower, Pune, Maharashtra 411014, India" },
      { key: "business.incorporation_date", value: "2024-08-19" },
      { key: "business.country", value: "India" },
      { key: "business.state", value: "Maharashtra" },
      { key: "business.company_type", value: "Private Limited" },
      { key: "business.registration_number", value: "U72999PN2024PTC123456 (fictional)" },
      { key: "business.gstin", value: "27ABCDE1234F1Z5" },
      { key: "business.industry", value: "SaaS / Business automation" },
      { key: "business.business_stage", value: "Early-stage" },
      { key: "business.founder_name", value: "Aarav Mehta" },
      { key: "business.cofounder_names", value: "Ishaan Rao · Sneha Kulkarni (both fictional)" },
      { key: "business.founder_email", value: "aarav@novastack.example.test" },
      { key: "business.founder_phone", value: "+91 90000 00000" },
      { key: "business.founder_linkedin", value: "https://www.linkedin.com/in/aarav-mehta-example" },
      { key: "business.founder_bio", value: "Aarav started NovaStack in 2024 after automating workflows for mid-size manufacturers. Computer-science engineer from Pune. (Fictional biography.)" },
      { key: "business.founder_education", value: "B.Tech Computer Science, COEP Pune (fictional)" },
      { key: "business.product_name", value: "NovaStack Flow" },
      { key: "business.product_description", value: "AI-powered business workflow automation for small and mid-size teams — from intake to invoicing." },
      { key: "business.problem", value: "Small teams lose hours every week stitching spreadsheets, chats and legacy tools into working processes." },
      { key: "business.solution", value: "Flow turns plain-language process descriptions into automations that connect the tools teams already use." },
      { key: "business.target_market", value: "Indian SMEs in manufacturing and professional services" },
      { key: "business.business_model", value: "B2B SaaS subscription with per-workflow pricing" },
      { key: "business.revenue_model", value: "Monthly subscription + usage-based workflow credits" },
      { key: "business.traction", value: "14 paying pilot customers, ₹1.8 lakh MRR, 3.1x trial-to-paid conversion. (Fictional metrics.)" },
      { key: "business.customer_count", value: "14" },
      { key: "business.mrr", value: "180000" },
      { key: "business.arr", value: "2160000" },
      { key: "business.funding_stage", value: "Pre-seed" },
      { key: "business.previous_funding", value: "Friends & family round of ₹40 lakh (fictional)" },
      { key: "business.team_size", value: "5" },
      { key: "business.incubator", value: "Pune Tech Incubator (fictional)" },
      { key: "business.startup_recognition", value: "DPIIT-recognized startup (fictional number DPP24/9876)" },
      { key: "business.funding_requirements", value: "Seeking ₹1.2 crore pre-seed to expand the engineering team (fictional)." },
    ],
  },
];

export interface DemoApplicationSpec {
  applicationName: string;
  websiteDomain: string;
  applicationUrl: string;
  referenceId: string;
  notes?: string;
  submissionDate: string;
  status: "submitted" | "pending" | "unknown";
}

export const DEMO_APPLICATIONS: DemoApplicationSpec[] = [
  {
    applicationName: "AWS for Startups application",
    websiteDomain: "aws.amazon.com",
    applicationUrl: "https://aws.amazon.com/startups/",
    referenceId: "AWS-SUP-2026-88421 (fictional)",
    notes: "Applied for AWS Activate Credits. Submitted pitch deck and traction snapshot.",
    submissionDate: new Date(Date.now() - 45 * 864e5).toISOString(),
    status: "submitted",
  },
  {
    applicationName: "Bharat Innovate Startup Grant",
    websiteDomain: "bharat-innovate.example.test",
    applicationUrl: "https://bharat-innovate.example.test/grant-2026",
    referenceId: "BIG-2026-88421 (fictional)",
    notes: "Startup grant programme — ₹25 lakh grant for SaaS workflow automation.",
    submissionDate: new Date(Date.now() - 12 * 864e5).toISOString(),
    status: "pending",
  },
  {
    applicationName: "University admission — MTech (fictional)",
    websiteDomain: "admissions.example.test",
    applicationUrl: "https://admissions.example.test/mtech-cs-2026",
    referenceId: "ADM-2026-30012 (fictional)",
    notes: "MTech Computer Science application with CGPA certificates attached.",
    submissionDate: new Date(Date.now() - 90 * 864e5).toISOString(),
    status: "submitted",
  },
];

/** Load all demo data through the real (encrypted) API pipeline. */
export async function loadDemoData(
  encrypt: (s: string) => Promise<CipherEnvelope>,
): Promise<{ createdProfiles: number; createdFields: number; createdApplications: number }> {
  let createdFields = 0;
  let createdProfiles = 0;

  const profileIds: Record<string, string> = {};
  for (const spec of DEMO_PROFILES) {
    const res = await fetch("/api/profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ profileType: spec.profileType, profileName: spec.profileName }),
    });
    const data = (await res.json()) as { profile?: { id: string } };
    if (!res.ok || !data.profile) continue;
    profileIds[spec.profileType] = data.profile.id;
    createdProfiles++;

    for (const f of spec.fields) {
      if (!FIELD_MAP[f.key]) continue;
      const env = await encrypt(f.value);
      const fres = await fetch(`/api/profiles/${data.profile.id}/fields`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ fieldKey: f.key, encryptedValue: env, verified: false }),
      });
      if (fres.ok) createdFields++;
    }
  }

  let createdApplications = 0;
  for (const app of DEMO_APPLICATIONS) {
    const referenceEnv = await encrypt(app.referenceId);
    const notesEnv = app.notes ? await encrypt(app.notes) : null;
    const res = await fetch("/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        applicationName: app.applicationName,
        websiteDomain: app.websiteDomain,
        applicationUrl: app.applicationUrl,
        profileId: profileIds["business"] ?? null,
        encryptedReferenceId: referenceEnv,
        encryptedNotes: notesEnv,
        submissionDate: app.submissionDate,
        status: app.status,
        isDemo: true,
      }),
    });
    if (res.ok) createdApplications++;
  }

  return { createdProfiles, createdFields, createdApplications };
}

export async function encryptDemoText(encrypt: (s: string) => Promise<CipherEnvelope>) {
  const text = [
    "FICTIONAL DEMO DOCUMENT — NovaStack Technologies Pvt Ltd",
    "Incorporated 19 August 2024 · CIN U72999PN2024PTC123456 (fictional)",
    "Registered office: Level 3, Creaticity Tower, Pune, Maharashtra 411014, India",
    "GSTIN: 27ABCDE1234F1Z5 · Team: 5 · MRR: Rs. 1,80,000",
    "All identifiers on this document are synthetic and created for the D-Vault demo.",
  ].join("\n");
  const fields = [
    { fieldKey: "business.company_name", value: "NovaStack Technologies Pvt Ltd (fictional)", confidence: 0.98, evidence: "Line 1" },
    { fieldKey: "business.incorporation_date", value: "2024-08-19", confidence: 0.94, evidence: "Line 2" },
    { fieldKey: "business.registration_number", value: "U72999PN2024PTC123456", confidence: 0.95, evidence: "Line 2" },
    { fieldKey: "business.gstin", value: "27ABCDE1234F1Z5", confidence: 0.96, evidence: "Line 4" },
    { fieldKey: "business.team_size", value: "5", confidence: 0.9, evidence: "Line 4" },
  ];
  return {
    encryptedText: await encrypt(text),
    encryptedFields: await encrypt(JSON.stringify(fields)),
  };
}
