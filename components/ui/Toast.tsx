"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { CheckCircle, XCircle, Info, AlertTriangle, X } from "lucide-react";

type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const TOAST_ICONS: Record<ToastType, ReactNode> = {
  success: <CheckCircle size={18} className="text-[#22C55E] shrink-0" />,
  error: <XCircle size={18} className="text-[#EF4444] shrink-0" />,
  info: <Info size={18} className="text-[#3B82F6] shrink-0" />,
  warning: <AlertTriangle size={18} className="text-[#EAB308] shrink-0" />,
};

const TOAST_BORDER: Record<ToastType, string> = {
  success: "border-[#22C55E]/30",
  error: "border-[#EF4444]/30",
  info: "border-[#3B82F6]/30",
  warning: "border-[#EAB308]/30",
};

function ToastItem({
  toast,
  onClose,
}: {
  toast: Toast;
  onClose: (id: string) => void;
}) {
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${TOAST_BORDER[toast.type]} animate-slide-up`}
      style={{
        background: "rgba(30, 41, 59, 0.97)",
        backdropFilter: "blur(12px)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
        minWidth: "280px",
        maxWidth: "calc(100vw - 2rem)",
      }}
      role="alert"
    >
      {TOAST_ICONS[toast.type]}
      <span className="text-[#F1F5F9] text-sm font-medium flex-1">
        {toast.message}
      </span>
      <button
        onClick={() => onClose(toast.id)}
        className="text-[#64748B] hover:text-[#F1F5F9] transition-colors min-h-[28px] min-w-[28px] flex items-center justify-center"
        aria-label="Fechar notificação"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, type }]);

    // Auto-dismiss after 4s
    setTimeout(() => {
      removeToast(id);
    }, 4000);
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Toast container */}
      {toasts.length > 0 && (
        <div
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2"
          style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
          {toasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onClose={removeToast} />
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextType {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

/**
 * Standalone Toast component (used without context when needed)
 */
export default function Toast() {
  return null; // Fully managed by ToastProvider context
}
