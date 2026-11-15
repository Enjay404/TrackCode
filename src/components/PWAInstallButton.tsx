import { motion } from 'motion/react';
import { Download } from 'lucide-react';
import { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { SPRING_BUTTON } from '../utils/motionConfig';
import { AddToHomeModal } from './AddToHomeModal';

export function PWAInstallButton() {
  const { isInstallable, isInstalled, isIOS, isIOSInApp, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <motion.button
        type="button"
        onClick={() => void install()}
        whileTap={{ scale: 0.97 }}
        transition={SPRING_BUTTON}
        className="liquid-glass flex min-h-[44px] shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-[13px] font-medium text-white active:bg-white/[0.12]"
      >
        <Download className="h-3.5 w-3.5 text-[#30D158]" />
        <span>Install</span>
      </motion.button>
    );
  }

  if (isIOS) {
    return (
      <>
        <motion.button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          whileTap={{ scale: 0.97 }}
          transition={SPRING_BUTTON}
          className="liquid-glass flex min-h-[44px] shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-[13px] font-medium text-white active:bg-white/[0.12]"
        >
          <Download className="h-3.5 w-3.5 text-[#30D158]" />
          <span>Add App</span>
        </motion.button>

        <AddToHomeModal
          isOpen={showIOSGuide}
          isIOSInApp={isIOSInApp}
          onClose={() => setShowIOSGuide(false)}
        />
      </>
    );
  }

  return null;
}
