"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import {
  IoAlertCircleOutline,
  IoFlaskOutline,
  IoPersonOutline,
  IoRemoveCircleOutline,
  IoSparklesOutline
} from "react-icons/io5";
import {
  DEMO_VALUES,
  EMPTY_REGISTRATION_VALUES,
  REGISTRATION_COPY,
  SALES_MONTHS,
  SECTOR_OPTIONS,
  registrationErrorSummary,
  salesAnomaly,
  salesMissing,
  salesMonthAria,
  validateRegistration,
  type RegistrationError,
  type RegistrationField,
  type RegistrationScalarField,
  type RegistrationValues
} from "@/application/pyme-onboarding/registration-step";
import {
  allDocumentsUploaded,
  emptyDocumentsState,
  missingDocumentKinds,
  submitGateMessage,
  type DocumentsState,
  type PhotoState
} from "@/application/pyme-onboarding/document-upload";
import type { UploadPort } from "@/application/ports/upload-port";
import { UNAVAILABLE_UPLOAD_PORT } from "@/infrastructure/upload/unavailable-upload-port";
import { FOCUS_RING } from "../auth-field";
import { DocumentUpload } from "./document-upload";

/**
 * Step 2 «Registrá tu PyME» of the onboarding wizard: the template's form
 * (`docs/design/template/Vaqcrow Onboarding PyME.dc.html` lines 158–197) with
 * the template's own validation rules (lines 315–336) and `fillDemo` values
 * (line 350). No persistence: a valid submit hands the raw strings to
 * `onSubmit` (T3 owns the save, T5 the next steps).
 *
 * Registered deviations:
 * - The template draws only an icon for a missing/anomalous month; a product
 *   rule forbids meaning carried by colour alone, so each indicator also
 *   renders the visible text «Faltante» / «Anomalía».
 * - The template's mock «Declaraciones de ventas» attach control (lines
 *   190–192) is replaced by the real document/photo upload section (owner
 *   decisions U1–U5, T4c): three mandatory document slots and up to four
 *   optional photos. Submitting is blocked until the three documents are
 *   uploaded; the photos stay optional.
 * - Native controls at the template's 48 px / 54 px heights with the repo's
 *   Tailwind tokens, plus `FOCUS_RING`, exactly like step 1 (the shared
 *   primitives are fixed at 44 px and the `Select` renders a popover listbox;
 *   same recorded deviation as T1).
 */

export interface RegistrationStepProps {
  /** Receives the raw form strings on a valid submit; default no-op (T2 has no persistence). */
  readonly onSubmit?: (values: RegistrationValues) => void | Promise<void>;
  /** Upload capability for the document/photo section; defaults to an unavailable port. */
  readonly upload?: UploadPort | undefined;
}

const FIELD_LABELS: Readonly<Record<RegistrationScalarField, string>> = Object.freeze({
  name: REGISTRATION_COPY.fields.name.label,
  cuit: REGISTRATION_COPY.fields.cuit.label,
  sector: REGISTRATION_COPY.fields.sector.label,
  city: REGISTRATION_COPY.fields.city.label,
  desc: REGISTRATION_COPY.fields.desc.label,
  goal: REGISTRATION_COPY.fields.goal.label,
  rs: REGISTRATION_COPY.fields.rs.label
});

const INPUT_BASE =
  "h-12 w-full rounded-control bg-canvas px-3.5 text-[15px] text-text-primary outline-none placeholder:text-text-secondary";
const TEXTAREA_BASE =
  "min-h-24 w-full resize-y rounded-control bg-canvas px-3.5 py-3 text-[15px] leading-relaxed text-text-primary outline-none placeholder:text-text-secondary";

function inputClass(invalid: boolean): string {
  return `${INPUT_BASE} ${invalid ? "border-2 border-trust-critical" : "border border-control"} ${FOCUS_RING}`;
}

