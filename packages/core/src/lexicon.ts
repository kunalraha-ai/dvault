/**
 * Lexicon: phrases that websites use to label form fields, mapped to
 * D-Vault vault field keys. The mapping engine normalizes both the website
 * label and these phrases before fuzzy matching, so minor wording
 * differences ("Name of father" vs "Father's name") still match.
 *
 * IMPORTANT: website text is UNTRUSTED input. The lexicon only ever matches
 * label text to field keys — it never executes anything from the page and
 * never alters D-Vault security rules (see docs/SECURITY.md, threat model).
 */

export const FIELD_SYNONYMS: Record<string, string[]> = {
  // personal
  "personal.full_name": [
    "full name", "full legal name", "applicant full name", "applicant name",
    "your name", "complete name", "name of applicant", "candidate name",
    "name of the applicant", "full name of applicant", "your full name",
    "participant name", "student name", "employee name", "name as per documents",
  ],
  "personal.first_name": [
    "first name", "given name", "forename", "given names",
  ],
  "personal.middle_name": ["middle name", "second name"],
  "personal.last_name": [
    "last name", "surname", "family name", "last name as per document",
  ],
  "personal.dob": [
    "date of birth", "birth date", "dob", "birthday", "d.o.b.",
    "applicant date of birth",
  ],
  "personal.gender": ["gender", "sex"],
  "personal.nationality": ["nationality", "citizenship", "citizen of"],
  "personal.marital_status": ["marital status", "marriage status"],

  // family
  "family.father_name": [
    "father's name", "fathers name", "father name", "name of father",
    "name of the father", "father full name", "father's full name",
  ],
  "family.mother_name": [
    "mother's name", "mothers name", "mother name", "name of mother",
    "name of the mother", "mother full name", "mother's full name",
  ],
  "family.guardian_name": [
    "guardian name", "name of guardian", "guardian's name", "parent guardian name",
  ],
  "family.emergency_contact": [
    "emergency contact", "emergency contact number", "emergency contact person",
    "contact in case of emergency",
  ],

  // identity
  "identity.aadhaar": [
    "aadhaar", "aadhaar number", "aadhar", "aadhar number", "aadhaar no",
    "uidai number", "unique id", "uid number",
  ],
  "identity.pan": [
    "pan", "pan number", "pan no", "permanent account number", "pan card number",
  ],
  "identity.passport": ["passport", "passport number", "passport no"],
  "identity.driving_licence": [
    "driving licence", "driving license", "dl number", "driver licence number",
    "driving licence no",
  ],
  "identity.voter_id": ["voter id", "voter id number", "epic number", "epic no"],

  // contact
  "contact.email": [
    "email", "email address", "e-mail", "primary email", "contact email",
    "your email", "applicant email", "correspondence email", "email id",
  ],
  "contact.alternate_email": [
    "alternate email", "alternative email", "secondary email", "other email",
  ],
  "contact.phone": [
    "phone", "phone number", "mobile", "mobile number", "contact number",
    "contact phone", "telephone", "your phone", "applicant phone",
    "applicant mobile number", "whatsapp number", "cell phone", "primary phone",
  ],
  "contact.alternate_phone": [
    "alternate phone", "alternate mobile", "alternate contact number",
    "secondary phone", "other phone", "alternate mobile number",
  ],
  "contact.current_address": [
    "current address", "residential address", "present address",
    "address where you live", "correspondence address", "communication address",
    "your address", "applicant address", "mailing address", "where do you live",
    "where do you reside", "where do i live", "where do i reside", "residence",
    "where are you based", "where are you staying", "home address", "where you stay",
  ],
  "contact.permanent_address": [
    "permanent address", "home address", "permanent residential address",
    "address as per documents", "native address",
  ],
  "contact.city": ["city", "town", "city of residence", "current city", "district city",
    "which city", "what city", "where do you live", "where do i live",
    "which city do you live", "which city do i live", "which city do you reside",
    "which city do i reside", "residing in which city", "based in which city",
    "residence city", "home city", "home town", "hometown", "which town",
  ],
  "contact.state": ["state", "province", "state of residence", "union territory"],
  "contact.postal_code": [
    "postal code", "pin code", "pincode", "pin", "zip code", "zip", "zipcode",
  ],
  "contact.country": ["country", "country of residence", "nationality country"],

  // education
  "education.school": ["school", "school name", "name of school", "high school"],
  "education.university": [
    "university", "university name", "name of university", "college",
    "college name", "name of the university", "institution", "institute name",
    "institute",
  ],
  "education.degree": [
    "degree", "degree name", "highest degree", "qualification",
    "educational qualification", "highest qualification",
  ],
  "education.course": [
    "course", "course name", "major", "branch", "stream", "field of study",
    "specialization", "specialisation",
  ],
  "education.graduation_year": [
    "graduation year", "year of graduation", "year of passing", "passing year",
    "pass out year", "graduation date year",
  ],
  "education.marks": ["marks", "percentage", "marks percentage", "aggregate marks"],
  "education.cgpa": ["cgpa", "gpa", "grade point average", "cgpa score"],
  "education.certificates": [
    "certificates", "certificate details", "professional certifications",
    "certifications",
  ],

  // employment
  "employment.current_employer": [
    "current employer", "employer", "employer name", "company you work for",
    "current company", "present employer", "organization you work for",
  ],
  "employment.designation": [
    "designation", "job title", "title", "role", "current role",
    "position", "position held", "current designation",
  ],
  "employment.previous_employers": [
    "previous employers", "past employers", "previous work experience",
    "employment history", "work history",
  ],
  "employment.work_experience": [
    "work experience", "years of experience", "total experience",
    "experience", "professional experience",
  ],
  "employment.profile_url": [
    "linkedin", "linkedin profile", "linkedin url", "professional profile url",
    "personal website", "portfolio", "professional profile",
  ],
  "employment.resume": [
    "resume", "resume summary", "cv summary", "about yourself", "summary",
    "brief about yourself", "professional summary",
  ],

  // business: company
  "business.company_name": [
    "company name", "registered company name", "name of company",
    "name of the company", "company legal name", "legal name of company",
    "business name", "firm name", "organization name", "organisation name",
    "entity name", "startup name", "name of startup", "name of the startup",
    "company registration name", "registered entity name",
  ],
  "business.brand_name": ["brand name", "product brand", "trade name", "dba name"],
  "business.website": [
    "company website", "website", "company url", "website url", "web url",
    "company website url", "startup website", "your website",
  ],
  "business.company_email": [
    "company email", "company email address", "business email",
    "official email", "work email", "contact email of company",
  ],
  "business.company_phone": [
    "company phone", "company phone number", "business phone",
    "office phone", "contact phone of company", "company contact number",
  ],
  "business.company_address": [
    "company address", "office address", "business address",
    "company location", "address of company",
  ],
  "business.registered_office": [
    "registered office", "registered office address", "registered address",
    "principal place of business",
  ],
  "business.incorporation_date": [
    "incorporation date", "date of incorporation", "incorporation",
    "company incorporation date", "date of registration",
    "registration date of company", "incorporated on",
  ],
  "business.country": ["country of incorporation", "country of company", "operating country"],
  "business.state": ["state of incorporation", "state of company"],
  "business.company_type": [
    "company type", "type of company", "entity type", "legal structure",
    "business type", "type of entity", "type of business",
  ],
  "business.registration_number": [
    "registration number", "cin", "llpin", "company registration number",
    "corporate identification number", "entity registration number",
    "company cin", "cin number", "registration no",
  ],
  "business.gstin": ["gstin", "gst number", "gst identification number", "gst no"],
  "business.industry": ["industry", "sector", "industry sector", "business sector", "vertical"],
  "business.business_stage": [
    "business stage", "stage of company", "company stage", "startup stage",
    "stage of your company", "current stage",
  ],

  // business: founder
  "business.founder_name": [
    "founder name", "name of founder", "founder", "ceo name",
    "name of the founder", "founder full name", "applicant founder name",
    "primary founder", "contact person name",
  ],
  "business.cofounder_names": [
    "co-founder names", "cofounder names", "co founders", "cofounders",
    "other founders", "names of co-founders",
  ],
  "business.founder_email": ["founder email", "founder email address", "email of founder"],
  "business.founder_phone": ["founder phone", "founder phone number", "founder mobile"],
  "business.founder_linkedin": [
    "founder linkedin", "founder linkedin profile", "linkedin profile of founder",
    "founder profile url", "founder linkedin url",
  ],
  "business.founder_bio": [
    "founder bio", "founder biography", "about the founder", "about founder",
    "founder background", "tell us about the founder", "about yourself founder",
  ],
  "business.founder_education": [
    "founder education", "educational background of founder", "founder qualification",
  ],

  // business: startup
  "business.product_name": [
    "product name", "name of product", "name of the product", "product",
    "solution name", "offering name",
  ],
  "business.product_description": [
    "product description", "describe your product", "describe the product",
    "product summary", "what does your product do", "what does your company do",
    "about the product", "product overview", "describe your offering",
    "tell us about your product", "what does your startup do",
  ],
  "business.problem": [
    "problem being solved", "problem", "problem statement", "describe the problem",
    "what problem are you solving", "problem you are solving",
    "pain point", "what problem does your startup solve",
  ],
  "business.solution": [
    "solution", "your solution", "describe your solution", "how do you solve it",
    "proposed solution", "how does your product solve the problem",
  ],
  "business.target_market": [
    "target market", "target audience", "market segment", "who are your customers",
    "target customers", "target segment", "icp",
  ],
  "business.business_model": [
    "business model", "describe your business model", "how do you make money",
    "business model description", "go to market strategy", "gtm strategy",
  ],
  "business.revenue_model": ["revenue model", "how do you generate revenue", "revenue streams"],
  "business.traction": [
    "traction", "current traction", "describe your traction", "progress",
    "key milestones", "milestones", "current progress", "growth so far",
  ],
  "business.customer_count": [
    "number of customers", "customers", "customer count", "how many customers",
    "number of users", "user count", "active users", "number of active users",
  ],
  "business.mrr": [
    "monthly recurring revenue", "mrr", "monthly revenue", "current mrr",
  ],
  "business.arr": [
    "annual recurring revenue", "arr", "annual revenue", "current arr",
    "yearly recurring revenue",
  ],
  "business.funding_stage": [
    "funding stage", "stage of funding", "current funding stage", "fundraising stage",
  ],
  "business.previous_funding": [
    "previous funding", "funding raised till date", "funding history",
    "previous funding raised", "total funding raised",
  ],
  "business.team_size": [
    "team size", "number of employees", "employees", "how many employees",
    "number of team members", "team members", "headcount", "company size",
    "size of your team", "number of people in your company",
    "how many people work at your company", "employee count",
  ],
  "business.pitch_deck": [
    "pitch deck", "pitch deck url", "deck link", "link to your pitch deck",
    "pitch deck link", "startup deck",
  ],

  "reference.service_name": ["service name", "website name", "which website", "from which site"],
  "reference.number": ["reference number", "confirmation number", "reference id", "confirmation id", "ref number", "ref id"],
  "reference.virtual_id": ["virtual id", "vid", "virtual aadhaar"],
  "reference.tracking_id": ["tracking id", "tracking number", "shipment tracking"],
  "reference.acknowledgement_id": ["acknowledgement id", "acknowledgment id", "ack number"],
  "reference.application_id": ["application id", "app id", "form id"],
  "reference.otp_reference": ["otp reference", "otp id"],
  "reference.status": ["reference status", "form status"],
  "reference.notes": ["reference notes", "form notes"],
  "business.grant_applications": [
    "previous grant applications", "grant applications", "previous grants",
    "grants applied for", "previous funding programs",
  ],
  "business.program_participation": [
    "program participation", "startup programme participation",
    "programs participated", "previous accelerator programs",
    "programme participation",
  ],
  "business.incubator": ["incubator", "incubator name", "current incubator"],
  "business.accelerator": ["accelerator", "accelerator name", "current accelerator"],
  "business.startup_recognition": [
    "startup recognition", "dpiit recognition", "dpiit number",
    "startup india recognition", "recognition number",
  ],
  "business.funding_requirements": [
    "funding requirements", "funding requirement", "how much funding do you need",
    "fund requirement", "amount of funding sought", "funding ask",
  ],
  "business.credentials": [
    "other credentials", "business credentials", "additional credentials",
    "awards and recognition", "other relevant details",
  ],
};

/** Tokens that signal a page is about a company/business (used as a soft boost). */
export const BUSINESS_CONTEXT_TOKENS = [
  "company", "startup", "business", "founder", "incubator", "accelerator",
  "grant", "enterprise", "incorporation", "gst", "pitch", "b2b", "saas",
  "venture", "co-founder", "cofounder", "dpo", "cfo",
];

/** Tokens that signal a page is about an individual. */
export const PERSONAL_CONTEXT_TOKENS = [
  "applicant", "your name", "father", "mother", "date of birth", "aadhaar",
  "pan", "residential", "guardian", "marital", "nationality",
];
