"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Modal, SecondaryButton, SubmitButton } from "@/components/ui/modal";
import {
  Field,
  FormError,
  InfoNote,
  ToggleRow,
  FIELD_CLASS,
  inputClass,
} from "@/components/ui/field";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PanelCard,
} from "@/components/ui/table-states";
import { useToast } from "@/components/ui/toast";
import { ApiError, apiRequest, errorMessage } from "@/lib/api/client";
import { useRole } from "@/contexts/role-context";
import { formatDate } from "@/lib/format";
import {
  DOCUMENT_TYPES,
  documentTypeLabel,
  type AgreementDocument,
  type AgreementDocumentRequest,
} from "@/lib/agreements";

/**
 * The waiver and house rules members sign at registration.
 *
 * Versions are kept rather than edited over: an acceptance is recorded against
 * the version the member actually read, so the text they agreed to can still be
 * produced years later. Activating a version stands the previous one down —
 * exactly one version of each type is current, and the screen says so.
 */

const COLUMNS = 6;

type FormState = {
  documentType: string;
  version: string;
  title: string;
  content: string;
  isActive: boolean;
};

const EMPTY_FORM: FormState = {
  documentType: "Waiver",
  version: "1.0",
  title: "",
  content: "",
  isActive: true,
};

export function AgreementsView() {
  const toast = useToast();
  const { can } = useRole();
  const canWrite = can("agreement.write");

  const [documents, setDocuments] = useState<AgreementDocument[]>([]);
  const [typeFilter, setTypeFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AgreementDocument | null>(null);
  const [viewing, setViewing] = useState<AgreementDocument | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<AgreementDocument[]>(
        "/api/agreements/documents",
        { query: { documentType: typeFilter } }
      );
      setDocuments(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(errorMessage(err));
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [typeFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = useMemo(() => {
    const sorted = [...documents].sort((a, b) => {
      if (a.documentType !== b.documentType) {
        return a.documentType.localeCompare(b.documentType);
      }
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      return (b.effectiveFrom ?? "").localeCompare(a.effectiveFrom ?? "");
    });
    return sorted;
  }, [documents]);

  /** The version a new registration will present, per type. */
  const activeByType = useMemo(() => {
    const map: Record<string, AgreementDocument | undefined> = {};
    for (const type of DOCUMENT_TYPES) {
      map[type.value] = documents.find(
        (doc) => doc.documentType === type.value && doc.isActive
      );
    }
    return map;
  }, [documents]);

  function openCreate(documentType: string) {
    setEditing(null);
    setForm({ ...EMPTY_FORM, documentType });
    setFormError(null);
    setFieldErrors({});
    setFormOpen(true);
  }

  function openEdit(document: AgreementDocument) {
    setEditing(document);
    setForm({
      documentType: document.documentType,
      version: document.version,
      title: document.title,
      content: document.content,
      isActive: document.isActive,
    });
    setFormError(null);
    setFieldErrors({});
    setFormOpen(true);
  }

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;

    const errors: Record<string, string> = {};
    if (!form.title.trim()) errors.title = "A title is required.";
    if (!form.version.trim()) errors.version = "A version is required.";
    if (!form.content.trim()) errors.content = "The document text is required.";

    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      setFormError("Please correct the highlighted fields.");
      return;
    }

    const body: AgreementDocumentRequest = {
      documentType: form.documentType,
      version: form.version.trim(),
      title: form.title.trim(),
      content: form.content,
      isActive: form.isActive,
    };

    setFormError(null);
    setSubmitting(true);
    try {
      if (editing) {
        await apiRequest(`/api/agreements/documents/${editing.id}`, {
          method: "PUT",
          body,
        });
        toast.success("Document updated.");
      } else {
        await apiRequest("/api/agreements/documents", {
          method: "POST",
          body,
        });
        toast.success(
          "Version created.",
          form.isActive
            ? "New registrations will now present this version."
            : "Saved as an inactive version."
        );
      }
      setFormOpen(false);
      setEditing(null);
      await load();
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length) {
        setFieldErrors(err.fieldErrors);
      }
      setFormError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(document: AgreementDocument) {
    setBusyId(document.id);
    try {
      await apiRequest(`/api/agreements/documents/${document.id}`, {
        method: "PUT",
        body: {
          documentType: document.documentType,
          version: document.version,
          title: document.title,
          content: document.content,
          isActive: !document.isActive,
        },
      });
      toast.success(
        document.isActive
          ? "Version deactivated."
          : "Version activated. It is the one new members will sign."
      );
      await load();
    } catch (err) {
      toast.error("Could not update the document", errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {DOCUMENT_TYPES.map((type) => {
          const active = activeByType[type.value];
          return (
            <PanelCard key={type.value}>
              <div className="p-4 sm:p-5 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-wider text-muted font-bold">
                    Current {type.label}
                  </p>
                  {active ? (
                    <>
                      <p className="text-fg font-bold mt-1 truncate">
                        {active.title}
                      </p>
                      <p className="text-xs text-muted mt-0.5">
                        Version {active.version} • effective{" "}
                        {formatDate(active.effectiveFrom)}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-warning mt-1">
                      No active version — registration cannot present this
                      document.
                    </p>
                  )}
                </div>
                {canWrite ? (
                  <button
                    type="button"
                    onClick={() => openCreate(type.value)}
                    className="shrink-0 bg-fg/5 hover:bg-fg/10 text-fg border border-border px-3 py-2 rounded-lg text-xs font-bold transition"
                  >
                    <i className="fas fa-plus mr-1.5" aria-hidden />
                    New version
                  </button>
                ) : null}
              </div>
            </PanelCard>
          );
        })}
      </div>

      <PanelCard>
        <div className="p-4 sm:p-6 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold font-display uppercase text-fg">
              Agreement Documents
            </h3>
            <p className="text-xs text-muted mt-1">
              Every version, kept so a member&apos;s acceptance can be traced to
              the text they read.
            </p>
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            aria-label="Filter by document type"
            className={`${FIELD_CLASS} !py-2 text-sm sm:w-56`}
          >
            <option value="">All document types</option>
            {DOCUMENT_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[840px] text-left text-sm text-muted">
            <thead className="bg-sidebar text-xs uppercase font-bold text-muted">
              <tr>
                <th className="px-6 py-4">Document Type</th>
                <th className="px-6 py-4">Version</th>
                <th className="px-6 py-4">Title</th>
                <th className="px-6 py-4">Active</th>
                <th className="px-6 py-4">Effective From</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <LoadingState colSpan={COLUMNS} />
              ) : error ? (
                <ErrorState
                  colSpan={COLUMNS}
                  message={error}
                  onRetry={() => void load()}
                />
              ) : grouped.length === 0 ? (
                <EmptyState
                  colSpan={COLUMNS}
                  icon="fa-file-signature"
                  title="No documents configured"
                  description="Registration needs an active waiver and house rules before a member can sign."
                />
              ) : (
                grouped.map((document) => (
                  <tr key={document.id} className="table-row transition">
                    <td className="px-6 py-4">
                      <Badge
                        tone={
                          document.documentType === "Waiver" ? "info" : "accent"
                        }
                        icon={
                          document.documentType === "Waiver"
                            ? "fa-file-signature"
                            : "fa-scroll"
                        }
                      >
                        {documentTypeLabel(document.documentType)}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-fg font-bold whitespace-nowrap">
                      {document.version}
                    </td>
                    <td className="px-6 py-4 text-fg">{document.title}</td>
                    <td className="px-6 py-4">
                      <Badge
                        tone={document.isActive ? "success" : "neutral"}
                        icon={
                          document.isActive ? "fa-circle-check" : "fa-clock-rotate-left"
                        }
                      >
                        {document.isActive ? "Active" : "Superseded"}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-xs whitespace-nowrap">
                      {formatDate(document.effectiveFrom)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setViewing(document)}
                          className="text-muted hover:text-fg px-2 py-1"
                          aria-label={`View ${document.title}`}
                          title="View content"
                        >
                          <i className="fas fa-eye" aria-hidden />
                        </button>
                        {canWrite ? (
                          <>
                            <button
                              type="button"
                              onClick={() => openEdit(document)}
                              className="text-muted hover:text-fg px-2 py-1"
                              aria-label={`Edit ${document.title}`}
                              title="Edit"
                            >
                              <i className="fas fa-edit" aria-hidden />
                            </button>
                            <button
                              type="button"
                              onClick={() => void toggleActive(document)}
                              disabled={busyId === document.id}
                              className="text-muted hover:text-fg px-2 py-1 disabled:opacity-40"
                              aria-label={`${document.isActive ? "Deactivate" : "Activate"} ${document.title}`}
                              title={
                                document.isActive ? "Deactivate" : "Activate"
                              }
                            >
                              <i
                                className={`fas ${
                                  busyId === document.id
                                    ? "fa-circle-notch fa-spin"
                                    : document.isActive
                                      ? "fa-toggle-on"
                                      : "fa-toggle-off"
                                }`}
                                aria-hidden
                              />
                            </button>
                          </>
                        ) : (
                          <span className="text-xs text-muted">
                            View only
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </PanelCard>

      {!canWrite ? (
        <p className="text-xs text-muted">
          <i className="fas fa-lock mr-1.5" aria-hidden />
          Agreement text is legal wording, so editing it is reserved for a Super
          Admin.
        </p>
      ) : null}

      <Modal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        busy={submitting}
        size="lg"
        title={editing ? "Edit Document" : "New Document Version"}
        subtitle={documentTypeLabel(form.documentType)}
      >
        <form id="agreement-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Document Type" htmlFor="ag-type" required>
              <select
                id="ag-type"
                className={inputClass()}
                value={form.documentType}
                onChange={(e) => set("documentType", e.target.value)}
                disabled={Boolean(editing)}
              >
                {DOCUMENT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Version"
              htmlFor="ag-version"
              required
              error={fieldErrors.version}
              hint="Recorded against every acceptance."
            >
              <input
                id="ag-version"
                type="text"
                className={inputClass(Boolean(fieldErrors.version))}
                placeholder="e.g. 2.0"
                value={form.version}
                onChange={(e) => set("version", e.target.value)}
              />
            </Field>
          </div>

          <Field
            label="Title"
            htmlFor="ag-title"
            required
            error={fieldErrors.title}
          >
            <input
              id="ag-title"
              type="text"
              className={inputClass(Boolean(fieldErrors.title))}
              placeholder="e.g. SWEATBOX Liability Waiver"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
            />
          </Field>

          <Field
            label="Content"
            htmlFor="ag-content"
            required
            error={fieldErrors.content}
            hint="The exact text the member reads and signs. Line breaks are preserved."
          >
            <textarea
              id="ag-content"
              rows={14}
              className={`${inputClass(Boolean(fieldErrors.content))} text-sm leading-relaxed`}
              value={form.content}
              onChange={(e) => set("content", e.target.value)}
            />
          </Field>

          <ToggleRow
            id="ag-active"
            label="Make this the active version"
            description="New registrations will present it. The previous active version is stood down automatically."
            checked={form.isActive}
            onChange={(v) => set("isActive", v)}
          />

          {editing?.isActive ? (
            <InfoNote>
              Members have already signed this version. Editing its text changes
              what a reprinted copy says — if the wording is genuinely changing,
              create a new version instead.
            </InfoNote>
          ) : null}

          <FormError message={formError} />
        </form>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 mt-6">
          <SecondaryButton
            onClick={() => {
              setFormOpen(false);
              setEditing(null);
            }}
            disabled={submitting}
          >
            Cancel
          </SecondaryButton>
          <SubmitButton submitting={submitting} form="agreement-form">
            <i className="fas fa-save" aria-hidden />
            {editing ? "Save Changes" : "Create Version"}
          </SubmitButton>
        </div>
      </Modal>

      <Modal
        open={Boolean(viewing)}
        onClose={() => setViewing(null)}
        size="lg"
        title={viewing?.title ?? "Document"}
        subtitle={
          viewing
            ? `${documentTypeLabel(viewing.documentType)} • version ${viewing.version} • effective ${formatDate(viewing.effectiveFrom)}`
            : undefined
        }
      >
        <pre className="bg-sidebar border border-border rounded-lg p-4 text-sm text-fg-soft whitespace-pre-wrap leading-relaxed">
          {viewing?.content}
        </pre>
      </Modal>
    </div>
  );
}
