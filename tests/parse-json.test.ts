import { describe, it, expect } from "vitest";
import { extractJsonObject } from "../apps/web/src/lib/ai/parse-json";

describe("LLM JSON extraction (Kimi K2.7 output shapes)", () => {
  it("parses plain JSON", () => {
    expect(extractJsonObject('{"mappings":[{"index":0,"fieldKey":"a","confidence":0.9}]}')).toEqual({
      mappings: [{ index: 0, fieldKey: "a", confidence: 0.9 }],
    });
  });

  it("parses JSON inside a ```json fence (Kimi's habit)", () => {
    const raw = '```json\n{"mappings":[{"index":0,"fieldKey":"business.company_name","confidence":0.99}]}\n```';
    const out = extractJsonObject(raw) as { mappings: { fieldKey: string }[] };
    expect(out.mappings[0].fieldKey).toBe("business.company_name");
  });

  it("parses JSON inside an untagged fence", () => {
    const raw = '```\n{"ok": true}\n```';
    expect(extractJsonObject(raw)).toEqual({ ok: true });
  });

  it("carves JSON out of surrounding prose", () => {
    const raw =
      "Here is the requested mapping as JSON:\n" +
      '{"mappings":[{"index":1,"fieldKey":"contact.email","confidence":0.8}]}\n' +
      "Let me know if you need anything else!";
    const out = extractJsonObject(raw) as { mappings: { confidence: number }[] };
    expect(out.mappings[0].confidence).toBe(0.8);
  });

  it("keeps nested objects and arrays intact", () => {
    const raw = '```json\n{"a":{"b":[1,2,{"c":"x"}]},"d":null}\n```';
    expect(extractJsonObject(raw)).toEqual({ a: { b: [1, 2, { c: "x" }] }, d: null });
  });

  it("returns null for non-JSON output", () => {
    expect(extractJsonObject("I'm sorry, I can't map these fields.")).toBeNull();
    expect(extractJsonObject("")).toBeNull();
    expect(extractJsonObject(null)).toBeNull();
    expect(extractJsonObject(undefined)).toBeNull();
  });

  it("returns null for truncated JSON", () => {
    expect(extractJsonObject('{"mappings":[{"index":0')).toBeNull();
  });
});
