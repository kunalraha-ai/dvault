/**
 * D-Vault vault field catalog.
 *
 * Every piece of information D can remember about a personal or business
 * profile is described here: a stable field key, a human label, the category
 * it belongs to, whether it is sensitive (masked by default) and the HTML
 * input type that best represents it. The same catalog drives:
 *  - the Personal/Business Vault UI,
 *  - the semantic form-field mapping engine,
 *  - the intent engine (voice -> field key),
 *  - demo data seeding.
 */

export type ProfileType = "personal" | "business";
export type FieldInputType =
  | "text"
  | "email"
  | "tel"
  | "date"
  | "number"
  | "textarea"
  | "url"
  | "select";

export interface FieldDef {
  key: string;
  label: string;
  category: VaultCategory;
  profileType: ProfileType;
  sensitive?: boolean;
  inputType: FieldInputType;
  placeholder?: string;
  help?: string;
}

export type VaultCategory =
  | "personal"
  | "family"
  | "identity"
  | "contact"
  | "education"
  | "employment"
  | "business-company"
  | "business-founder"
  | "business-startup"
  | "business-grants"
  | "references";

export const CATEGORIES: Record<
  VaultCategory,
  { label: string; description: string; profileType: ProfileType; order: number }
> = {
  personal: {
    label: "Personal information",
    description: "Legal name, date of birth, nationality and core identity details.",
    profileType: "personal",
    order: 1,
  },
  family: {
    label: "Family information",
    description: "Parents, guardian and emergency contacts.",
    profileType: "personal",
    order: 2,
  },
  identity: {
    label: "Identity documents",
    description: "Government identifiers. Masked by default, encrypted at rest.",
    profileType: "personal",
    order: 3,
  },
  contact: {
    label: "Contact information",
    description: "Email addresses, phone numbers and addresses.",
    profileType: "personal",
    order: 4,
  },
  education: {
    label: "Education",
    description: "Schools, universities, degrees and results.",
    profileType: "personal",
    order: 5,
  },
  employment: {
    label: "Employment",
    description: "Employers, designations, experience and professional profiles.",
    profileType: "personal",
    order: 6,
  },
  "business-company": {
    label: "Company information",
    description: "Legal entity, registration and official company details.",
    profileType: "business",
    order: 1,
  },
  "business-founder": {
    label: "Founder information",
    description: "Founders, co-founders and their public profiles.",
    profileType: "business",
    order: 2,
  },
  "business-startup": {
    label: "Startup information",
    description: "Product, traction, metrics and funding stage.",
    profileType: "business",
    order: 3,
  },
  "references": {
    label: "References & IDs",
    description: "Reference numbers, virtual IDs, confirmation numbers — everything you receive after filling forms.",
    profileType: "personal",
    order: 7,
  },
  "business-grants": {
    label: "Grants and accelerators",
    description: "Grant history, programmes, incubators and funding requirements.",
    profileType: "business",
    order: 4,
  },
};

/** Category order for the vault UI. */
export const CATEGORY_ORDER: Record<VaultCategory, number> = Object.fromEntries(
  (Object.keys(CATEGORIES) as VaultCategory[]).map((k) => [k, CATEGORIES[k].order]),
) as Record<VaultCategory, number>;

const f = (
  key: string,
  label: string,
  category: VaultCategory,
  inputType: FieldInputType,
  extra: Partial<FieldDef> = {},
): FieldDef => ({
  key,
  label,
  category,
  profileType: CATEGORIES[category].profileType,
  inputType,
  ...extra,
});

