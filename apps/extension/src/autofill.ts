/**
 * D-Vault autofill.
 *
 * Fills ONLY the fields the user approved, using the native value setter so
 * React/Vue/Angular-controlled inputs register the change (input/change
 * events are dispatched manually). D never submits forms and never touches
 * CAPTCHAs, OTPs or file inputs.
 */

const getSetter = (el: HTMLElement, prop: string) => {
  const proto = Object.getPrototypeOf(el);
  return Object.getOwnPropertyDescriptor(proto, prop)?.set;
};

export interface FillResult {
  filled: string[];
  failed: { id: string; reason: string }[];
}

function fire(el: HTMLElement, type: string) {
  el.dispatchEvent(new Event(type, { bubbles: true, cancelable: false }));
}

export function fillField(el: HTMLElement, value: string, type: string): string | null {
  try {
    if (el instanceof HTMLTextAreaElement) {
      const setter = getSetter(el, "value");
      if (setter) setter.call(el, value); else el.value = value;
      fire(el, "input");
      fire(el, "change");
      return null;
    }
    if (el instanceof HTMLSelectElement) {
      const match = Array.from(el.options).find(
        (o) =>
          o.value === value ||
          (o.textContent ?? "").trim().toLowerCase() === value.trim().toLowerCase() ||
          (o.textContent ?? "").trim().toLowerCase().startsWith(value.trim().toLowerCase()) ||
          value.trim().toLowerCase().startsWith((o.textContent ?? "").trim().toLowerCase()),
      );
      if (!match) return `“${value}” is not one of the available options`;
      const setter = getSetter(el, "value");
      if (setter) setter.call(el, match.value); else el.value = match.value;
      fire(el, "input");
      fire(el, "change");
      return null;
    }
    if (el instanceof HTMLInputElement) {
      if (el.type === "radio") {
        const group = Array.from(
          document.querySelectorAll<HTMLInputElement>(`input[type="radio"][name="${CSS.escape(el.name)}"]`),
        );
        const match = group.find(
          (r) =>
            r.value === value ||
            r.value.toLowerCase() === value.trim().toLowerCase() ||
            r.value.toLowerCase().startsWith(value.trim().toLowerCase()),
        );
        if (!match) return `“${value}” doesn't match any option`;
        match.checked = true;
        fire(match, "input");
        fire(match, "change");
        return null;
      }
      const setter = getSetter(el, "value");
      if (setter) setter.call(el, value); else el.value = value;
      // let sites validate the newly entered value
      fire(el, "input");
      fire(el, "change");
      fire(el, "blur");
      return null;
    }
    return "Unsupported element type";
  } catch (e) {
    return e instanceof Error ? e.message : "Fill failed";
  }
}
