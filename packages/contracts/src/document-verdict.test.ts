import { describe, expect, it } from "vitest";
import {
  parseDocumentVerdictCommand,
  parseDocumentVerdictRecord,
  parseDocumentVerdictValue,
  parsePymeDocumentId
} from "./document-verdict.js";

const DOCUMENT_ID = "55555555-5555-4555-8555-555555555555";

describe("Document verdict contract", () => {
  it.each(["valid", "request", "invalid"])("admits the %s verdict value", (value) => {
    expect(parseDocumentVerdictValue(value)).toBe(value);
  });

  it.each(["approved", "VALID", "", null, 1])("rejects the unknown verdict value %o", (value) => {
    expect(() => parseDocumentVerdictValue(value)).toThrow();
  });

  it("admits a command that carries only the verdict", () => {
    expect(parseDocumentVerdictCommand({ verdict: "request" })).toEqual({ verdict: "request" });
  });

  it.each([
    ["an actor field", { verdict: "valid", actor: "Mallory" }],
    ["an actor user id", { verdict: "valid", actorUserId: "00000000-0000-4000-8000-000000000001" }],
    ["a missing verdict", {}],
    ["an unknown verdict", { verdict: "maybe" }]
  ])("rejects a command with %s", (_label, input) => {
    expect(() => parseDocumentVerdictCommand(input)).toThrow();
  });

  it("admits the read shape the review console renders", () => {
    const record = {
      documentId: DOCUMENT_ID,
      verdict: "invalid",
      actor: "Admin Vaqcrow",
      updatedAt: "2026-10-07T12:00:00.000Z"
    };

    expect(parseDocumentVerdictRecord(record)).toEqual(record);
  });

  it.each([
    ["an extra key", { actorUserId: "00000000-0000-4000-8000-000000000001" }],
    ["a blank actor", { actor: "   " }],
    ["a malformed document id", { documentId: "not-a-uuid" }],
    ["a timestamp without offset", { updatedAt: "2026-10-07 12:00:00" }]
  ])("rejects a read shape with %s", (_label, override) => {
    expect(() =>
      parseDocumentVerdictRecord({
        documentId: DOCUMENT_ID,
        verdict: "valid",
        actor: "Admin Vaqcrow",
        updatedAt: "2026-10-07T12:00:00.000Z",
        ...override
      })
    ).toThrow();
  });

  it("parses a document id and rejects a malformed one", () => {
    expect(parsePymeDocumentId(DOCUMENT_ID)).toBe(DOCUMENT_ID);
    expect(() => parsePymeDocumentId("../etc/passwd")).toThrow();
  });
});
