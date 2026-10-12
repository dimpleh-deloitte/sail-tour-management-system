// Add Tour — SSoT §5-§12: Employee Details, Tour Details, Travel Permissions,
// Purpose, Attachments, Advance Details, Tour Authority Details.
// All client-side validation here is UX-only; the Node.js API re-validates
// everything authoritatively (SSoT §17) and this form surfaces its errors.
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { User, MapPin, PlaneTakeoff, Paperclip, IndianRupee, Users, AlertCircle, CheckCircle2, UploadCloud, Building2, Route, Compass, TrainFront, HelpCircle, BedDouble, AlertTriangle } from "lucide-react";
import { api, ApiClientError } from "../api/client.js";
import { useSession } from "../hooks/use-session.js";
import { FormSection } from "../components/ui/form-section.js";
import { Field, inputClass, inputReadOnlyClass } from "../components/ui/field.js";
import { Button } from "../components/ui/button.js";
import { Combobox } from "../components/ui/combobox.js";
import { EligibilityHint } from "../components/ui/eligibility-hint.js";
import { Dialog } from "../components/ui/dialog.js";
import { TravelSummaryCard } from "../components/shared/travel-summary-card.js";
import { AdvanceDetailsTable, AdvanceCategoryLov } from "../components/shared/advance-details-table.js";
import { EntitlementPanel } from "../components/shared/entitlement-panel.js";
import { TourRequestRecord, TaEvaluationResult, TourStatus, EntitlementBreakdown, StayType } from "../types.js";

interface Lov {
  code: string;
  label: string;
}

const ROAD_OPTIONS = ["No", "Own Vehicle", "Hired Vehicle", "Vehicle Retention"];
const AIR_OPTIONS = ["No", "Yes"];
const RAIL_OPTIONS = ["No", "Yes"];
const HEADQUARTERS = ["Bokaro", "Ranchi", "NewDelhi", "Kolkata", "Kiruburu", "Meghathaburu", "Gua", "Manoharpur", "Bhawanathpur", "Dhanbad", "Chasnalla", "Ramnagore", "Tasra", "Jitpur"];

const PENDING_AUTHORITY_BY_STATUS: Partial<Record<TourStatus, string>> = {
  PENDING_FORWARDING: "Forwarding Authority",
  PENDING_RECOMMENDATION: "Recommending Authority",
  PENDING_APPROVAL: "Approving Authority",
};

