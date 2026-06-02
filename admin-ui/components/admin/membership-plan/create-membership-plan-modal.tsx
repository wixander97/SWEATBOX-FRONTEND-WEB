"use client";

import { useCallback, useState, type FormEvent } from "react";

type Branch = {
    id: string;
    branchName: string;
    isActive: boolean;
};

export type MembershipPlanFormValues = {
    branchId: string;
    planName: string;
    description: string;
    price: number;
    credits: number;
    validityDays: number;
    isUnlimitedClasses: boolean;
    isPtIncluded: boolean;
    ptSessions: number;
    isPopular: boolean;
    planCategory: string;
    registrationFee: number;
    allowMultiBranchAccess: boolean;
    isActive: boolean;
};

type Props = {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (values: MembershipPlanFormValues) => Promise<void>;
    initialValues?: Partial<MembershipPlanFormValues>;
    isEdit?: boolean;
    branches: Branch[];
};

export function CreateMembershipPlanModal({
    isOpen,
    onClose,
    onSubmit,
    initialValues,
    isEdit = false,
    branches,
}: Props) {
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = useCallback(
        async (e: FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            setError("");
            setSubmitting(true);
            const fd = new FormData(e.currentTarget);
            const payload: MembershipPlanFormValues = {
                branchId: String(fd.get("branchId") ?? ""),
                planName: String(fd.get("planName") ?? ""),
                description: String(fd.get("description") ?? ""),
                price: Number(fd.get("price") ?? 0),
                credits: Number(fd.get("credits") ?? 0),
                validityDays: Number(fd.get("validityDays") ?? 30),
                isUnlimitedClasses: fd.get("isUnlimitedClasses") === "on",
                isPtIncluded: fd.get("isPtIncluded") === "on",
                ptSessions: Number(fd.get("ptSessions") ?? 0),
                isPopular: fd.get("isPopular") === "on",
                planCategory: String(fd.get("planCategory") ?? ""),
                registrationFee: Number(fd.get("registrationFee") ?? 0),
                allowMultiBranchAccess: fd.get("allowMultiBranchAccess") === "on",
                isActive: fd.get("isActive") === "on",
            };

            if (!payload.branchId.trim()) {
                setError("Branch is required");
                setSubmitting(false);
                return;
            }

            if (!payload.planName.trim()) {
                setError("Plan name is required");
                setSubmitting(false);
                return;
            }

            if (payload.credits < 0) {
                setError("Credits must be a positive number");
                setSubmitting(false);
                return;
            }

            if (payload.validityDays < 1) {
                setError("Validity days must be at least 1");
                setSubmitting(false);
                return;
            }

            try {
                await onSubmit(payload);
                onClose();
            } catch (err) {
                const msg = err instanceof Error ? err.message : "Failed to submit";
                setError(msg);
            } finally {
                setSubmitting(false);
            }
        },
        [onClose, onSubmit]
    );

    if (!isOpen) return null;

    return (
        <div
            id="modal-overlay"
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center backdrop-blur-sm"
            role="presentation"
            onClick={(ev) => {
                if (ev.target === ev.currentTarget) onClose();
            }}
        >
            <div
                className="bg-card w-full max-w-lg rounded-2xl border border-border shadow-2xl p-4 sm:p-6 max-h-[90vh] overflow-y-auto"
                id="modal-box"
                role="dialog"
                aria-labelledby="modal-title"
            >
                <div className="flex justify-between items-center mb-6">
                    <h3
                        className="text-xl font-bold font-display uppercase"
                        id="modal-title"
                    >
                        {isEdit ? "Edit Membership Plan" : "Create New Membership Plan"}
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-gray-400 hover:text-white text-xl"
                        aria-label="Close"
                    >
                        ×
                    </button>
                </div>
                <div id="modal-content">
                    <form onSubmit={handleSubmit}>
                        <div className="space-y-4">
                            {error && (
                                <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-200 text-sm rounded-lg">
                                    {error}
                                </div>
                            )}

                            <div>
                                <label className="block text-gray-400 text-sm mb-1">
                                    Branch <span className="text-red-400">*</span>
                                </label>
                                <select
                                    className="w-full bg-sidebar border border-border text-white px-4 py-3 rounded-lg focus:outline-none focus:border-sweat"
                                    name="branchId"
                                    defaultValue={initialValues?.branchId ?? ""}
                                    required
                                >
                                    <option value="">Select branch</option>
                                    {branches.map((branch) => (
                                        <option key={branch.id} value={branch.id}>
                                            {branch.branchName}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-gray-400 text-sm mb-1">
                                    Plan Name <span className="text-red-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    className="w-full bg-sidebar border border-border text-white px-4 py-3 rounded-lg focus:outline-none focus:border-sweat"
                                    placeholder="e.g. Basic Plan, Premium Plan"
                                    name="planName"
                                    defaultValue={initialValues?.planName ?? ""}
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-gray-400 text-sm mb-1">
                                    Description
                                </label>
                                <textarea
                                    className="w-full bg-sidebar border border-border text-white px-4 py-3 rounded-lg focus:outline-none focus:border-sweat resize-none"
                                    placeholder="Enter plan description (optional)"
                                    name="description"
                                    rows={3}
                                    defaultValue={initialValues?.description ?? ""}
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-gray-400 text-sm mb-1">
                                        Plan Category
                                    </label>
                                    <input
                                        type="text"
                                        className="w-full bg-sidebar border border-border text-white px-4 py-3 rounded-lg focus:outline-none focus:border-sweat"
                                        placeholder="e.g. Monthly, Annual"
                                        name="planCategory"
                                        defaultValue={initialValues?.planCategory ?? ""}
                                    />
                                </div>
                                <div>
                                    <label className="block text-gray-400 text-sm mb-1">
                                        Validity (Days) <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        className="w-full bg-sidebar border border-border text-white px-4 py-3 rounded-lg focus:outline-none focus:border-sweat"
                                        placeholder="30"
                                        name="validityDays"
                                        defaultValue={initialValues?.validityDays ?? 30}
                                        min={1}
                                        step={1}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-gray-400 text-sm mb-1">
                                        Price (Rp) <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        className="w-full bg-sidebar border border-border text-white px-4 py-3 rounded-lg focus:outline-none focus:border-sweat"
                                        placeholder="0"
                                        name="price"
                                        defaultValue={initialValues?.price ?? 0}
                                        min={0}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-gray-400 text-sm mb-1">
                                        Registration Fee (Rp)
                                    </label>
                                    <input
                                        type="number"
                                        className="w-full bg-sidebar border border-border text-white px-4 py-3 rounded-lg focus:outline-none focus:border-sweat"
                                        placeholder="0"
                                        name="registrationFee"
                                        defaultValue={initialValues?.registrationFee ?? 0}
                                        min={0}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-gray-400 text-sm mb-1">
                                        Credits
                                    </label>
                                    <input
                                        type="number"
                                        className="w-full bg-sidebar border border-border text-white px-4 py-3 rounded-lg focus:outline-none focus:border-sweat"
                                        placeholder="0"
                                        name="credits"
                                        defaultValue={initialValues?.credits ?? 10}
                                        min={0}
                                        step={1}
                                    />
                                </div>
                                <div>
                                    <label className="block text-gray-400 text-sm mb-1">
                                        PT Sessions
                                    </label>
                                    <input
                                        type="number"
                                        className="w-full bg-sidebar border border-border text-white px-4 py-3 rounded-lg focus:outline-none focus:border-sweat"
                                        placeholder="0"
                                        name="ptSessions"
                                        defaultValue={initialValues?.ptSessions ?? 0}
                                        min={0}
                                        step={1}
                                    />
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                    <input
                                        type="checkbox"
                                        id="isUnlimitedClasses"
                                        name="isUnlimitedClasses"
                                        defaultChecked={initialValues?.isUnlimitedClasses ?? false}
                                        className="w-4 h-4 rounded border border-border bg-sidebar cursor-pointer accent-sweat"
                                    />
                                    <label htmlFor="isUnlimitedClasses" className="text-gray-300 text-sm cursor-pointer">
                                        Unlimited Classes
                                    </label>
                                </div>

                                <div className="flex items-center gap-3">
                                    <input
                                        type="checkbox"
                                        id="isPtIncluded"
                                        name="isPtIncluded"
                                        defaultChecked={initialValues?.isPtIncluded ?? false}
                                        className="w-4 h-4 rounded border border-border bg-sidebar cursor-pointer accent-sweat"
                                    />
                                    <label htmlFor="isPtIncluded" className="text-gray-300 text-sm cursor-pointer">
                                        PT Sessions Included
                                    </label>
                                </div>

                                <div className="flex items-center gap-3">
                                    <input
                                        type="checkbox"
                                        id="isPopular"
                                        name="isPopular"
                                        defaultChecked={initialValues?.isPopular ?? false}
                                        className="w-4 h-4 rounded border border-border bg-sidebar cursor-pointer accent-sweat"
                                    />
                                    <label htmlFor="isPopular" className="text-gray-300 text-sm cursor-pointer">
                                        Mark as Popular Plan
                                    </label>
                                </div>

                                <div className="flex items-center gap-3">
                                    <input
                                        type="checkbox"
                                        id="allowMultiBranchAccess"
                                        name="allowMultiBranchAccess"
                                        defaultChecked={initialValues?.allowMultiBranchAccess ?? false}
                                        className="w-4 h-4 rounded border border-border bg-sidebar cursor-pointer accent-sweat"
                                    />
                                    <label htmlFor="allowMultiBranchAccess" className="text-gray-300 text-sm cursor-pointer">
                                        Allow Multi-Branch Access
                                    </label>
                                </div>

                                <div className="flex items-center gap-3">
                                    <input
                                        type="checkbox"
                                        id="isActive"
                                        name="isActive"
                                        defaultChecked={initialValues?.isActive ?? true}
                                        className="w-4 h-4 rounded border border-border bg-sidebar cursor-pointer accent-sweat"
                                    />
                                    <label htmlFor="isActive" className="text-gray-300 text-sm cursor-pointer">
                                        Active (visible to users)
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 flex gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 bg-sidebar border border-border text-gray-300 px-4 py-3 rounded-lg font-semibold hover:bg-sidebar/80 hover:text-white transition"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={submitting}
                                className="flex-1 bg-sweat text-black px-4 py-3 rounded-lg font-semibold hover:bg-yellow-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {submitting ? (
                                    <>
                                        <i className="fas fa-spinner fa-spin mr-2" aria-hidden />
                                        Saving...
                                    </>
                                ) : isEdit ? (
                                    <>
                                        <i className="fas fa-save mr-2" aria-hidden />
                                        Update Plan
                                    </>
                                ) : (
                                    <>
                                        <i className="fas fa-plus mr-2" aria-hidden />
                                        Create Plan
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
