import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'framer-motion';
import { Smartphone } from 'lucide-react';

export function NetworkQRCode() {
    const [ip, setIp] = useState<string | null>(null);
    const [isOpen, setIsOpen] = useState(true);

    useEffect(() => {
        fetch('/api/system/network')
            .then(res => res.json())
            .then(data => setIp(data.ip))
            .catch(err => console.error('Failed to get network IP', err));
    }, []);

    if (!ip) return null;

    const url = `http://${ip}:${window.location.port}`;

    return (
        <div className="px-4 mb-4">
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, height: 0, y: 10 }}
                        animate={{ opacity: 1, height: 'auto', y: 0 }}
                        exit={{ opacity: 0, height: 0, y: 10 }}
                        className="bg-zinc-900 border border-zinc-700 rounded-2xl p-4 mb-3 shadow-[0_4px_6px_rgba(0,0,0,0.3)] overflow-hidden"
                    >
                        <div className="flex flex-col items-center gap-3">
                            <div className="p-2 bg-white rounded-xl">
                                <QRCodeSVG value={url} size={120} />
                            </div>
                            <div className="text-center">
                                <p className="text-xs text-zinc-400 font-bold uppercase tracking-widest mb-1">Scan to Connect</p>
                                <p className="text-blue-400 font-mono text-xs">{url}</p>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl transition-all font-bold text-xs uppercase tracking-widest border ${isOpen
                    ? 'bg-zinc-800 text-white border-zinc-600'
                    : 'bg-zinc-900/50 text-zinc-500 border-zinc-800 hover:bg-zinc-800 hover:text-zinc-300'
                    }`}
            >
                <Smartphone size={16} />
                {isOpen ? 'Hide QR Code' : 'Remote Access'}
            </button>
        </div>
    );
}
