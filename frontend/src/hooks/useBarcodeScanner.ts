import { useEffect, useRef } from 'react';

/**
 * Hook to listen for barcode scanner inputs globally.
 * Most USB/Bluetooth scanners act like a fast keyboard hitting 'Enter' at the end.
 */
export function useBarcodeScanner(onScan: (barcode: string) => void) {
    const buffer = useRef('');
    const lastKeyTime = useRef(Date.now());

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore input if user is actively typing in a form field
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return;
            }

            const currentTime = Date.now();

            // If the time between keystrokes is too long (e.g > 50ms), it's likely human typing. Reset.
            if (currentTime - lastKeyTime.current > 50) {
                buffer.current = '';
            }

            lastKeyTime.current = currentTime;

            if (e.key === 'Enter') {
                if (buffer.current.length > 3) {
                    onScan(buffer.current);
                }
                buffer.current = '';
                return;
            }

            // Only capture printable characters
            if (e.key.length === 1) {
                buffer.current += e.key;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onScan]);
}
