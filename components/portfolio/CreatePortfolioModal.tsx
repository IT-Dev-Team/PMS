// components/portfolio/CreatePortfolioModal.tsx
'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { PortfolioRegistration } from './PortfolioRegistration';

interface CreatePortfolioModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

export function CreatePortfolioModal({
  isOpen,
  onClose,
  userId,
}: CreatePortfolioModalProps) {
  // Body scroll lock + Escape-to-close
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
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
        aria-label="Register new portfolio"
        className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        {/* Modal header */}
        <div className="flex items-center justify-between border-b border-gray-200 bg-[#FAF7F2] px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Register New Portfolio
            </h2>
            <p className="text-sm text-gray-500">
              Follow the steps below to register a new portfolio or program
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-200"
            aria-label="Close"
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          <PortfolioRegistration userId={userId} onClose={onClose} />
        </div>
      </div>
    </div>
  );
}