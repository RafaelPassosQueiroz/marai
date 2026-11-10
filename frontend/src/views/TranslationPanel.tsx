import { ArrowRightLeft, Check, Copy, Languages, LoaderCircle, X } from 'lucide-react';
import { translationLanguages } from '../models/translation';
import type { TranslationLanguage } from '../models/translation';
import type { TranslationViewModel } from '../viewmodels/useTranslationViewModel';

export function TranslationPanel({ vm, onClose }: { vm: TranslationViewModel; onClose: () => void }) {
    return (
        <aside id="translation-panel" className="translator-panel" role="dialog" aria-labelledby="translator-title"
            onKeyDown={(event) => {
                if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
            }}>
            <div className="transcript-heading">
                <div>
                    <span className="eyebrow">UMA PALAVRA DE CADA VEZ</span>
                    <h2 id="translator-title"><Languages size={21} /> Tradutor</h2>
                </div>
                <button className="icon-button" aria-label="Fechar tradutor" onClick={onClose}><X size={20} /></button>
            </div>
            <form className="translator-form" onSubmit={(event) => { event.preventDefault(); void vm.translate(); }}>
                <div className="translator-languages">
                    <label>De
                        <select aria-label="Idioma de origem" value={vm.source} disabled={vm.busy}
                            onChange={(event) => vm.updateSource(event.target.value as TranslationLanguage)}>
                            {translationLanguages.map((language) => <option key={language.value} value={language.value}>{language.label}</option>)}
                        </select>
                    </label>
                    <button type="button" className="icon-button translator-swap" aria-label="Inverter idiomas"
                        disabled={vm.busy} onClick={vm.swap}><ArrowRightLeft size={19} /></button>
                    <label>Para
                        <select aria-label="Idioma de destino" value={vm.target} disabled={vm.busy}
                            onChange={(event) => vm.updateTarget(event.target.value as TranslationLanguage)}>
                            {translationLanguages.map((language) => <option key={language.value} value={language.value}>{language.label}</option>)}
                        </select>
                    </label>
                </div>
                <label htmlFor="translation-text">O que você quer traduzir?</label>
                <textarea id="translation-text" value={vm.text} onChange={(event) => vm.updateText(event.target.value)}
                    placeholder="Digite uma palavra ou frase…" autoFocus maxLength={500} rows={3} disabled={vm.busy}
                    aria-describedby="translation-byte-count" aria-invalid={vm.bytes > 500} />
                <span id="translation-byte-count" className={`translator-counter ${vm.bytes > 500 ? 'over-limit' : ''}`}>
                    {vm.bytes} / 500 bytes · Acentos e outros alfabetos podem ocupar mais bytes.
                </span>
                {vm.source === vm.target && <p className="translator-validation">Escolha idiomas diferentes para traduzir.</p>}
                {vm.bytes > 500 && <p className="translator-validation">Reduza o texto para no máximo 500 bytes.</p>}
                <button type="submit" className="button primary" disabled={vm.busy || vm.invalid}>
                    {vm.busy ? <LoaderCircle size={17} className="spin" /> : <Languages size={17} />}
                    {vm.busy ? 'Traduzindo…' : 'Traduzir'}
                </button>
            </form>
            {vm.error && <p className="translator-error" role="alert">{vm.error}</p>}
            {vm.result && <section className="translator-result" aria-label="Tradução" aria-live="polite">
                <div><strong>Tradução</strong>
                    <button type="button" className="text-button" onClick={() => vm.copy()} aria-label="Copiar tradução">
                        {vm.copied ? <Check size={15} /> : <Copy size={15} />}{vm.copied ? 'Copiado' : 'Copiar'}
                    </button>
                </div>
                <p lang={vm.target} dir="auto">{vm.result.translated_text}</p>
            </section>}
            <p className="translator-note">Tradução por MyMemory · Serviço gratuito com limite diário.<br />
                Seu texto é enviado ao MyMemory e fica separado do histórico da conversa.</p>
        </aside>
    );
}