function textareaClass(invalid: boolean): string {
  return `${TEXTAREA_BASE} ${invalid ? "border-2 border-trust-critical" : "border border-control"} ${FOCUS_RING}`;
}

function ErrorRow({ id, message }: { readonly id: string; readonly message: string }) {
  return (
    <span id={id} className="flex items-center gap-1 text-[13px] font-medium text-trust-critical">
      <IoAlertCircleOutline aria-hidden="true" focusable="false" className="shrink-0 text-[15px]" />
      {message}
    </span>
  );
}

export function RegistrationStep({ onSubmit = () => {}, upload = UNAVAILABLE_UPLOAD_PORT }: RegistrationStepProps) {
  const uid = useId();
  const controls = useRef<Partial<Record<RegistrationField, HTMLElement | null>>>({});
  const [values, setValues] = useState<RegistrationValues>(EMPTY_REGISTRATION_VALUES);
  const [documents, setDocuments] = useState<DocumentsState>(emptyDocumentsState);
  const [photos, setPhotos] = useState<readonly PhotoState[]>([]);
  const [tried, setTried] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const formTitleId = `${uid}-form-title`;
  const salesErrorId = `${uid}-sales-error`;
  const controlId = (field: RegistrationField) => `${uid}-${field}`;
  const errorId = (field: RegistrationField) => `${uid}-${field}-error`;
  const hintId = (field: RegistrationScalarField) => `${uid}-${field}-hint`;

  const errors: readonly RegistrationError[] = tried ? validateRegistration(values) : [];
  const errorMap = new Map(errors.map((error) => [error.field, error.message]));
  const errorFor = (field: RegistrationField): string | undefined => errorMap.get(field);

  const anomalies = salesAnomaly(values.sales);
  const missingMonths = salesMissing(values.sales);
  const missingDocs = missingDocumentKinds(documents);

  function setField(field: RegistrationScalarField, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function setSale(index: number, value: string) {
    setValues((current) => {
      const sales = current.sales.slice();
      sales[index] = value;
      return { ...current, sales };
    });
  }

  function describedBy(field: RegistrationScalarField): string | undefined {
    const ids: string[] = [];
    if (field === "cuit" || field === "rs") ids.push(hintId(field));
    if (errorFor(field)) ids.push(errorId(field));
    return ids.length ? ids.join(" ") : undefined;
  }

  function fillDemo() {
    setValues({ ...DEMO_VALUES, sales: [...DEMO_VALUES.sales] });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const found = validateRegistration(values);
    setTried(true);
    const firstInvalid = found[0];
    if (firstInvalid) {
      controls.current[firstInvalid.field]?.focus();
      return;
    }
    // Owner U1: the three mandatory documents must be uploaded before sending.
    if (!allDocumentsUploaded(documents)) {
      return;
    }
    const result = onSubmit(values);
    if (result instanceof Promise) {
      setSubmitting(true);
      try {
        await result;
      } finally {
        setSubmitting(false);
      }
    }
  }

  return (
    <div lang="es" className="flex flex-wrap items-start gap-10">
      <div className="sticky top-24 flex min-w-0 flex-[1_1_300px] flex-col gap-5 self-start">
        <h1 className="m-0 text-[clamp(36px,4.4vw,52px)] leading-[1.05] font-bold tracking-[-0.035em]">
          {REGISTRATION_COPY.heading}
        </h1>
        <p className="m-0 text-[17px] leading-[1.55] text-pretty text-text-secondary">{REGISTRATION_COPY.subtitle}</p>
        <div className="flex gap-2.5 rounded-card bg-page-surface px-4 py-3.5 text-sm leading-normal">
          <IoPersonOutline aria-hidden="true" focusable="false" className="mt-0.5 shrink-0 text-[19px]" />
          <span>
            <strong className="font-[650]">{REGISTRATION_COPY.aiCalloutLead}</strong>
            {REGISTRATION_COPY.aiCalloutTail}
          </span>
        </div>
        <div className="flex gap-2.5 rounded-card border border-dashed border-control px-4 py-3.5 text-sm leading-normal">
          <IoFlaskOutline aria-hidden="true" focusable="false" className="mt-0.5 shrink-0 text-[19px]" />
          <span>{REGISTRATION_COPY.demoCallout}</span>
        </div>
      </div>

      <form
        noValidate
        aria-labelledby={formTitleId}
        onSubmit={handleSubmit}
        className="flex min-w-0 flex-[999_1_520px] flex-col gap-[22px] rounded-panel border border-page-border bg-raised p-7"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id={formTitleId} className="m-0 text-xl font-bold">
            {REGISTRATION_COPY.formTitle}
          </h2>
          <button
            type="button"
            onClick={fillDemo}
            className={`inline-flex h-11 items-center gap-1.5 rounded-control border border-control bg-transparent px-3 text-[13px] font-semibold text-text-primary hover:bg-page-surface ${FOCUS_RING}`}
          >
            <IoSparklesOutline aria-hidden="true" focusable="false" className="text-[16px]" />
            {REGISTRATION_COPY.fillDemo}
          </button>
        </div>

        {tried && (errors.length > 0 || missingDocs.length > 0) ? (
          <div
            role="alert"
            className="flex gap-2.5 rounded-card bg-trust-critical-surface px-4 py-3.5 text-sm text-trust-critical"
          >
            <IoAlertCircleOutline aria-hidden="true" focusable="false" className="mt-0.5 shrink-0 text-[19px]" />
            <span>
              {errors.length > 0 ? (
                <>
                  <strong className="font-[650]">{registrationErrorSummary(errors.length)}</strong>{" "}
                  {REGISTRATION_COPY.errorSummaryTail}{" "}
                </>
              ) : null}
              {missingDocs.length > 0 ? submitGateMessage(missingDocs) : null}
            </span>
          </div>
        ) : null}

        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-[18px]">
          <div className="flex min-w-0 flex-col gap-1.5">
            <label htmlFor={controlId("name")} className="text-sm font-semibold">
              {FIELD_LABELS.name}
            </label>
            <input
              id={controlId("name")}
              ref={(element) => {
                controls.current.name = element;
              }}
              value={values.name}
              onChange={(event) => setField("name", event.target.value)}
              placeholder={REGISTRATION_COPY.fields.name.placeholder}
              aria-invalid={errorFor("name") ? "true" : undefined}
              aria-describedby={describedBy("name")}
              className={inputClass(Boolean(errorFor("name")))}
            />
            {errorFor("name") ? <ErrorRow id={errorId("name")} message={errorFor("name") as string} /> : null}
          </div>

          <div className="flex min-w-0 flex-col gap-1.5">
            <label htmlFor={controlId("cuit")} className="text-sm font-semibold">
              {FIELD_LABELS.cuit}
            </label>
            <input
              id={controlId("cuit")}
              ref={(element) => {
                controls.current.cuit = element;
              }}
              value={values.cuit}
              onChange={(event) => setField("cuit", event.target.value)}
              inputMode="numeric"
              placeholder={REGISTRATION_COPY.fields.cuit.placeholder}
              aria-invalid={errorFor("cuit") ? "true" : undefined}
              aria-describedby={describedBy("cuit")}
              className={inputClass(Boolean(errorFor("cuit")))}
            />
            <span id={hintId("cuit")} className="text-xs text-text-secondary">
              {REGISTRATION_COPY.fields.cuit.hint}
            </span>
            {errorFor("cuit") ? <ErrorRow id={errorId("cuit")} message={errorFor("cuit") as string} /> : null}
          </div>

          <div className="flex min-w-0 flex-col gap-1.5">
            <label htmlFor={controlId("sector")} className="text-sm font-semibold">
              {FIELD_LABELS.sector}
            </label>
            <select
              id={controlId("sector")}
              ref={(element) => {
                controls.current.sector = element;
              }}
              value={values.sector}
              onChange={(event) => setField("sector", event.target.value)}
              aria-invalid={errorFor("sector") ? "true" : undefined}
              aria-describedby={describedBy("sector")}
              className={inputClass(Boolean(errorFor("sector")))}
            >
              <option value="">{REGISTRATION_COPY.fields.sector.placeholder}</option>
              {SECTOR_OPTIONS.map((sector) => (
                <option key={sector} value={sector}>
                  {sector}
                </option>
              ))}
            </select>
            {errorFor("sector") ? <ErrorRow id={errorId("sector")} message={errorFor("sector") as string} /> : null}
          </div>

          <div className="flex min-w-0 flex-col gap-1.5">
            <label htmlFor={controlId("city")} className="text-sm font-semibold">
              {FIELD_LABELS.city}
            </label>
            <input
              id={controlId("city")}
              ref={(element) => {
                controls.current.city = element;
              }}
              value={values.city}
              onChange={(event) => setField("city", event.target.value)}
              placeholder={REGISTRATION_COPY.fields.city.placeholder}
              aria-invalid={errorFor("city") ? "true" : undefined}
              aria-describedby={describedBy("city")}
              className={inputClass(Boolean(errorFor("city")))}
            />
            {errorFor("city") ? <ErrorRow id={errorId("city")} message={errorFor("city") as string} /> : null}
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-1.5">
          <label htmlFor={controlId("desc")} className="text-sm font-semibold">
            {FIELD_LABELS.desc}
          </label>
          <textarea
            id={controlId("desc")}
            ref={(element) => {
              controls.current.desc = element;
            }}
            value={values.desc}
            onChange={(event) => setField("desc", event.target.value)}
            rows={4}
            placeholder={REGISTRATION_COPY.fields.desc.placeholder}
            aria-invalid={errorFor("desc") ? "true" : undefined}
            aria-describedby={describedBy("desc")}
            className={textareaClass(Boolean(errorFor("desc")))}
          />
          {errorFor("desc") ? <ErrorRow id={errorId("desc")} message={errorFor("desc") as string} /> : null}
        </div>

        <fieldset className="m-0 flex flex-col gap-3 border-none p-0">
          <legend className="mb-2.5 flex w-full items-center justify-between gap-2 p-0 text-sm font-semibold">
            <span>{REGISTRATION_COPY.salesLegend}</span>
            <span className="inline-flex h-[22px] items-center gap-1 rounded-pill border border-dashed border-text-secondary px-2 text-[11px] font-[650] tracking-[0.04em] text-text-primary">
              <IoFlaskOutline aria-hidden="true" focusable="false" className="text-[13px]" />
              {REGISTRATION_COPY.simulado}
            </span>
          </legend>

          <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-2.5">
            {SALES_MONTHS.map((month, index) => {
              const missing = missingMonths[index] ?? false;
              const anomaly = anomalies[index] ?? false;
              const showMissing = tried && missing;
              const indicator = anomaly
                ? { icon: IoAlertCircleOutline, label: REGISTRATION_COPY.anomaly, className: "text-trust-critical" }
                : showMissing
                  ? { icon: IoRemoveCircleOutline, label: REGISTRATION_COPY.missing, className: "text-text-secondary" }
                  : null;
              const IndicatorIcon = indicator?.icon;
              return (
                <label
                  key={month}
                  className={`flex flex-col gap-1 rounded-control bg-page-surface p-2.5 ${
                    anomaly ? "border-[1.5px] border-trust-critical" : "border border-transparent"
                  }`}
                >
                  <span className="flex items-center justify-between gap-2 text-xs text-text-secondary">
                    <span>{month}</span>
                    {indicator && IndicatorIcon ? (
                      <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${indicator.className}`}>
                        <IndicatorIcon aria-hidden="true" focusable="false" className="text-[14px]" />
                        {indicator.label}
                      </span>
                    ) : null}
                  </span>
                  <input
                    ref={
                      index === 0
                        ? (element) => {
                            controls.current.sales = element;
                          }
                        : undefined
                    }
                    value={values.sales[index] ?? ""}
                    onChange={(event) => setSale(index, event.target.value)}
                    inputMode="numeric"
                    placeholder="Sin dato"
                    aria-label={salesMonthAria(month)}
                    aria-invalid={errorFor("sales") && missing ? "true" : undefined}
                    aria-describedby={errorFor("sales") && index === 0 ? salesErrorId : undefined}
                    className="w-full border-none bg-transparent p-0 text-[15px] font-[650] text-text-primary outline-none placeholder:font-normal placeholder:text-text-secondary"
                  />
                </label>
              );
            })}
          </div>

          <span className="text-xs text-text-secondary">{REGISTRATION_COPY.salesHint}</span>
          {errorFor("sales") ? <ErrorRow id={salesErrorId} message={errorFor("sales") as string} /> : null}
        </fieldset>

        {/* Where the template drew its mock «Declaraciones de ventas» attach control. */}
        <DocumentUpload
          upload={upload}
          documents={documents}
          photos={photos}
          onDocumentsChange={setDocuments}
          onPhotosChange={setPhotos}
        />

        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-[18px]">
          <div className="flex min-w-0 flex-col gap-1.5">
            <label htmlFor={controlId("goal")} className="text-sm font-semibold">
              {FIELD_LABELS.goal}
            </label>
            <input
              id={controlId("goal")}
              ref={(element) => {
                controls.current.goal = element;
              }}
              value={values.goal}
              onChange={(event) => setField("goal", event.target.value)}
              inputMode="numeric"
              placeholder={REGISTRATION_COPY.fields.goal.placeholder}
              aria-invalid={errorFor("goal") ? "true" : undefined}
              aria-describedby={describedBy("goal")}
              className={inputClass(Boolean(errorFor("goal")))}
            />
            {errorFor("goal") ? <ErrorRow id={errorId("goal")} message={errorFor("goal") as string} /> : null}
          </div>

          <div className="flex min-w-0 flex-col gap-1.5">
            <label htmlFor={controlId("rs")} className="text-sm font-semibold">
              {FIELD_LABELS.rs}
            </label>
            <input
              id={controlId("rs")}
              ref={(element) => {
                controls.current.rs = element;
              }}
              value={values.rs}
              onChange={(event) => setField("rs", event.target.value)}
              inputMode="decimal"
              placeholder={REGISTRATION_COPY.fields.rs.placeholder}
              aria-invalid={errorFor("rs") ? "true" : undefined}
              aria-describedby={describedBy("rs")}
              className={inputClass(Boolean(errorFor("rs")))}
            />
            <span id={hintId("rs")} className="text-xs text-text-secondary">
              {REGISTRATION_COPY.fields.rs.hint}
            </span>
            {errorFor("rs") ? <ErrorRow id={errorId("rs")} message={errorFor("rs") as string} /> : null}
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className={`inline-flex h-[54px] items-center justify-center gap-2.5 rounded-control bg-brand-accent text-base font-[650] text-on-accent hover:bg-brand-accent-hover disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none ${FOCUS_RING}`}
        >
          {submitting ? (
            <span
              aria-hidden="true"
              className="h-[18px] w-[18px] animate-spin rounded-full border-2 border-on-accent/35 border-t-on-accent motion-reduce:animate-none"
            />
          ) : null}
          {submitting ? REGISTRATION_COPY.submitting : REGISTRATION_COPY.submit}
        </button>

        <p className="m-0 -mt-2 text-center text-xs text-text-secondary">{REGISTRATION_COPY.bottomNote}</p>
      </form>
    </div>
  );
}