export const FIELDS: FieldDef[] = [
  // ---------------------------------------------------------------- personal
  f("personal.full_name", "Full legal name", "personal", "text", {
    placeholder: "As printed on your official documents",
  }),
  f("personal.first_name", "First name", "personal", "text"),
  f("personal.middle_name", "Middle name", "personal", "text"),
  f("personal.last_name", "Last name", "personal", "text"),
  f("personal.dob", "Date of birth", "personal", "date"),
  f("personal.gender", "Gender", "personal", "select"),
  f("personal.nationality", "Nationality", "personal", "text"),
  f("personal.marital_status", "Marital status", "personal", "select"),

  // ------------------------------------------------------------------ family
  f("family.father_name", "Father's name", "family", "text"),
  f("family.mother_name", "Mother's name", "family", "text"),
  f("family.guardian_name", "Guardian's name", "family", "text"),
  f("family.emergency_contact", "Emergency contact", "family", "text", {
    help: "Name and number of someone we can reach out to.",
  }),

  // ---------------------------------------------------------------- identity
  f("identity.aadhaar", "Aadhaar number", "identity", "text", {
    sensitive: true,
    help: "12-digit UIDAI number. Masked by default.",
  }),
  f("identity.pan", "PAN number", "identity", "text", {
    sensitive: true,
    help: "10-character permanent account number.",
  }),
  f("identity.passport", "Passport number", "identity", "text", { sensitive: true }),
  f("identity.driving_licence", "Driving licence number", "identity", "text", {
    sensitive: true,
  }),
  f("identity.voter_id", "Voter ID (EPIC)", "identity", "text", { sensitive: true }),

  // ----------------------------------------------------------------- contact
  f("contact.email", "Primary email", "contact", "email"),
  f("contact.alternate_email", "Alternate email", "contact", "email"),
  f("contact.phone", "Phone number", "contact", "tel"),
  f("contact.alternate_phone", "Alternate phone", "contact", "tel"),
  f("contact.current_address", "Current address", "contact", "textarea", {
    help: "Where you live right now.",
  }),
  f("contact.permanent_address", "Permanent address", "contact", "textarea"),
  f("contact.city", "City", "contact", "text"),
  f("contact.state", "State / province", "contact", "text"),
  f("contact.postal_code", "Postal code", "contact", "text"),
  f("contact.country", "Country", "contact", "text"),

  // --------------------------------------------------------------- education
  f("education.school", "School", "education", "text"),
  f("education.university", "University", "education", "text"),
  f("education.degree", "Degree", "education", "text"),
  f("education.course", "Course / major", "education", "text"),
  f("education.graduation_year", "Graduation year", "education", "text"),
  f("education.marks", "Marks / percentage", "education", "text"),
  f("education.cgpa", "CGPA", "education", "text"),
  f("education.certificates", "Certificates", "education", "textarea", {
    help: "One per line.",
  }),

  // -------------------------------------------------------------- employment
  f("employment.current_employer", "Current employer", "employment", "text"),
  f("employment.designation", "Designation", "employment", "text"),
  f("employment.previous_employers", "Previous employers", "employment", "textarea", {
    help: "Most recent first, one per line.",
  }),
  f("employment.work_experience", "Total work experience", "employment", "text", {
    help: "e.g. 4 years 6 months",
  }),
  f("employment.profile_url", "Professional profile URL", "employment", "url", {
    help: "LinkedIn or personal site.",
  }),
  f("employment.resume", "Résumé summary", "employment", "textarea", {
    help: "A short summary you can paste into applications.",
  }),

  // ---------------------------------------------------------- business: company
  f("business.company_name", "Company legal name", "business-company", "text", {
    help: "Registered name including suffix (Pvt Ltd, LLP…).",
  }),
  f("business.brand_name", "Brand name", "business-company", "text"),
  f("business.website", "Company website", "business-company", "url"),
  f("business.company_email", "Company email", "business-company", "email"),
  f("business.company_phone", "Company phone", "business-company", "tel"),
  f("business.company_address", "Company address", "business-company", "textarea"),
  f("business.registered_office", "Registered office address", "business-company", "textarea"),
  f("business.incorporation_date", "Incorporation date", "business-company", "date"),
  f("business.country", "Country of incorporation", "business-company", "text"),
  f("business.state", "State of incorporation", "business-company", "text"),
  f("business.company_type", "Company type", "business-company", "select", {
    help: "Pvt Ltd, LLP, Partnership, Sole proprietorship…",
  }),
  f("business.registration_number", "Registration number (CIN/LLPIN)", "business-company", "text"),
  f("business.gstin", "GSTIN", "business-company", "text", { sensitive: true }),
  f("business.industry", "Industry", "business-company", "text"),
  f("business.business_stage", "Business stage", "business-company", "select"),

  // --------------------------------------------------------- business: founder
  f("business.founder_name", "Founder name", "business-founder", "text"),
  f("business.cofounder_names", "Co-founder names", "business-founder", "textarea", {
    help: "One per line.",
  }),
  f("business.founder_email", "Founder email", "business-founder", "email"),
  f("business.founder_phone", "Founder phone", "business-founder", "tel"),
  f("business.founder_linkedin", "Founder LinkedIn profile", "business-founder", "url"),
  f("business.founder_bio", "Founder biography", "business-founder", "textarea"),
  f("business.founder_education", "Founder education", "business-founder", "text"),

  // --------------------------------------------------------- business: startup
  f("business.product_name", "Product name", "business-startup", "text"),
  f("business.product_description", "Product description", "business-startup", "textarea"),
  f("business.problem", "Problem being solved", "business-startup", "textarea"),
  f("business.solution", "Solution", "business-startup", "textarea"),
  f("business.target_market", "Target market", "business-startup", "text"),
  f("business.business_model", "Business model", "business-startup", "textarea"),
  f("business.revenue_model", "Revenue model", "business-startup", "textarea"),
  f("business.traction", "Current traction", "business-startup", "textarea"),
  f("business.customer_count", "Number of customers", "business-startup", "number"),
  f("business.mrr", "Monthly recurring revenue", "business-startup", "number"),
  f("business.arr", "Annual recurring revenue", "business-startup", "number"),
  f("business.funding_stage", "Funding stage", "business-startup", "select", {
    help: "Idea, Pre-seed, Seed, Series A…",
  }),
  f("business.previous_funding", "Previous funding", "business-startup", "textarea"),
  f("business.team_size", "Team size", "business-startup", "number"),
  f("business.pitch_deck", "Pitch deck URL", "business-startup", "url"),

  // ── Business: grants + references (IDs from forms) ─────────────────────
  f("reference.service_name", "Service / Website name", "references", "text", {
    help: "Which website or service gave you this reference.",
  }),
  f("reference.number", "Reference / Confirmation number", "references", "text", {
    help: "The ID you received after filling a form.",
  }),
  f("reference.virtual_id", "Virtual ID", "references", "text", {
    help: "Virtual Aadhaar ID, virtual account, etc.",
  }),
  f("reference.tracking_id", "Tracking ID", "references", "text"),
  f("reference.acknowledgement_id", "Acknowledgement ID", "references", "text"),
  f("reference.application_id", "Application ID", "references", "text"),
  f("reference.otp_reference", "OTP reference (for support)", "references", "text", {
    help: "The reference ID shown with OTP prompts — never the OTP itself.",
  }),
  f("reference.status", "Status", "references", "text", {
    help: "Pending, approved, rejected, completed…",
  }),
  f("reference.notes", "Notes about this reference", "references", "textarea"),
  f("business.grant_applications", "Previous grant applications", "business-grants", "textarea", {
    help: "Programme name, year and outcome — one per line.",
  }),
  f("business.program_participation", "Startup programme participation", "business-grants", "textarea"),
  f("business.incubator", "Incubator", "business-grants", "text"),
  f("business.accelerator", "Accelerator", "business-grants", "text"),
  f("business.startup_recognition", "Startup recognition details", "business-grants", "text", {
    help: "e.g. DPIIT recognition number.",
  }),
  f("business.funding_requirements", "Funding requirements", "business-grants", "textarea"),
  f("business.credentials", "Other business credentials", "business-grants", "textarea"),
];

export const FIELD_MAP: Record<string, FieldDef> = Object.fromEntries(
  FIELDS.map((fd) => [fd.key, fd]),
);

export function getField(key: string): FieldDef | undefined {
  return FIELD_MAP[key];
}

export function fieldsForCategory(category: VaultCategory): FieldDef[] {
  return FIELDS.filter((fd) => fd.category === category);
}

export function fieldsForProfile(profileType: ProfileType): FieldDef[] {
  return FIELDS.filter((fd) => fd.profileType === profileType);
}

export function isSensitiveKey(key: string): boolean {
  return Boolean(FIELD_MAP[key]?.sensitive);
}

export const DOCUMENT_CATEGORIES = [
  "identity",
  "address",
  "education",
  "employment",
  "business",
  "financial",
  "legal",
  "other",
] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export const APPLICATION_STATUSES = [
  "draft",
  "submitted",
  "pending",
  "approved",
  "rejected",
  "unknown",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];
