"use client";

/**
 * On-device OCR + candidate field extraction.
 *
 * Text extraction happens IN THE BROWSER (tesseract.js WASM for images,
 * pdf.js text layer for digital PDFs). The extracted text and candidate
 * fields are encrypted with the session key before being sent to the server,
 * and NOTHING is saved until the user reviews the extraction.
 */

export interface ExtractedCandidate {
  fieldKey: string;
  value: string;
  confidence: number;
  evidence: string;
}

export interface ExtractionResult {
  ok: boolean;
  text: string;
  candidates: ExtractedCandidate[];
  method: "tesseract-ocr" | "pdf-text-layer" | "none";
  note?: string;
}

/** Run OCR on an image using tesseract.js (downloads the model on first use). */
async function ocrImage(file: File | Blob): Promise<{ ok: boolean; text: string; note?: string }> {
  try {
    const tesseract = await import("tesseract.js");
    const createWorker = (tesseract as unknown as { createWorker: typeof import("tesseract.js").createWorker }).createWorker;
    const worker = await createWorker("eng", 1, { logger: () => undefined });
    const result = await worker.recognize(file);
    await worker.terminate();
    return { ok: true, text: result.data.text ?? "" };
  } catch (e) {
    return {
      ok: false,
      text: "",
      note: e instanceof Error
        ? `On-device OCR failed: ${e.message}. You can still store the document and add details manually.`
        : "On-device OCR failed. You can still store the document.",
    };
  }
}

/** Extract the text layer of a digital PDF with pdf.js (no OCR for scans). */
async function pdfText(file: File | Blob): Promise<{ ok: boolean; text: string; note?: string }> {
  try {
    const pdfjs = await import("pdfjs-dist");
    const data = new Uint8Array(await file.arrayBuffer());
    const doc = await pdfjs.getDocument({ data }).promise;
    const pages: string[] = [];
    for (let i = 1; i <= Math.min(doc.numPages, 12); i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      pages.push(
        content.items
          .map((item) => ("str" in item ? (item as { str: string }).str : ""))
          .join(" "),
      );
    }
    const text = pages.join("\n").trim();
    return {
      ok: true,
      text,
      note: text
        ? undefined
        : "No text layer found — this PDF is likely a scan. On-device PDF OCR is not yet supported; add details manually.",
    };
  } catch {
    return {
      ok: false,
      text: "",
      note: "Could not parse this PDF in your browser. You can still store it encrypted and add details manually.",
    };
  }
}

/** Parse well-known Indian identifiers and basics from raw text. */
export function extractCandidateFields(text: string): ExtractedCandidate[] {
  const out: ExtractedCandidate[] = [];
  const push = (fieldKey: string, value: string, confidence: number, evidence: string) => {
    if (!out.some((c) => c.fieldKey === fieldKey)) {
      out.push({ fieldKey, value, confidence, evidence });
    }
  };

  const flat = text.replace(/\s+/g, " ");

  // Aadhaar: 12 digits, often grouped 4-4-4
  const aadhaar = flat.match(/\b(\d{4}\s?\d{4}\s?\d{4})\b/g);
  if (aadhaar) {
    const clean = aadhaar[0].replace(/\s/g, "");
    if (clean.length === 12) push("identity.aadhaar", aadhaar[0], 0.85, "12-digit pattern");
  }

  // PAN: 5 letters + 4 digits + 1 letter
  const pan = flat.match(/\b([A-Z]{5}\d{4}[A-Z])\b/);
  if (pan) push("identity.pan", pan[1], 0.9, "PAN pattern");

  // GSTIN: 2 digits + 7 chars (PAN) + 1 char + Z + alphanumeric
  const gstin = flat.match(/\b(\d{2}[A-Z]{5}\d{4}[A-Z]\d?[A-Z]?\d?[A-Z]?\d)\b/) ?? flat.match(/\b(\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z][Z][\dA-Z])\b/);
  if (gstin) push("business.gstin", gstin[1], 0.92, "GSTIN pattern");

  // CIN / LLPIN: U + 5 letters + 2 digits + 4 alphanumerics + 6 alphanumerics
  const cin = flat.match(/\b([ULL]\d{2}[A-Z]{4}\d{4}[A-Z]{2,3}\d{4,6})\b/);
  if (cin) push("business.registration_number", cin[1], 0.85, "CIN/LLPIN pattern");

  // email
  const email = flat.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
  if (email) push("contact.email", email[0], 0.8, "email pattern");

  // phone with +91 or 10 digits starting 6-9
  const phone = flat.match(/(\+91[\s-]?)?([6-9]\d{9})\b/);
  if (phone) push("contact.phone", phone[0], 0.7, "phone pattern");

  // URL
  const url = flat.match(/https?:\/\/[^\s,;)]+/);
  if (url) {
    push("business.website", url[0], 0.65, "URL pattern");
  }

  // dates — prefer ISO output
  const dateIn = flat.match(/\b(\d{2})[\/\-.](\d{2})[\/\-.](\d{4})\b/);
  if (dateIn) {
    push("business.incorporation_date", `${dateIn[3]}-${dateIn[2]}-${dateIn[1]}`, 0.55, "date pattern (assumed DD/MM/YYYY)");
  } else {
    const dateIso = flat.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
    if (dateIso) push("business.incorporation_date", dateIso[0], 0.55, "date pattern");
  }

  // city / state / pin
  const pin = flat.match(/\b([1-9]\d{5})\b/);
  if (pin) push("contact.postal_code", pin[1], 0.6, "6-digit PIN pattern");

  return out;
}

/** Full pipeline: file → text → candidates. */
export async function extractFromDocument(file: File): Promise<ExtractionResult> {
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  const isImage = file.type.startsWith("image/");

  if (!isPdf && !isImage) {
    return {
      ok: false,
      text: "",
      candidates: [],
      method: "none",
      note: "Automatic text extraction supports images and digital PDFs. This file is stored encrypted — add details manually.",
    };
  }

  const res = isPdf ? await pdfText(file) : await ocrImage(file);
  const candidates = res.ok ? extractCandidateFields(res.text) : [];
  return {
    ok: res.ok,
    text: res.text,
    candidates,
    method: isPdf ? "pdf-text-layer" : "tesseract-ocr",
    note: res.note,
  };
}
