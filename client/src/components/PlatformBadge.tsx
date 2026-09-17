import { type Platform } from '../types';
import { PLATFORM_META } from '../platformMeta';


interface Props {
    platform: Platform;
    size?: 'xs' | 'sm';
    full?: boolean; // show the full name instead of the 2-letter code
    className?: string;
}

export function PlatformBadge({ platform, size = 'xs', full = false, className = '' }: Props) {
    const meta = PLATFORM_META[platform];
    const sizing = size === 'xs' ? 'text-[9px] px-1.5 py-0.5' : 'text-[11px] px-2 py-0.5';
    return (
        <span
            title={meta.label}
            className={`inline-flex items-center rounded font-black uppercase tracking-widest border ${meta.bg} ${meta.border} ${meta.color} ${sizing} ${className}`}
        >
            {full ? meta.label : meta.short}
        </span>
    );
}
