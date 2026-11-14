import { motion } from 'motion/react';
import { ClipboardPaste, RotateCcw } from 'lucide-react';
import { memo } from 'react';
import { SPRING_BUTTON } from '../utils/motionConfig';

interface EmptySearchViewProps {
  query: string;
  onClearSearch: () => void;
  onPasteLink: () => void;
}

export const EmptySearchView = memo(function EmptySearchView({
  query,
  onClearSearch,
  onPasteLink,
}: EmptySearchViewProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="liquid-glass relative overflow-hidden rounded-[20px] px-5 py-8 text-center"
    >
      {/* Subtle ambient emerald aura behind illustration */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-4 left-1/2 h-28 w-28 -translate-x-1/2 rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(48, 209, 88, 0.14) 0%, rgba(58, 75, 115, 0.08) 52%, transparent 75%)',
        }}
      />

      {/* Animated Vinyl & Search Lens SVG Illustration */}
      <div className="relative mx-auto flex h-[88px] w-[88px] items-center justify-center">
        <svg
          width="88"
          height="88"
          viewBox="0 0 88 88"
          fill="none"
          aria-hidden="true"
          className="overflow-visible"
        >
          {/* Expanding subtle sonar pulse ring */}
          <motion.circle
            cx="41"
            cy="42"
            r="26"
            stroke="#30D158"
            strokeWidth="1.25"
            initial={{ scale: 0.85, opacity: 0.45 }}
            animate={{ scale: [0.85, 1.32], opacity: [0.45, 0] }}
            transition={{
              duration: 2.6,
              repeat: Infinity,
              ease: 'easeOut',
            }}
            style={{ transformOrigin: '41px 42px' }}
          />

          {/* Gently floating vinyl disc */}
          <motion.g
            animate={{ y: [-2, 2, -2] }}
            transition={{
              duration: 3.8,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            <circle
              cx="41"
              cy="42"
              r="26"
              fill="rgba(255, 255, 255, 0.04)"
              stroke="rgba(255, 255, 255, 0.16)"
              strokeWidth="1.25"
            />
            <circle
              cx="41"
              cy="42"
              r="19"
              stroke="rgba(255, 255, 255, 0.09)"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
            <circle
              cx="41"
              cy="42"
              r="12"
              stroke="rgba(255, 255, 255, 0.09)"
              strokeWidth="1"
            />
            {/* Center label + spindle */}
            <circle
              cx="41"
              cy="42"
              r="7.5"
              fill="rgba(48, 209, 88, 0.18)"
              stroke="rgba(48, 209, 88, 0.48)"
              strokeWidth="1.2"
            />
            <circle cx="41" cy="42" r="2.2" fill="#000000" />
          </motion.g>

          {/* Animated scanning magnifying lens */}
          <motion.g
            animate={{ rotate: [-6, 5, -6], x: [-1, 1.5, -1], y: [0, -1.5, 0] }}
            transition={{
              duration: 4.2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            style={{ transformOrigin: '57px 57px' }}
          >
            <circle
              cx="57"
              cy="57"
              r="11.5"
              fill="rgba(28, 28, 30, 0.9)"
              stroke="rgba(255, 255, 255, 0.88)"
              strokeWidth="2"
            />
            {/* Subtle specular reflection arc inside lens */}
            <path
              d="M51.5 53.5a7.2 7.2 0 0 1 6.2-3"
              stroke="#30D158"
              strokeWidth="1.75"
              strokeLinecap="round"
            />
            {/* Handle */}
            <path
              d="M65.5 65.5L73.5 73.5"
              stroke="rgba(255, 255, 255, 0.88)"
              strokeWidth="2.8"
              strokeLinecap="round"
            />
          </motion.g>
        </svg>
      </div>

      <h3 className="mt-3 text-[16px] font-semibold tracking-[-0.01em] text-white">
        No matching tracks
      </h3>
      <p className="mx-auto mt-1.5 max-w-[300px] text-[13px] leading-relaxed text-[#8E8E93]">
        Nothing turned up for{' '}
        <span className="font-medium text-[#D1D1D6]">
          &ldquo;{query.length > 36 ? `${query.slice(0, 36)}…` : query}&rdquo;
        </span>
        . Try adding the artist name or pasting a Spotify link.
      </p>

      <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
        <motion.button
          type="button"
          onClick={onClearSearch}
          whileTap={{ scale: 0.97 }}
          transition={SPRING_BUTTON}
          className="inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-4 text-[13px] font-semibold text-white transition-colors hover:bg-white/[0.14] active:bg-white/20"
        >
          <RotateCcw className="h-3.5 w-3.5 text-[#AEAEB2]" />
          <span>Try another query</span>
        </motion.button>

        <motion.button
          type="button"
          onClick={onPasteLink}
          whileTap={{ scale: 0.97 }}
          transition={SPRING_BUTTON}
          className="inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-full border border-[#30D158]/25 bg-[#30D158]/10 px-4 text-[13px] font-semibold text-[#30D158] transition-colors hover:bg-[#30D158]/15 active:bg-[#30D158]/25"
        >
          <ClipboardPaste className="h-3.5 w-3.5" />
          <span>Paste link</span>
        </motion.button>
      </div>
    </motion.div>
  );
});

export default EmptySearchView;
