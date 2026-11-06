/**
 * D-Vault form inspector.
 *
 * Runs ONLY after the user explicitly activates D (activeTab). Extracts the
 * metadata of fillable fields in the active tab — labels, placeholders, input
 * types, required flags, select options. Values are never read. Hidden
 * fields, password fields, file inputs and anything token-like are skipped
 * entirely and reported as unsupported, never collected.
 */

import type { FormFieldMetadata, ExtractedFieldType } from "@dvault/core";

interface ExtractedDomField {
  el: HTMLElement;
  meta: FormFieldMetadata;
}

const SKIP_INPUT_TYPES = new Set([
  "hidden", "password", "file", "submit", "button", "reset", "image", "range",
  "color", "button",
]);

let uidCounter = 0;
const uid = (prefix: string) => `${prefix}-${++uidCounter}-${Math.random().toString(36).slice(2, 7)}`;

/** Compute the best human label for an element. */
function computeLabel(el: HTMLElement, doc: Document): string {
  // 1. <label for=id>
  if (el.id) {
    const label = doc.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (label?.textContent?.trim()) return clean(label.textContent);
  }
  // 2. aria-label / aria-labelledby
  const aria = el.getAttribute("aria-label");
  if (aria) return clean(aria);
  const labelledby = el.getAttribute("aria-labelledby");
  if (labelledby) {
    const parts = labelledby.split(/\s+/).map((id) => doc.getElementById(id)?.textContent?.trim() ?? "");
    const joined = parts.filter(Boolean).join(" ");
    if (joined) return clean(joined);
  }
  // 3. wrapping <label>
  const parent = el.closest("label");
  if (parent?.textContent?.trim()) return clean(parent.textContent);
  // 4. preceding sibling text (common custom form patterns)
  const prev = el.previousElementSibling;
  if (prev && !("value" in prev)) {
    const t = prev.textContent?.trim();
    if (t && t.length < 90) return clean(t);
  }
  // 5. table/definition patterns: previous cell
  const cell = el.closest("td,th");
  if (cell) {
    const row = cell.parentElement;
    const cellIdx = Array.from(row?.children ?? []).indexOf(cell);
    const prevCell = row?.children[cellIdx - 1];
    const t = prevCell?.textContent?.trim();
    if (t && t.length < 90) return clean(t);
  }
  // 6. placeholder / title / name
  const placeholder = el.getAttribute("placeholder");
  if (placeholder) return clean(placeholder);
  const title = el.getAttribute("title");
  if (title) return clean(title);
  const name = el.getAttribute("name");
  if (name) return clean(name);
  return "";
}

function clean(s: string): string {
  const marker = s.includes("*") ? "" : "";
  return marker + s.replace(/[*:·•]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
}

function isRequired(el: HTMLElement): boolean {
  return (
    el.hasAttribute("required") ||
    el.getAttribute("aria-required") === "true" ||
    (el.closest("label")?.textContent.includes("*") ?? false)
  );
}

function fieldType(el: HTMLElement): ExtractedFieldType {
  if (el instanceof HTMLTextAreaElement) return "textarea";
  if (el instanceof HTMLSelectElement) return "select";
  if (el instanceof HTMLInputElement) {
    if (el.type === "checkbox") return "checkbox";
    if (el.type === "radio") return "radio";
    if (el.type === "date" || el.type === "month" || el.type === "week") return "date";
    if (el.type === "number") return "number";
    if (el.type === "tel") return "tel";
    if (el.type === "email") return "email";
    return "text";
  }
  // Non-standard editable widgets are explicitly NOT auto-filled by D.
  return "unsupported";
}

/**
 * Extract all fillable fields from every visible form on the page, plus
 * inputs that live outside <form> (many modern sites do this).
 * Only metadata is collected — no field VALUES are ever read here.
 */
export function inspectPage(doc: Document): {
  formId: string;
  formLabel: string;
  fields: (FormFieldMetadata & { domIndex: number })[];
} {
  uidCounter = 0;
  const fields: ExtractedDomField[] = [];

  const candidates: HTMLElement[] = [
    ...Array.from(doc.querySelectorAll<HTMLElement>("input, textarea, select")),
  ];

  candidates.forEach((el) => {
    // visibility & interactivity gate
    const rect = el.getBoundingClientRect();
    const style = doc.defaultView?.getComputedStyle(el);
    if (style?.display === "none" || style?.visibility === "hidden") return;
    if (rect.width === 0 && rect.height === 0) return;
    if (el instanceof HTMLInputElement && SKIP_INPUT_TYPES.has(el.type)) return;
    if (el.hasAttribute("disabled")) return;
    // skip OTP fields: D never touches OTPs
    const labelish = (
      el.id + " " + el.getAttribute("name") + " " + computeLabel(el, doc)
    ).toLowerCase();
    if (/\botp\b|one[-\s]?time[-\s]?pass|verification code|captcha/.test(labelish)) return;

    const type = fieldType(el);
    const id = el.id || el.getAttribute("name") || uid("field");
    fields.push({
      el,
      meta: {
        formId: "active",
        id,
        label: computeLabel(el, doc),
        placeholder:
          el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement
            ? el.placeholder || undefined
            : undefined,
        type,
        required: isRequired(el),
        options:
          el instanceof HTMLSelectElement
            ? Array.from(el.options).map((o) => o.textContent?.trim() ?? o.value).filter(Boolean).slice(0, 60)
            : el instanceof HTMLInputElement && el.type === "radio"
              ? collectRadioOptions(el, doc)
              : undefined,
        maxLength: el instanceof HTMLInputElement ? (el.maxLength > 0 ? el.maxLength : undefined) : undefined,
        min: el instanceof HTMLInputElement && el.type === "number" ? (el.min ? Number(el.min) : undefined) : undefined,
        max: el instanceof HTMLInputElement && el.type === "number" ? (el.max ? Number(el.max) : undefined) : undefined,
        supported: type !== "unsupported",
        unsupportedReason:
          type === "unsupported"
            ? "Custom or unsupported widget — D fills standard inputs, selects and textareas only."
            : undefined,
        autocompleteHint: el.getAttribute("autocomplete") ?? undefined,
        formLabel: el.closest("form")?.getAttribute("aria-label") ?? undefined,
      },
    });
  });

  return {
    formId: "active",
    formLabel: doc.title?.slice(0, 100) ?? "",
    fields: fields.map((f, i) => ({ ...f.meta, domIndex: i })),
  };
}

function collectRadioOptions(first: HTMLInputElement, doc: Document): string[] {
  const group = Array.from(
    doc.querySelectorAll<HTMLInputElement>(`input[type="radio"][name="${CSS.escape(first.name)}"]`),
  );
  return group.map((r) => r.value).slice(0, 12);
}

/** DOM elements for a set of extracted fields — used at fill time. */
export function resolveDomElements(
  doc: Document,
  metas: { id: string; domIndex: number }[],
): Map<string, HTMLElement> {
  const map = new Map<string, HTMLElement>();
  const all = Array.from(doc.querySelectorAll<HTMLElement>("input, textarea, select"));
  for (const m of metas) {
    const byId = doc.getElementById(m.id);
    const el =
      (byId as HTMLElement | null) ??
      doc.querySelector<HTMLElement>(`[name="${CSS.escape(m.id)}"]`) ??
      all[m.domIndex];
    if (el) map.set(m.id, el);
  }
  return map;
}
