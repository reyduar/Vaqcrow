import type {
  SalesDeclarationPort,
  SalesDeclarationResult
} from "@/application/ports/sales-declaration-port";

/**
 * Null-object `SalesDeclarationPort` used when no backend base URL is
 * configured: every declaration is the sanitized `unavailable`, so the form
 * reports an honest failure instead of pretending the declaration was sent.
 */
export const UNAVAILABLE_SALES_DECLARATION_PORT: SalesDeclarationPort = Object.freeze({
  async declare(): Promise<SalesDeclarationResult> {
    return { ok: false, code: "unavailable" };
  }
});
