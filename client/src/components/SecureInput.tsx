import { useState } from 'react';
import { Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

interface SecureInputProps {
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
    label?: string;
    className?: string;
    warningMessage?: string;
    onBlur?: () => void;
}

export function SecureInput({
    value,
    onChange,
    placeholder,
    label,
    className,
    warningMessage = "You are about to reveal sensitive information. If you are streaming, your viewers will see this value.",
    onBlur
}: SecureInputProps) {
    const [isVisible, setIsVisible] = useState(false);
    const [showWarning, setShowWarning] = useState(false);

    const toggleVisibility = () => {
        if (isVisible) {
            setIsVisible(false);
        } else {
            setShowWarning(true);
        }
    };

    const confirmReveal = () => {
        setShowWarning(false);
        setIsVisible(true);
    };

    return (
        <div className={twMerge("flex flex-col gap-1 relative", className)}>
            {label && <label className="text-zinc-400 text-sm font-medium">{label}</label>}

            <div className="relative">
                <input
                    type={isVisible ? "text" : "password"}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    onBlur={onBlur}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-zinc-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors pr-10"
                />

                <button
                    type="button"
                    onClick={toggleVisibility}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                    {isVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
            </div>

            {/* Warning Modal/Overlay */}
            {showWarning && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-zinc-900 border border-red-500/50 rounded-2xl p-6 max-w-sm w-full shadow-2xl shadow-red-900/20">
                        <div className="flex flex-col items-center text-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-500">
                                <AlertTriangle size={24} />
                            </div>

                            <h3 className="text-xl font-bold text-white">Streamer Warning</h3>

                            <p className="text-zinc-400 text-sm">
                                {warningMessage}
                            </p>

                            <div className="flex gap-3 w-full mt-4">
                                <button
                                    onClick={() => setShowWarning(false)}
                                    className="flex-1 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmReveal}
                                    className="flex-1 px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium transition-colors"
                                >
                                    Reveal
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