export function AddTourPage() {
  const { user } = useSession();
  const navigate = useNavigate();

  const [destinations, setDestinations] = useState<Lov[]>([]);
  const [tourTypes, setTourTypes] = useState<string[]>([]);
  const [advanceCategories, setAdvanceCategories] = useState<AdvanceCategoryLov[]>([]);

  const [form, setForm] = useState({
    headquarter: user?.headquarter ?? "",
    commencementDate: "",
    travelStartDate: "",
    travelEndDate: "",
    tourType: "",
    destCode: "",
    purpose: "",
    roadTravelPermission: "No",
    vehicleNumber: "",
    airTravelPermission: "No",
    railTravelPermission: "No",
    nonShortestRouteFlag: false,
    higherClassApprovalFlag: false,
    ownVehicleApprovalFlag: false,
    competentAuthorityApprover: "",
    pnrTicketNumber: "",
    // §7.2B — which DA column applies. Defaults to the lower (hotel/guest
    // house) rate so the shown entitlement never over-states what is due.
    stayType: "HOTEL_OR_GUEST_HOUSE" as StayType,
    // §7.2C(9) — retention of Company accommodation/HRA at the touring
    // location bars Hotel/GH there and halves DA.
    retainsAccommodationAtDestination: false,
  });
  // Applied Amount per fixed advance category (Air Fare / Rail / Road / DA)
  // — keyed by categoryCode. The other three columns (Forwarded/Recommended/
  // Approved) are only ever written by the matching workflow authority, on
  // the Tour Detail page — see AdvanceDetailsTable.
  const [appliedAmounts, setAppliedAmounts] = useState<Record<string, string>>({});
  const [taResult, setTaResult] = useState<TaEvaluationResult | null>(null);
  const [entitlement, setEntitlement] = useState<EntitlementBreakdown | null>(null);
  const [record, setRecord] = useState<TourRequestRecord | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);
  const [submittedInfo, setSubmittedInfo] = useState<{ requestNumber: string; requestId: string } | null>(null);

  useEffect(() => {
    api.get<Lov[]>("/destinations").then(setDestinations);
    api.get<string[]>("/tour-types").then(setTourTypes);
    api.get<AdvanceCategoryLov[]>("/advance-categories").then(setAdvanceCategories);
  }, []);

  // Live TA evaluation whenever the fields that drive it change (debounced).
  // Grade-based entitlements (rail class, road mileage, air class) don't
  // depend on the destination, so this fires as soon as the form loads —
  // it does not wait for a destination to be picked first.
  useEffect(() => {
    if (form.airTravelPermission === undefined) return;
    const handle = setTimeout(() => {
      api
        .post<TaEvaluationResult & { entitlement: EntitlementBreakdown | null }>("/ta/evaluate", {
          destCode: form.destCode || undefined,
          headquarter: form.headquarter || undefined,
          airTravelPermission: form.airTravelPermission,
          roadTravelPermission: form.roadTravelPermission,
          ownVehicleRequested: form.roadTravelPermission === "Own Vehicle",
          nonShortestRoute: form.nonShortestRouteFlag,
          requestedHigherClass: form.higherClassApprovalFlag,
          // Supplying both dates asks the server for the §7.2/§7.3
          // entitlement ceiling as well as eligibility, so the employee sees
          // the maximum admissible amount before submitting.
          travelStartDate: form.travelStartDate || undefined,
          travelEndDate: form.travelEndDate || undefined,
          stayType: form.stayType,
          retainsAccommodationAtDestination: form.retainsAccommodationAtDestination,
        })
        .then((r) => {
          setTaResult(r);
          setEntitlement(r.entitlement ?? null);
        })
        .catch(() => {
          setTaResult(null);
          setEntitlement(null);
        });
    }, 300);
    return () => clearTimeout(handle);
  }, [
    form.destCode,
    form.headquarter,
    form.airTravelPermission,
    form.roadTravelPermission,
    form.nonShortestRouteFlag,
    form.higherClassApprovalFlag,
    form.travelStartDate,
    form.travelEndDate,
    form.stayType,
    form.retainsAccommodationAtDestination,
  ]);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // From Date must be on or after the Commencement Date — many employees
  // apply for the advance only after the tour is already over, so back-dated
  // requests are allowed; what's not allowed is a From Date that precedes
  // when the tour was commenced.
  const commencementDateError =
    form.commencementDate && form.travelStartDate && form.travelStartDate < form.commencementDate
      ? "From Date cannot be before the Commencement Date."
      : null;

  function buildPayload() {
    return {
      ...form,
      vehicleNumber: form.vehicleNumber || null,
      competentAuthorityApprover: form.competentAuthorityApprover || null,
      pnrTicketNumber: form.pnrTicketNumber || null,
      advanceRequired: advanceCategories.some((c) => Number(appliedAmounts[c.code]) > 0),
      advances: advanceCategories.map((c) => ({
        categoryCode: c.code,
        appliedAmount: Number(appliedAmounts[c.code] || 0),
      })),
    };
  }

  async function saveDraft() {
    if (commencementDateError) {
      setBanner({ kind: "error", text: commencementDateError });
      return;
    }
    setBusy(true);
    setBanner(null);
    setErrors({});
    try {
      if (record) {
        const updated = await api.put<TourRequestRecord>(`/tours/${record.requestId}`, {
          ...buildPayload(),
          expectedVersion: record.versionNo,
        });
        setRecord(updated);
      } else {
        const created = await api.post<TourRequestRecord>("/tours", buildPayload());
        setRecord(created);
      }
      setBanner({ kind: "success", text: "Draft saved." });
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(false);
    }
  }

  // "Submit" only opens the confirmation dialog — the actual submission
  // happens in doSubmit() once the employee confirms, so it's unambiguous
  // whether the request actually went through (matches the legacy
  // prototype's Confirm Submission → success modal flow).
  function requestSubmit() {
    if (commencementDateError) {
      setBanner({ kind: "error", text: commencementDateError });
      return;
    }
    setConfirmSubmitOpen(true);
  }

  async function doSubmit() {
    setConfirmSubmitOpen(false);
    setBusy(true);
    setBanner(null);
    setErrors({});
    try {
      let current = record;
      if (!current) {
        current = await api.post<TourRequestRecord>("/tours", buildPayload());
        setRecord(current);
      } else {
        current = await api.put<TourRequestRecord>(`/tours/${current.requestId}`, {
          ...buildPayload(),
          expectedVersion: current.versionNo,
        });
        setRecord(current);
      }
      const submitted = await api.post<TourRequestRecord>(`/tours/${current.requestId}/submit`, {
        expectedVersion: current.versionNo,
      });
      setRecord(submitted);
      setSubmittedInfo({ requestNumber: submitted.requestNumber, requestId: submitted.requestId });
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(false);
    }
  }

  function handleError(err: unknown) {
    if (err instanceof ApiClientError) {
      setBanner({ kind: "error", text: err.message });
      if (err.fieldErrors) setErrors(err.fieldErrors);
    } else {
      setBanner({ kind: "error", text: "An unexpected error occurred." });
    }
  }

  // Live Travel Summary — mirrors the legacy prototype's sticky
  // TravelSummaryCard, recomputed on every keystroke from current form state
  // (not just from the saved record) so it visibly populates as the
  // employee fills the form, before anything is saved to the server.
  const durationDays = useMemo(() => {
    if (!form.travelStartDate || !form.travelEndDate) return 0;
    const start = new Date(form.travelStartDate);
    const end = new Date(form.travelEndDate);
    const diff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return diff > 0 ? diff : 0;
  }, [form.travelStartDate, form.travelEndDate]);

  const appliedTotal = useMemo(
    () => advanceCategories.reduce((sum, c) => sum + (Number(appliedAmounts[c.code]) || 0), 0),
    [advanceCategories, appliedAmounts]
  );

  const summaryData = {
    requestNumber: record?.requestNumber ?? "Draft (not yet saved)",
    controlNumber: record?.controlNumber,
    status: record?.status ?? ("DRAFT" as TourStatus),
    tourType: form.tourType,
    destinationLabel: destinations.find((d) => d.code === form.destCode)?.label ?? form.destCode,
    durationDays,
    roadTravelPermission: form.roadTravelPermission,
    airTravelPermission: form.airTravelPermission,
    railTravelPermission: form.railTravelPermission,
    railEntitlement: taResult?.railEntitlement,
    advanceRequired: appliedTotal > 0,
    appliedTotal,
    pendingAuthority: record ? PENDING_AUTHORITY_BY_STATUS[record.status] : undefined,
  };

  const advanceLinesByCategory = Object.fromEntries((record?.advances ?? []).map((a) => [a.categoryCode, a]));

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-xl font-semibold text-steel-800">Add Tour</h1>
      <p className="mt-1 text-sm text-steel-500">Tour Request &amp; Travel Advance application.</p>

      <AnimatePresence>
        {banner && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className={`mt-4 flex items-center gap-2 overflow-hidden rounded-xl px-4 py-3 text-sm ${
              banner.kind === "error" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"
            }`}
          >
            {banner.kind === "error" ? <AlertCircle className="h-4 w-4 shrink-0" /> : <CheckCircle2 className="h-4 w-4 shrink-0" />}
            {banner.text}
          </motion.div>
        )}
      </AnimatePresence>
      {Object.keys(errors).length > 0 && (
        <ul className="mt-3 list-disc rounded-xl bg-red-50 px-8 py-3 text-xs text-red-700">
          {Object.values(errors).map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}

      {/* Live summary — compact card above the form on tablet/mobile; the
          sticky sidebar (below) takes over on xl+ screens. */}
      <div className="mt-5 xl:hidden">
        <TravelSummaryCard data={summaryData} compact />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1fr_340px]">
      <div className="min-w-0 space-y-5">
        <FormSection number={1} icon={User} title="Employee Details" subtitle="Auto-populated from Fusion HCM — read-only">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Field label="Staff No."><input className={inputReadOnlyClass} value={user?.staffNo ?? ""} readOnly /></Field>
            <Field label="Scale Code"><input className={inputReadOnlyClass} value={user?.scaleCode ?? ""} readOnly /></Field>
            <Field label="Name of the Employee"><input className={inputReadOnlyClass} value={user?.name ?? ""} readOnly /></Field>
            <Field label="Department"><input className={inputReadOnlyClass} value={user?.department ?? ""} readOnly /></Field>
            <Field label="Head Qtr." required>
              <Combobox
                value={form.headquarter}
                onChange={(v) => set("headquarter", v)}
                options={HEADQUARTERS.map((h) => ({ code: h, label: h }))}
                placeholder="Select head quarter…"
                searchPlaceholder="Search head quarter…"
                icon={Building2}
              />
            </Field>
          </div>
        </FormSection>

        <FormSection number={2} icon={MapPin} title="Tour Details">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field label="Commencement Date" required>
              <input type="date" className={inputClass} value={form.commencementDate} onChange={(e) => set("commencementDate", e.target.value)} />
            </Field>
            <Field label="From Date" required error={commencementDateError ?? undefined}>
              <input type="date" className={inputClass} value={form.travelStartDate} onChange={(e) => set("travelStartDate", e.target.value)} />
            </Field>
            <Field label="To Date" required>
              <input type="date" className={inputClass} value={form.travelEndDate} onChange={(e) => set("travelEndDate", e.target.value)} />
            </Field>
            <Field label="Tour Type" required>
              <Combobox
                value={form.tourType}
                onChange={(v) => set("tourType", v)}
                options={tourTypes.map((t) => ({ code: t, label: t }))}
                placeholder="Select tour type…"
                searchPlaceholder="Search tour type…"
                icon={Compass}
                searchable={tourTypes.length > 6}
              />
            </Field>
            <Field label="Tour To / Destination" required>
              <Combobox
                value={form.destCode}
                onChange={(v) => set("destCode", v)}
                options={destinations}
                placeholder="Search destination by code or name…"
                searchPlaceholder="Type code or destination name…"
                icon={MapPin}
              />
            </Field>
            <div className="col-span-full">
              <Field label={`Purpose of Tour (${form.purpose.length}/500)`} required>
                <textarea maxLength={500} rows={3} className={inputClass} value={form.purpose} onChange={(e) => set("purpose", e.target.value)} />
              </Field>
            </div>
          </div>
        </FormSection>

        <FormSection
          number={3}
          icon={PlaneTakeoff}
          title="Travel Permissions"
          subtitle={taResult ? `Live eligibility for grade ${taResult.gradeCode}` : undefined}
        >
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <Field label="Road Travel Permission">
                <Combobox
                  value={form.roadTravelPermission}
                  onChange={(v) => set("roadTravelPermission", v)}
                  options={ROAD_OPTIONS.map((o) => ({ code: o, label: o }))}
                  icon={Route}
                  searchable={false}
                />
              </Field>
              {/* Road entitlement is stated explicitly for every grade
                  (client requirement 1). §6 gives all 24 grades a mileage
                  rate, so this reads "Entitled" throughout; the warning tone
                  is reserved for the §6.1(b) own-vehicle approval gate. */}
              {taResult && (
                <EligibilityHint tone={taResult.road.requiresApproval ? "warning" : "success"}>
                  <strong>{taResult.road.entitled ? "Entitled" : "Not entitled"}</strong>
                  {" — "}
                  {taResult.road.message}
                </EligibilityHint>
              )}
            </div>
            {form.roadTravelPermission !== "No" && (
              <Field label="Vehicle Number">
                <input className={inputClass} value={form.vehicleNumber} onChange={(e) => set("vehicleNumber", e.target.value)} />
              </Field>
            )}

            <div>
              <Field label="Air Travel Permission">
                <Combobox
                  value={form.airTravelPermission}
                  onChange={(v) => set("airTravelPermission", v)}
                  options={AIR_OPTIONS.map((o) => ({ code: o, label: o }))}
                  icon={PlaneTakeoff}
                  searchable={false}
                />
              </Field>
              {taResult && form.airTravelPermission === "Yes" && (
                <EligibilityHint tone={taResult.air.entitled ? "success" : "warning"}>{taResult.air.message}</EligibilityHint>
              )}
              {taResult && form.airTravelPermission === "No" && taResult.air.entitlementClass !== "NOT_ENTITLED" && (
                <EligibilityHint tone="info">
                  Grade {taResult.gradeCode} may be entitled to {taResult.air.entitlementClass} air travel under qualifying conditions.
                </EligibilityHint>
              )}
            </div>

            <div>
              <Field label="Rail Travel Permission">
                <Combobox
                  value={form.railTravelPermission}
                  onChange={(v) => set("railTravelPermission", v)}
                  options={RAIL_OPTIONS.map((o) => ({ code: o, label: o }))}
                  icon={TrainFront}
                  searchable={false}
                />
              </Field>
              {taResult && form.railTravelPermission === "Yes" && (
                <EligibilityHint tone="success">
                  Grade {taResult.gradeCode} is entitled to travel by <strong>{taResult.railEntitlement}</strong> class (any train
                  category including Rajdhani/Shatabadi, excluding luxury trains such as Palace on Wheels).
                </EligibilityHint>
              )}
            </div>

            {(form.airTravelPermission === "Yes" || form.railTravelPermission === "Yes") && (
              <Field label={form.railTravelPermission === "Yes" ? "PNR / Ticket No. (Train)" : "PNR / Ticket No. (Air)"} required>
                <input className={inputClass} value={form.pnrTicketNumber} onChange={(e) => set("pnrTicketNumber", e.target.value)} />
              </Field>
            )}
            <label className="flex items-center gap-2 text-xs text-steel-600">
              <input type="checkbox" checked={form.nonShortestRouteFlag} onChange={(e) => set("nonShortestRouteFlag", e.target.checked)} />
              Non-shortest route
            </label>
            <div>
              <label className="flex items-center gap-2 text-xs text-steel-600">
                <input type="checkbox" checked={form.higherClassApprovalFlag} onChange={(e) => set("higherClassApprovalFlag", e.target.checked)} />
                Requesting higher/different mode or class
              </label>
              {form.higherClassApprovalFlag && taResult && (
                <EligibilityHint tone={taResult.higherClass.discretionaryGrade ? "success" : "warning"}>
                  {taResult.higherClass.discretionaryGrade
                    ? `Grade ${taResult.gradeCode} (E-7 and above) may choose mode/class at their own discretion.`
                    : "Requires Competent Authority (E-9 or above) approval for this grade."}
                </EligibilityHint>
              )}
            </div>
            {(form.roadTravelPermission === "Own Vehicle" ||
              form.nonShortestRouteFlag ||
              form.higherClassApprovalFlag) && (
              <Field label="Competent Authority Approver (Staff No.)">
                <input className={inputClass} value={form.competentAuthorityApprover} onChange={(e) => set("competentAuthorityApprover", e.target.value)} />
              </Field>
            )}
          </div>

          {/* §6(c) 500km indicator — client requirement 7. Shown for every
              request, not only air, so the employee knows before submitting
              that the request will need special approval. */}
          {taResult && form.destCode && (
            <div
              className={`mt-4 flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-xs ${
                taResult.distance.requiresSpecialApproval
                  ? "border-amber-200 bg-amber-50 text-amber-800"
                  : "border-emerald-100 bg-emerald-50 text-emerald-700"
              }`}
            >
              <Route className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div>
                <p className="font-semibold">
                  {taResult.distance.resultCode === "DISTANCE_BEYOND_THRESHOLD"
                    ? `Beyond ${taResult.distance.thresholdKm} km`
                    : taResult.distance.resultCode === "DISTANCE_NOT_RECORDED"
                      ? "Distance not recorded"
                      : `Within ${taResult.distance.thresholdKm} km`}
                </p>
                <p className="mt-0.5 leading-snug">{taResult.distance.message}</p>
              </div>
            </div>
          )}

          <AnimatePresence>
            {taResult && taResult.validationMessages.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 overflow-hidden rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs text-amber-700"
              >
                <p className="font-semibold">Action required before submission</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4">
                  {taResult.validationMessages.map((m, i) => <li key={i}>{m}</li>)}
                </ul>
              </motion.div>
            )}
          </AnimatePresence>
        </FormSection>

        {record && (
          <FormSection number={4} icon={Paperclip} title="Attachments" subtitle="Max 3 files · jpeg/jpg/png/bmp/pdf only">
            <AttachmentsSection record={record} onChange={setRecord} />
          </FormSection>
        )}

        {/* Entitlement ceiling — client requirement 1: "Employee should know
            the maximum amount allowed before submission." Placed directly
            above Advance Details so the cap is visible while the amounts are
            being entered. */}
        <FormSection
          number={5}
          icon={BedDouble}
          title="Stay & Entitlement"
          subtitle="Maximum admissible amount for your grade"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Field label="Stay Arrangement">
                <Combobox
                  value={form.stayType}
                  onChange={(v) => set("stayType", v as StayType)}
                  options={[
                    { code: "HOTEL_OR_GUEST_HOUSE", label: "Hotel / Company Guest House" },
                    { code: "OWN_ARRANGEMENT", label: "Own arrangement (self-certified)" },
                  ]}
                  icon={BedDouble}
                  searchable={false}
                />
              </Field>
              <EligibilityHint tone="info">
                Preference order: Company Guest House, then tie-up hotel. Other hotels only if neither is
                available.
              </EligibilityHint>
            </div>
            <div className="flex items-start pt-6">
              <label className="flex items-start gap-2 text-xs leading-snug text-steel-600">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={form.retainsAccommodationAtDestination}
                  onChange={(e) => set("retainsAccommodationAtDestination", e.target.checked)}
                />
                <span>
                  I retain Company accommodation / HRA at this location
                  <span className="mt-0.5 block text-[11px] text-steel-400">
                    Hotel/Guest House may not be availed and DA is halved.
                  </span>
                </span>
              </label>
            </div>
          </div>

          <div className="mt-4">
            <EntitlementPanel entitlement={entitlement} />
          </div>
        </FormSection>

        <FormSection number={6} icon={IndianRupee} title="Advance Details">
          {/* The applied total is checked against the computed ceiling so the
              employee sees an over-claim before submitting, not after. */}
          {entitlement?.maxComputableAdvance != null && appliedTotal > entitlement.maxComputableAdvance && (
            <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                The total applied (₹{appliedTotal.toLocaleString("en-IN")}) exceeds the DA and lodging ceiling of ₹
                {entitlement.maxComputableAdvance.toLocaleString("en-IN")} for your grade. Journey fare is admissible
                at actuals on top of that ceiling, so this may still be correct — but any DA or lodging claimed above
                the ceiling will be disallowed at settlement.
              </span>
            </div>
          )}
          <AdvanceDetailsTable
            categories={advanceCategories}
            lines={advanceLinesByCategory}
            editableColumn="appliedAmount"
            editableValues={appliedAmounts}
            onEditableChange={(code, value) => setAppliedAmounts((a) => ({ ...a, [code]: value }))}
          />
        </FormSection>

        <FormSection number={6} icon={Users} title="Tour Authority Details" subtitle="Resolved dynamically — never hard-coded">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {["forwarding", "recommending", "approving"].map((key) => (
              <div key={key} className="rounded-xl bg-steel-50 p-3">
                <p className="text-[11px] uppercase tracking-wide text-steel-400">{key} authority</p>
                <p className="mt-1 text-sm font-medium text-steel-800">
                  {record?.authorities[key as "forwarding"]?.name ?? "Resolved on save"}
                </p>
                <p className="text-xs text-steel-500">{record?.authorities[key as "forwarding"]?.designation ?? ""}</p>
              </div>
            ))}
          </div>
        </FormSection>

        <div className="flex justify-end gap-3 pb-10">
          <Button variant="outline" disabled={busy} onClick={saveDraft}>
            Save Draft
          </Button>
          <Button disabled={busy} onClick={requestSubmit}>
            Submit
          </Button>
        </div>
      </div>

      {/* Sticky Travel Summary — desktop only; keeps up with the form state
          live (see summaryData above), matching the legacy prototype. */}
      <div className="hidden xl:block">
        <div className="sticky top-6">
          <TravelSummaryCard data={summaryData} />
        </div>
      </div>
      </div>

      <Dialog
        open={confirmSubmitOpen}
        onClose={() => setConfirmSubmitOpen(false)}
        icon={HelpCircle}
        iconTone="sail"
        title="Confirm Submission"
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmSubmitOpen(false)}>No</Button>
            <Button disabled={busy} onClick={doSubmit}>Yes</Button>
          </>
        }
      >
        Are you sure you want to submit this tour request? Once submitted, it will be sent to your Forwarding Authority for review and can no longer be edited.
      </Dialog>

      <Dialog
        open={!!submittedInfo}
        icon={CheckCircle2}
        iconTone="emerald"
        title="Tour Request Submitted"
        footer={
          <Button onClick={() => submittedInfo && navigate(`/tours/${submittedInfo.requestId}`)}>
            View Request
          </Button>
        }
      >
        {submittedInfo && (
          <>
            Your tour request <span className="font-mono font-semibold text-steel-700">{submittedInfo.requestNumber}</span> has
            been submitted successfully and is now with your Forwarding Authority.
          </>
        )}
      </Dialog>
    </div>
  );
}

