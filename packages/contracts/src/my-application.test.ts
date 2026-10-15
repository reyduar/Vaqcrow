import { describe, expect, it } from "vitest";
import {
  myApplicationReadSchema,
  myDocumentsReadSchema,
  parseMyApplicationRead,
  parseMyDocumentsRead,
  pymeDocumentKindSchema
} from "./my-application.js";

/**
 * The company post-submission read models (#530/T1/T2): the owner's own
 * application and the metadata of its uploaded documents.
 *
 * Both are scoped to the verified principal server-side, so no owner id crosses
 * this boundary — and a document's storage object path never does either. Both
 * shapes are strict, so an unexpected key (in particular an `objectPath`) is
 * refused rather than silently forwarded.
 */
const APPLICATION_ID = "123e4567-e89b-42d3-a456-426614174000";
const DOCUMENT_ID = "323e4567-e89b-42d3-a456-426614174000";

const document = {
  documentId: DOCUMENT_ID,
  kind: "cuit",
  name: "constancia-cuit.pdf",
  sizeBytes: 20480,
  contentType: "application/pdf",
  createdAt: "2026-10-15T12:00:00.000Z"
};

describe("myApplicationReadSchema", () => {
  it("accepts the owner's application with its real review state", () => {
    expect(
      myApplicationReadSchema.parse({ application: { applicationId: APPLICATION_ID, state: "human_review" } })
    ).toEqual({ application: { applicationId: APPLICATION_ID, state: "human_review" } });
  });

  it("accepts an owner with no application as null", () => {
    expect(parseMyApplicationRead({ application: null })).toEqual({ application: null });
  });

  it("rejects an unknown key", () => {
    expect(() => myApplicationReadSchema.parse({ application: null, ownerUserId: "leak" })).toThrow();
  });

  it("rejects an unknown state", () => {
    expect(() =>
      myApplicationReadSchema.parse({ application: { applicationId: APPLICATION_ID, state: "whatever" } })
    ).toThrow();
  });
});

describe("myDocumentsReadSchema", () => {
  it("carries document metadata only, never the storage object path", () => {
    const parsed = parseMyDocumentsRead({ documents: [document] });

    expect(parsed).toEqual({ documents: [document] });
    expect(Object.keys(parsed.documents[0]!)).not.toContain("objectPath");
  });

  it("rejects a document that carries an object path", () => {
    expect(() =>
      myDocumentsReadSchema.parse({ documents: [{ ...document, objectPath: "owner/cuit/x.pdf" }] })
    ).toThrow();
  });

  it("rejects an unknown document kind", () => {
    expect(() => myDocumentsReadSchema.parse({ documents: [{ ...document, kind: "passport" }] })).toThrow();
  });

  it("accepts every persisted document kind", () => {
    for (const kind of pymeDocumentKindSchema.options) {
      expect(myDocumentsReadSchema.safeParse({ documents: [{ ...document, kind }] }).success).toBe(true);
    }
  });

  it("accepts an owner with no documents", () => {
    expect(parseMyDocumentsRead({ documents: [] })).toEqual({ documents: [] });
  });
});
