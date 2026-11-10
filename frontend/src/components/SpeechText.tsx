import { useLayoutEffect, useRef, useState } from 'react';
import type { Language } from '../models/types';
import { fitSpeechFont } from '../services/speechLayout';

export function SpeechText({
    text,
    fullText,
    language,
    onExpanded,
}: {
    text: string;
    fullText: string;
    language: Language;
    onExpanded: (value: boolean) => void;
}) {
    const container = useRef<HTMLDivElement>(null);
    const reserve = useRef<HTMLDivElement>(null);
    const [font, setFont] = useState(20);
    useLayoutEffect(() => {
        const box = container.current;
        const measurement = reserve.current;
        if (!box || !measurement) return;
        const controls = box.closest('.conversation-page')?.querySelector('.conversation-bottom');
        let frame = 0;
        const fit = () => {
            if (box.clientWidth < 1) return;
            const mobile = window.matchMedia('(max-width: 600px)').matches;
            const controlsHeight = controls?.getBoundingClientRect().height || (mobile ? 180 : 150);
            // Reserve space for the header, toolbar and (on phones) the character.
            const available = Math.max(
                120,
                window.innerHeight -
                    (mobile ? 190 : 270) -
                    controlsHeight -
                    40 -
                    (mobile ? 130 : 0),
            );
            // Decide phone expansion against the compact width, even after the page expands.
            // Otherwise the wider expanded balloon could repeatedly collapse and expand.
            const pageWidth = box.closest('.conversation-page')?.clientWidth ?? box.clientWidth;
            measurement.style.width = mobile ? `${Math.max(100, pageWidth * 0.79 - 30)}px` : '';
            const result = fitSpeechFont(mobile ? 17 : 20, 14, available, (size) => {
                measurement.style.fontSize = `${size}px`;
                return measurement.getBoundingClientRect().height;
            });
            const size = result.expanded ? (mobile ? 17 : 20) : result.size;
            measurement.style.width = '';
            measurement.style.fontSize = `${size}px`;
            setFont(size);
            onExpanded(result.expanded);
        };
        const schedule = () => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(fit);
        };
        fit();
        let lastWidth = box.clientWidth;
        let lastControlsHeight = controls?.getBoundingClientRect().height ?? 0;
        const observer =
            typeof ResizeObserver === 'undefined'
                ? null
                : new ResizeObserver(() => {
                      const width = box.clientWidth;
                      const height = controls?.getBoundingClientRect().height ?? 0;
                      if (
                          Math.abs(width - lastWidth) > 0.5 ||
                          Math.abs(height - lastControlsHeight) > 0.5
                      ) {
                          lastWidth = width;
                          lastControlsHeight = height;
                          schedule();
                      }
                  });
        observer?.observe(box);
        if (controls) observer?.observe(controls);
        window.addEventListener('resize', schedule);
        document.fonts?.ready.then(schedule);
        return () => {
            cancelAnimationFrame(frame);
            observer?.disconnect();
            window.removeEventListener('resize', schedule);
        };
    }, [fullText, onExpanded]);

    return (
        <div
            className="speech-copy"
            ref={container}
            style={{ fontSize: `${font}px` }}
            lang={language}
        >
            {/* Measure/reserve the COMPLETE answer so word revelation never changes font or box height. */}
            <div className="speech-reserve" ref={reserve} aria-hidden="true">
                {fullText || '…'}
            </div>
            <div className="speech-text" aria-live="off">
                {text || (
                    <span className="thinking-dots" aria-label="Aguardando reprodução">
                        <i />
                        <i />
                        <i />
                    </span>
                )}
            </div>
        </div>
    );
}
