import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ScanLine, AlertTriangle } from 'lucide-react';
import { useBarcodeScanner } from '@/lib/useBarcodeScanner';

interface BarcodeScannerModalProps {
  onResult: (value: string) => void;
  onClose: () => void;
}

export default function BarcodeScannerModal({ onResult, onClose }: BarcodeScannerModalProps) {
  const handleResult = (value: string) => {
    onResult(value);
    onClose();
  };

  const { isScanning, error, videoRef, startScan, stopScan } = useBarcodeScanner(handleResult);

  useEffect(() => {
    startScan();
    return () => stopScan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="w-full max-w-sm rounded-2xl overflow-hidden"
          style={{
            background: '#0d1117',
            border: '1px solid rgba(99,102,241,0.3)',
            boxShadow: '0 32px 80px rgba(0,0,0,0.8)',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div className="flex items-center gap-2">
              <ScanLine className="w-4 h-4 text-accent-light" />
              <span className="text-sm font-semibold text-white">Barcode / QR scannen</span>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/10 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Video */}
          <div className="relative aspect-square bg-black overflow-hidden">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
            />

            {/* Scan-Overlay */}
            {isScanning && (
              <>
                {/* Ecken */}
                <div className="absolute inset-8 pointer-events-none">
                  <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-accent rounded-tl" />
                  <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-accent rounded-tr" />
                  <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-accent rounded-bl" />
                  <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-accent rounded-br" />
                </div>
                {/* Scan-Linie */}
                <motion.div
                  className="absolute left-8 right-8 h-0.5"
                  style={{ background: 'linear-gradient(90deg, transparent, #6366f1, transparent)' }}
                  animate={{ top: ['2rem', 'calc(100% - 2rem)', '2rem'] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                />
              </>
            )}

            {error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center">
                <AlertTriangle className="w-8 h-8 text-red-400" />
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}
          </div>

          <div className="px-4 py-3 text-center">
            <p className="text-xs text-slate-500">
              Halte einen QR-Code, EAN oder Barcode in die Kamera
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