function AttachmentsSection({ record, onChange }: { record: TourRequestRecord; onChange: (r: TourRequestRecord) => void }) {
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upload() {
    if (!file) return;
    setError(null);
    const form = new FormData();
    form.append("file", file);
    form.append("attachmentName", name || file.name);
    try {
      await api.postForm(`/tours/${record.requestId}/attachments`, form);
      const refreshed = await api.get<TourRequestRecord>(`/tours/${record.requestId}`);
      onChange(refreshed);
      setName("");
      setFile(null);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Upload failed.");
    }
  }

  return (
    <div>
      <ul className="mb-3 space-y-1.5 text-sm text-steel-700">
        {record.attachments.map((a) => (
          <li key={a.attachmentId} className="flex items-center justify-between rounded-xl bg-steel-50 px-3 py-2">
            <span className="flex items-center gap-2">
              <Paperclip className="h-3.5 w-3.5 text-steel-400" />
              {a.attachmentName} <span className="text-xs text-steel-400">({a.fileName})</span>
            </span>
            <span className="text-xs text-steel-400">{(a.fileSizeBytes / 1024).toFixed(0)} KB</span>
          </li>
        ))}
      </ul>
      {record.attachments.length < 3 && (
        <div className="rounded-xl border-2 border-dashed border-steel-200 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <UploadCloud className="h-5 w-5 shrink-0 text-steel-400" />
            <input placeholder="Attachment name" className={inputClass + " max-w-xs"} value={name} onChange={(e) => setName(e.target.value)} />
            <input type="file" accept=".jpg,.jpeg,.png,.bmp,.pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-xs" />
            <Button size="sm" onClick={upload}>Upload</Button>
          </div>
          <p className="mt-2 text-[11px] text-steel-400">Upload only jpeg/jpg/png/bmp/pdf format · {3 - record.attachments.length} slot(s) remaining</p>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
