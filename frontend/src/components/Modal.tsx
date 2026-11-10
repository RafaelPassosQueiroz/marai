import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

export function Modal({
    title,
    children,
    onClose,
}: {
    title: string;
    children: ReactNode;
    onClose: () => void;
}) {
    const root = useRef<HTMLDivElement>(null);
    const close = useRef(onClose);
    close.current = onClose;
    useEffect(() => {
        const before = document.activeElement as HTMLElement | null;
        const container = root.current!;
        container.querySelector<HTMLElement>('button,input,select,textarea')?.focus();
        const key = (event: KeyboardEvent) => {
            if (event.key === 'Escape') close.current();
            if (event.key === 'Tab') {
                const focusable = [
                    ...container.querySelectorAll<HTMLElement>(
                        'button:not(:disabled),input,select,textarea,a[href]',
                    ),
                ];
                const first = focusable[0],
                    last = focusable.at(-1);
                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault();
                    last?.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first?.focus();
                }
            }
        };
        document.addEventListener('keydown', key);
        const scroll = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', key);
            document.body.style.overflow = scroll;
            before?.focus();
        };
    }, []);
    return (
        <div
            className="modal-backdrop"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <div
                className="modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-title"
                ref={root}
            >
                <div className="modal-heading">
                    <h2 id="modal-title">{title}</h2>
                    <button className="icon-button" onClick={onClose} aria-label="Fechar">
                        <X size={20} />
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
}
