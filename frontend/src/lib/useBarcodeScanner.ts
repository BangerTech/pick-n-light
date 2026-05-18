import { useRef, useState, useCallback } from 'react';

// BarcodeDetector ist experimentell – manuelle Typdefinition
declare class BarcodeDetector {
  constructor(options?: { formats?: string[] });
  detect(source: HTMLVideoElement | HTMLImageElement | ImageBitmap): Promise<Array<{ rawValue: string; format: string }>>;
  static getSupportedFormats(): Promise<string[]>;
}

type ScanResult = string;

interface UseBarcodeScanner {
  isScanning: boolean;
  error: string | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  startScan: () => Promise<void>;
  stopScan: () => void;
}

export function useBarcodeScanner(onResult: (result: ScanResult) => void): UseBarcodeScanner {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const stoppedRef = useRef(false);

  const stopScan = useCallback(() => {
    stoppedRef.current = true;
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setIsScanning(false);
  }, []);

  const startScan = useCallback(async () => {
    stoppedRef.current = false;
    setError(null);
    setIsScanning(true);

    // BarcodeDetector API nativ (Chrome/Edge/Android)
    if ('BarcodeDetector' in window) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const detector = new BarcodeDetector({
          formats: ['qr_code', 'ean_13', 'ean_8', 'code_128', 'code_39', 'data_matrix'],
        });

        const detect = async () => {
          if (stoppedRef.current || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes.length > 0) {
              onResult(codes[0].rawValue);
              stopScan();
              return;
            }
          } catch {
            // Einzelne Frame-Fehler ignorieren
          }
          animFrameRef.current = requestAnimationFrame(detect);
        };
        animFrameRef.current = requestAnimationFrame(detect);
      } catch (err) {
        setError(
          err instanceof DOMException && err.name === 'NotAllowedError'
            ? 'Kamera-Zugriff verweigert. Bitte Berechtigung in den Browser-Einstellungen erlauben.'
            : 'Kamera konnte nicht gestartet werden.'
        );
        setIsScanning(false);
      }
    } else {
      // Fallback: ZXing (Firefox / ältere Browser)
      try {
        const { BrowserQRCodeReader } = await import('@zxing/browser');
        const reader = new BrowserQRCodeReader();

        if (!videoRef.current) { setIsScanning(false); return; }

        await reader.decodeFromConstraints(
          { video: { facingMode: 'environment' } },
          videoRef.current,
          (result, _err, controls) => {
            if (result && !stoppedRef.current) {
              controls.stop();
              onResult(result.getText());
              stopScan();
            }
          }
        );
      } catch (err) {
        setError(
          err instanceof DOMException && err.name === 'NotAllowedError'
            ? 'Kamera-Zugriff verweigert.'
            : 'Kamera konnte nicht gestartet werden.'
        );
        setIsScanning(false);
      }
    }
  }, [onResult, stopScan]);

  return { isScanning, error, videoRef, startScan, stopScan };
}
