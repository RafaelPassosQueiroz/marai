export function Logo({ compact = false }: { compact?: boolean }) {
    return (
        <a
            className={`brand ${compact ? 'brand-compact' : ''}`}
            href="#"
            aria-label="Marai, início"
            onClick={(event) => {
                event.preventDefault();
                window.dispatchEvent(new Event('marai:home'));
            }}
        >
            <img src="/logo.png" alt="marai" />
        </a>
    );
}
