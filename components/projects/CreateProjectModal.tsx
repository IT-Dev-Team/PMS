// components/projects/CreateProjectModal.tsx
"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { CreateProjectWizard } from "./CreateProjectWizard";

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

export function CreateProjectModal({
  isOpen,
  onClose,
  userId,
}: CreateProjectModalProps) {
  const [portfolios, setPortfolios] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);

  // Fetch wizard data lazily the first time the modal opens
  useEffect(() => {
    if (!isOpen || loadedOnce) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const [pRes, dRes] = await Promise.all([
          fetch("/api/portfolios?active=true"),
          fetch("/api/departments"),
        ]);
        const pJson = await pRes.json().catch(() => []);
        const dJson = await dRes.json().catch(() => []);
        if (cancelled) return;
        setPortfolios(pJson.data ?? pJson ?? []);
        setDepartments(dJson.data ?? dJson ?? []);
        setLoadedOnce(true);
      } catch (err) {
        console.error("Failed to load wizard data", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, loadedOnce]);

  // Body scroll lock + Escape-to-close
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-project-dialog-title"
        aria-describedby="create-project-dialog-description"
        className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl"
      >
        {/* Modal header */}
        <div className="flex items-center justify-between border-b border-border bg-eih-cream-soft/70 px-5 py-4 sm:px-6">
          <div>
            <h2
              id="create-project-dialog-title"
              className="font-serif text-lg font-semibold text-eih-ink"
            >
              Create New Project
            </h2>
            <p
              id="create-project-dialog-description"
              className="text-sm text-eih-muted"
            >
              Follow the steps below to set up your project
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-eih-muted transition hover:bg-eih-cream hover:text-eih-ink"
            aria-label="Close"
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto bg-background/30">
          {loading ? (
            <div className="flex h-64 items-center justify-center text-eih-muted">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-eih-gold border-t-transparent" />
            </div>
          ) : (
            <CreateProjectWizard
              userId={userId}
              portfolios={portfolios}
              departments={departments}
              onClose={onClose}
            />
          )}
        </div>
      </div>
    </div>
  );
}
