// components/projects/CreateProjectWizard.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  AlertCircle,
  Calendar,
  DollarSign,
  Users,
  FileText,
  Settings,
  Building2,
  FolderKanban,
  Briefcase,
  Target,
  Shield,
  Clock,
  GitBranch,
  Layers,
  ListTodo,
  X,
  Plus,
  Link,
} from "lucide-react";
import toast from "react-hot-toast";

interface CreateProjectWizardProps {
  userId: string;
  portfolios?: any[];
  departments?: any[];
  onClose?: () => void; // ← NEW
}

export function CreateProjectWizard({
  userId,
  portfolios = [],
  departments = [],
  onClose, // ← NEW
}: CreateProjectWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    // Step 1: Basic Information
    name: "",
    code: "",
    description: "",
    portfolioId: "",
    departmentId: "",
    projectType: "CAPITAL",

    // Step 2: Timeline & Scope
    startDate: "",
    endDate: "",
    phase: "INITIATING",
    scopeStatement: "",
    deliverables: [""],
    milestones: [""],

    // Step 3: Budget & Resources
    budget: "",
    currency: "USD",
    resourceRequirements: [""],

    // Step 4: Team & Governance
    teamMembers: [""],
    governanceModel: "",
    reportingFrequency: "MONTHLY",
    stakeholders: [""],

    // Step 5: Review
    reviewNotes: "",
    confirmAccuracy: false,
  });

  const steps = [
    { id: 1, label: "Basic Info", icon: FileText },
    { id: 2, label: "Timeline & Scope", icon: Calendar },
    { id: 3, label: "Budget & Resources", icon: DollarSign },
    { id: 4, label: "Team & Governance", icon: Users },
    { id: 5, label: "Review & Submit", icon: Settings },
  ];

  const projectTypes = [
    { value: "CAPITAL", label: "Capital Project" },
    { value: "OPERATIONAL", label: "Operational Project" },
    { value: "R&D", label: "Research & Development" },
    { value: "IT", label: "IT Project" },
    { value: "INFRASTRUCTURE", label: "Infrastructure" },
    { value: "MAINTENANCE", label: "Maintenance" },
  ];

  const projectPhases = [
    { value: "INITIATING", label: "Initiating" },
    { value: "PLANNING", label: "Planning" },
    { value: "EXECUTING", label: "Executing" },
    { value: "MONITORING", label: "Monitoring & Controlling" },
    { value: "CLOSING", label: "Closing" },
  ];

  const reportingFrequencies = [
    { value: "DAILY", label: "Daily" },
    { value: "WEEKLY", label: "Weekly" },
    { value: "BI_WEEKLY", label: "Bi-Weekly" },
    { value: "MONTHLY", label: "Monthly" },
    { value: "QUARTERLY", label: "Quarterly" },
  ];

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleArrayField = (field: string, index: number, value: string) => {
    setFormData((prev) => {
      const newArray = [...(prev[field as keyof typeof prev] as string[])];
      newArray[index] = value;
      return { ...prev, [field]: newArray };
    });
  };

  const handleAddArrayItem = (field: string) => {
    setFormData((prev) => {
      const newArray = [...(prev[field as keyof typeof prev] as string[]), ""];
      return { ...prev, [field]: newArray };
    });
  };

  const handleRemoveArrayItem = (field: string, index: number) => {
    setFormData((prev) => {
      const newArray = (prev[field as keyof typeof prev] as string[]).filter(
        (_, i) => i !== index,
      );
      return { ...prev, [field]: newArray };
    });
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        if (!formData.name) {
          setError("Project name is required");
          return false;
        }
        if (!formData.code) {
          setError("Project code is required");
          return false;
        }
        if (!formData.portfolioId) {
          setError("Please select a portfolio");
          return false;
        }
        break;
      case 2:
        if (!formData.startDate) {
          setError("Start date is required");
          return false;
        }
        if (!formData.endDate) {
          setError("End date is required");
          return false;
        }
        if (!formData.scopeStatement) {
          setError("Scope statement is required");
          return false;
        }
        break;
      case 3:
        if (!formData.budget || parseFloat(formData.budget) <= 0) {
          setError("Valid budget is required");
          return false;
        }
        break;
      case 4:
        if (!formData.governanceModel) {
          setError("Governance model is required");
          return false;
        }
        break;
      case 5:
        if (!formData.confirmAccuracy) {
          setError("Please confirm accuracy of information");
          return false;
        }
        break;
    }
    setError(null);
    return true;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    setStep(step - 1);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateStep(5)) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          managerId: userId,
          budget: parseFloat(formData.budget) || 0,
          deliverables: formData.deliverables.filter((d) => d.trim()),
          milestones: formData.milestones.filter((m) => m.trim()),
          resourceRequirements: formData.resourceRequirements.filter((r) =>
            r.trim(),
          ),
          teamMembers: formData.teamMembers.filter((t) => t.trim()),
          stakeholders: formData.stakeholders.filter((s) => s.trim()),
          status: "INITIATING",
          phase: formData.phase || "INITIATING",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create project");
      }

      toast.success("Project created successfully!");
      onClose?.();
      router.push(`/projects/${data.data.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      toast.error("Failed to create project");
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-eih-ink mb-1">
                  Project Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  className="w-full px-4 py-2 border border-border rounded-xl bg-card text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-eih-gold"
                  placeholder="Enter project name"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-eih-ink mb-1">
                  Project Code *
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) =>
                    handleChange("code", e.target.value.toUpperCase())
                  }
                  className="w-full px-4 py-2 border border-border rounded-xl bg-card text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-eih-gold"
                  placeholder="e.g., PRJ-001"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-eih-ink mb-1">
                Portfolio *
              </label>
              <select
                value={formData.portfolioId}
                onChange={(e) => handleChange("portfolioId", e.target.value)}
                className="w-full px-4 py-2 border border-border rounded-xl bg-card text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-eih-gold"
                required
              >
                <option value="">Select Portfolio</option>
                {portfolios.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-eih-ink mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleChange("description", e.target.value)}
                className="w-full px-4 py-2 border border-border rounded-xl bg-card text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-eih-gold"
                rows={3}
                placeholder="Brief description of the project"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-eih-ink mb-1">
                  Department
                </label>
                <select
                  value={formData.departmentId}
                  onChange={(e) => handleChange("departmentId", e.target.value)}
                  className="w-full px-4 py-2 border border-border rounded-xl bg-card text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-eih-gold"
                >
                  <option value="">Select Department</option>
                  {departments.map((d: any) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-eih-ink mb-1">
                  Project Type
                </label>
                <select
                  value={formData.projectType}
                  onChange={(e) => handleChange("projectType", e.target.value)}
                  className="w-full px-4 py-2 border border-border rounded-xl bg-card text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-eih-gold"
                >
                  {projectTypes.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-eih-ink mb-1">
                  Start Date *
                </label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => handleChange("startDate", e.target.value)}
                  className="w-full px-4 py-2 border border-border rounded-xl bg-card text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-eih-gold"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-eih-ink mb-1">
                  End Date *
                </label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => handleChange("endDate", e.target.value)}
                  className="w-full px-4 py-2 border border-border rounded-xl bg-card text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-eih-gold"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-eih-ink mb-1">
                Phase
              </label>
              <select
                value={formData.phase}
                onChange={(e) => handleChange("phase", e.target.value)}
                className="w-full px-4 py-2 border border-border rounded-xl bg-card text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-eih-gold"
              >
                {projectPhases.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-eih-ink mb-1">
                Scope Statement *
              </label>
              <textarea
                value={formData.scopeStatement}
                onChange={(e) => handleChange("scopeStatement", e.target.value)}
                className="w-full px-4 py-2 border border-border rounded-xl bg-card text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-eih-gold"
                rows={3}
                placeholder="Describe the project scope"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-eih-ink mb-1">
                Deliverables
              </label>
              {formData.deliverables.map((deliverable, index) => (
                <div key={index} className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={deliverable}
                    onChange={(e) =>
                      handleArrayField("deliverables", index, e.target.value)
                    }
                    className="flex-1 px-4 py-2 border border-border rounded-xl bg-card text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-eih-gold"
                    placeholder={`Deliverable ${index + 1}`}
                  />
                  {formData.deliverables.length > 1 && (
                    <button
                      type="button"
                      aria-label={`Remove deliverable ${index + 1}`}
                      onClick={() =>
                        handleRemoveArrayItem("deliverables", index)
                      }
                      className="p-2 text-eih-danger hover:bg-eih-danger-soft rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => handleAddArrayItem("deliverables")}
                className="text-sm text-eih-green hover:text-eih-green-light flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                Add Deliverable
              </button>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-eih-ink mb-1">
                Total Budget *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-eih-muted">
                  $
                </span>
                <input
                  type="number"
                  value={formData.budget}
                  onChange={(e) => handleChange("budget", e.target.value)}
                  className="w-full pl-8 pr-4 py-2 border border-border rounded-xl bg-card text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-eih-gold"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-eih-ink mb-1">
                Currency
              </label>
              <select
                value={formData.currency}
                onChange={(e) => handleChange("currency", e.target.value)}
                className="w-full px-4 py-2 border border-border rounded-xl bg-card text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-eih-gold"
              >
                <option value="USD">USD - US Dollar</option>
                <option value="EUR">EUR - Euro</option>
                <option value="GBP">GBP - British Pound</option>
                <option value="JPY">JPY - Japanese Yen</option>
                <option value="CAD">CAD - Canadian Dollar</option>
                <option value="AUD">AUD - Australian Dollar</option>
                <option value="CHF">CHF - Swiss Franc</option>
                <option value="CNY">CNY - Chinese Yuan</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-eih-ink mb-1">
                Resource Requirements
              </label>
              {formData.resourceRequirements.map((resource, index) => (
                <div key={index} className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={resource}
                    onChange={(e) =>
                      handleArrayField(
                        "resourceRequirements",
                        index,
                        e.target.value,
                      )
                    }
                    className="flex-1 px-4 py-2 border border-border rounded-xl bg-card text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-eih-gold"
                    placeholder={`Resource ${index + 1}`}
                  />
                  {formData.resourceRequirements.length > 1 && (
                    <button
                      type="button"
                      aria-label={`Remove resource ${index + 1}`}
                      onClick={() =>
                        handleRemoveArrayItem("resourceRequirements", index)
                      }
                      className="p-2 text-eih-danger hover:bg-eih-danger-soft rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => handleAddArrayItem("resourceRequirements")}
                className="text-sm text-eih-green hover:text-eih-green-light flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                Add Resource
              </button>
            </div>

            <div className="rounded-xl border border-eih-line bg-eih-cream-soft p-4">
              <p className="text-sm text-eih-ink">
                💡 Budget will be used for EVM calculations and financial
                tracking
              </p>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-eih-ink mb-1">
                Project Manager
              </label>
              <div className="flex items-center gap-3 p-3 bg-eih-cream-soft/55 rounded-lg">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-eih-green/10">
                  <Users className="w-5 h-5 text-eih-green" />
                </div>
                <div>
                  <div className="font-medium">You (Project Manager)</div>
                  <div className="text-sm text-eih-muted">ID: {userId}</div>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-eih-ink mb-1">
                Team Members
              </label>
              {formData.teamMembers.map((member, index) => (
                <div key={index} className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={member}
                    onChange={(e) =>
                      handleArrayField("teamMembers", index, e.target.value)
                    }
                    className="flex-1 px-4 py-2 border border-border rounded-xl bg-card text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-eih-gold"
                    placeholder={`Team Member ${index + 1}`}
                  />
                  {formData.teamMembers.length > 1 && (
                    <button
                      type="button"
                      aria-label={`Remove team member ${index + 1}`}
                      onClick={() =>
                        handleRemoveArrayItem("teamMembers", index)
                      }
                      className="p-2 text-eih-danger hover:bg-eih-danger-soft rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => handleAddArrayItem("teamMembers")}
                className="text-sm text-eih-green hover:text-eih-green-light flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                Add Team Member
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-eih-ink mb-1">
                Governance Model *
              </label>
              <select
                value={formData.governanceModel}
                onChange={(e) =>
                  handleChange("governanceModel", e.target.value)
                }
                className="w-full px-4 py-2 border border-border rounded-xl bg-card text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-eih-gold"
                required
              >
                <option value="">Select Governance Model</option>
                <option value="STEERING_COMMITTEE">Steering Committee</option>
                <option value="BOARD_OVERSIGHT">Board Oversight</option>
                <option value="PMO_GOVERNED">PMO Governed</option>
                <option value="EXECUTIVE_SPONSOR">Executive Sponsor</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-eih-ink mb-1">
                Reporting Frequency
              </label>
              <select
                value={formData.reportingFrequency}
                onChange={(e) =>
                  handleChange("reportingFrequency", e.target.value)
                }
                className="w-full px-4 py-2 border border-border rounded-xl bg-card text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-eih-gold"
              >
                {reportingFrequencies.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-eih-ink mb-1">
                Key Stakeholders
              </label>
              {formData.stakeholders.map((stakeholder, index) => (
                <div key={index} className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={stakeholder}
                    onChange={(e) =>
                      handleArrayField("stakeholders", index, e.target.value)
                    }
                    className="flex-1 px-4 py-2 border border-border rounded-xl bg-card text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-eih-gold"
                    placeholder={`Stakeholder ${index + 1}`}
                  />
                  {formData.stakeholders.length > 1 && (
                    <button
                      type="button"
                      aria-label={`Remove stakeholder ${index + 1}`}
                      onClick={() =>
                        handleRemoveArrayItem("stakeholders", index)
                      }
                      className="p-2 text-eih-danger hover:bg-eih-danger-soft rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => handleAddArrayItem("stakeholders")}
                className="text-sm text-eih-green hover:text-eih-green-light flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                Add Stakeholder
              </button>
            </div>

            <div className="rounded-xl border border-eih-warn-ink/20 bg-eih-warn-soft p-4">
              <p className="text-sm text-eih-warn-ink">
                ⚡ Team members and stakeholders can be modified after project
                creation
              </p>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Review Project Details</h3>

            <div className="bg-eih-cream-soft/55 rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <span className="text-sm text-eih-muted">Project Name</span>
                  <div className="font-medium">
                    {formData.name || "Not set"}
                  </div>
                </div>
                <div>
                  <span className="text-sm text-eih-muted">Project Code</span>
                  <div className="font-medium">
                    {formData.code || "Not set"}
                  </div>
                </div>
                <div>
                  <span className="text-sm text-eih-muted">Portfolio</span>
                  <div className="font-medium">
                    {portfolios.find((p) => p.id === formData.portfolioId)
                      ?.name || "Not set"}
                  </div>
                </div>
                <div>
                  <span className="text-sm text-eih-muted">Type</span>
                  <div className="font-medium">
                    {formData.projectType || "Not set"}
                  </div>
                </div>
                <div>
                  <span className="text-sm text-eih-muted">Timeline</span>
                  <div className="font-medium">
                    {formData.startDate
                      ? new Date(formData.startDate).toLocaleDateString()
                      : "Not set"}{" "}
                    -
                    {formData.endDate
                      ? new Date(formData.endDate).toLocaleDateString()
                      : "Not set"}
                  </div>
                </div>
                <div>
                  <span className="text-sm text-eih-muted">Budget</span>
                  <div className="font-medium">
                    {formData.currency || "USD"} $
                    {parseFloat(formData.budget || "0").toLocaleString()}
                  </div>
                </div>
                <div className="col-span-2">
                  <span className="text-sm text-eih-muted">
                    Scope Statement
                  </span>
                  <div className="font-medium">
                    {formData.scopeStatement || "Not set"}
                  </div>
                </div>
                <div>
                  <span className="text-sm text-eih-muted">
                    Governance Model
                  </span>
                  <div className="font-medium">
                    {formData.governanceModel || "Not set"}
                  </div>
                </div>
                <div>
                  <span className="text-sm text-eih-muted">
                    Reporting Frequency
                  </span>
                  <div className="font-medium">
                    {formData.reportingFrequency || "Not set"}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.confirmAccuracy}
                onChange={(e) =>
                  handleChange("confirmAccuracy", e.target.checked)
                }
                className="w-4 h-4 rounded border-border text-eih-green focus:ring-eih-gold"
              />
              <label className="text-sm text-eih-ink">
                I confirm that all information provided is accurate and complete
              </label>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="eih-section overflow-hidden">
      {/* Progress Steps */}
      <div className="border-b border-border bg-eih-cream-soft/45 px-5 py-5 sm:px-7">
        <div className="flex items-center justify-between gap-4">
          <div className="mr-2 sm:hidden">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-eih-gold">
              Step {step} of {steps.length}
            </p>
            <p className="mt-1 text-sm font-semibold text-eih-ink">
              {steps[step - 1]?.label}
            </p>
          </div>
          {steps.map((s, index) => (
            <div key={s.id} className="flex items-center">
              <div className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    step >= s.id
                      ? "bg-eih-green text-white shadow-sm ring-4 ring-eih-green/10"
                      : "bg-eih-cream-deep text-eih-muted"
                  }`}
                >
                  {step > s.id ? <Check className="w-4 h-4" /> : s.id}
                </div>
                <span
                  className={`text-sm hidden sm:inline ${
                    step >= s.id ? "text-eih-ink font-medium" : "text-eih-muted"
                  }`}
                >
                  {s.label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`w-12 h-0.5 mx-2 hidden sm:block ${
                    step > s.id ? "bg-eih-gold" : "bg-eih-cream-deep"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="p-5 sm:p-7">
        {error && (
          <div
            role="alert"
            className="mb-5 flex items-start gap-3 rounded-xl border border-eih-danger/30 bg-eih-danger-soft p-3 text-sm text-eih-danger-ink"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{error}</p>
          </div>
        )}
        {renderStep()}

        {/* Navigation Buttons */}
        <div className="mt-7 flex justify-between gap-3 border-t border-border pt-5">
          <button
            type="button"
            onClick={handleBack}
            className={`eih-btn eih-btn-outline min-h-11 px-4 ${
              step === 1 ? "invisible" : ""
            }`}
          >
            <ArrowLeft className="w-4 h-4 inline mr-2" />
            Back
          </button>
          {step < 5 ? (
            <button
              type="button"
              onClick={handleNext}
              className="eih-btn eih-btn-primary min-h-11 px-5"
            >
              Next
              <ArrowRight className="w-4 h-4 inline ml-2" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={loading}
              className="eih-btn min-h-11 bg-eih-success px-5 text-white transition-colors hover:bg-eih-success/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create Project"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
