'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, TrendingUp } from 'lucide-react';

export default function TokenChart({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[1000] flex items-center justify-center pointer-events-auto px-4"
          onClick={onClose}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* Modal */}
          <div
            className="relative w-full max-w-4xl bg-[#0A0A0A] border border-[var(--border-primary)] shadow-2xl flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-primary)] bg-black/40">
              <div className="flex items-center gap-3">
                <TrendingUp className="w-4 h-4 text-[#14F195]" />
                <h2 className="text-xs font-mono font-bold text-white tracking-widest uppercase">$TAKIP LIVE CHART</h2>
              </div>
              <button
                onClick={onClose}
                className="p-1 hover:bg-white/10 rounded transition-colors"
              >
                <X className="w-4 h-4 text-[var(--text-muted)] hover:text-white" />
              </button>
            </div>

            {/* Chart Body */}
            <div className="p-1 relative w-full" style={{ height: '70vh', minHeight: '500px' }}>
              <iframe
                src="https://dexscreener.com/solana/G3rchnZ2WLsBDZSrVME4fTyzFP57F3yvvqWMxAy2b4ce?embed=1&loadChartSettings=0&chartLeftToolbar=0&chartTheme=dark&theme=dark&chartStyle=0&chartType=usd&interval=15"
                className="absolute inset-0 w-full h-full border-0"
                allow="clipboard-write"
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
