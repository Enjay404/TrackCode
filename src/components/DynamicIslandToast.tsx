import { AnimatePresence, motion } from 'motion/react';
import { AlertCircle, Check } from 'lucide-react';
import { memo } from 'react';

export interface ToastState {
  id: number;
  message: string;
  tone: 'success' | 'info';
}

interface DynamicIslandToastProps {
  toast: ToastState | null;
}

export const DynamicIslandToast = memo(function DynamicIslandToast({
  toast,
}: DynamicIslandToastProps) {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-4"
      style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
      aria-live="polite"
      aria-atomic="true"
    >
      <AnimatePresence mode="wait">
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -48, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -48, scale: 0.92 }}
            transition={{
              duration: 0.28,
              ease: [0.22, 1, 0.36, 1],
            }}
            style={{
              willChange: 'transform, opacity',
              contain: 'layout style paint',
            }}
            className="pointer-events-auto flex max-w-[360px] items-center gap-2.5 rounded-full border border-white/15 bg-[#1C1C1E]/95 px-4 py-2.5 shadow-[0_12px_32px_rgba(0,0,0,0.65)]"
          >
            {toast.tone === 'success' ? (
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#30D158]/20 text-[#30D158]">
                <Check className="h-3.5 w-3.5 stroke-[2.75]" />
              </span>
            ) : (
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#FF9F0A]/20 text-[#FF9F0A]">
                <AlertCircle className="h-3.5 w-3.5 stroke-[2.25]" />
              </span>
            )}
            <span className="truncate text-[13px] font-medium tracking-[-0.01em] text-white">
              {toast.message}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
