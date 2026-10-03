/**
 * Test-only in-memory `UploadPort`. No network, no timers.
 *
 * It mirrors the adapter's observable contract: a deterministic stored
 * descriptor per file and a sanitized code on failure. It adds test controls
 * the real adapter does not have — `failNext` and a held promise
 * (`holdNextUpload`) so a test can assert the uploading state without fake
 * timers, and `progressSteps` so progress is deterministic.
 *
 * Not collected as a test suite: it has no `.test.` segment.
 */
import type {
  RemoveDocumentResult,
  UploadDocumentInput,
  UploadDocumentResult,
  UploadErrorCode,
  UploadPort
} from "@/application/ports/upload-port";

export class FakeUpload implements UploadPort {
  /** Upload requests received, in order. */
  readonly uploads: UploadDocumentInput[] = [];
  /** Paths passed to `removeDocument`, in order. */
  readonly removes: string[] = [];
  /** Progress values emitted before each upload settles; default `[42]`. */
  progressSteps: readonly number[] = [42];

  private readonly failures: UploadErrorCode[] = [];
  private held: Promise<void> | null = null;

  /** The next upload (or removal) answers `{ ok: false, code }`. */
  failNext(code: UploadErrorCode = "unavailable"): void {
    this.failures.push(code);
  }

  /**
   * Holds the next upload resolution until the returned release is called. The
   * request is recorded and progress is emitted when the call starts, so the
   * uploading state is observable while the promise is pending.
   */
  holdNextUpload(): () => void {
    let release!: () => void;
    this.held = new Promise<void>((resolve) => {
      release = resolve;
    });
    return release;
  }

  async uploadDocument({ kind, file, onProgress }: UploadDocumentInput): Promise<UploadDocumentResult> {
    this.uploads.push(onProgress ? { kind, file, onProgress } : { kind, file });
    for (const step of this.progressSteps) onProgress?.(step);
    const held = this.held;
    this.held = null;
    if (held) await held;
    const failure = this.failures.shift();
    if (failure) return { ok: false, code: failure };
    return { ok: true, path: `${kind}/${file.name}`, name: file.name, size: file.size, contentType: file.type };
  }

  async removeDocument(path: string): Promise<RemoveDocumentResult> {
    this.removes.push(path);
    const failure = this.failures.shift();
    if (failure) return { ok: false, code: failure };
    return { ok: true };
  }
}
