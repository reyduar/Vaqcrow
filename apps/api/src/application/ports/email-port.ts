/**
 * Vendor-free transactional-email port (Feature #382, Task #383 / T1b-1).
 *
 * The application layer knows only this shape; the Resend HTTP specifics live
 * in `infrastructure/adapters/resend-email-adapter.ts` (T1b-2). `send` never
 * throws into the caller — a failed email is a result the caller can ignore,
 * because email delivery must never block the action that raised the event.
 */

export interface EmailMessage {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
}

export type EmailSendResult =
  | { readonly ok: true; readonly id: string }
  | { readonly ok: false; readonly code: "invalid" | "unavailable" | "network" };

export interface EmailPort {
  send(message: EmailMessage): Promise<EmailSendResult>;
}
