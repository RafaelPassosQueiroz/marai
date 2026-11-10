export function fitSpeechFont(
    maximum: number,
    minimum: number,
    availableHeight: number,
    measure: (size: number) => number,
) {
    for (let size = maximum; size >= minimum; size -= 0.5) {
        if (measure(size) <= availableHeight) return { size, expanded: false };
    }
    return { size: minimum, expanded: true };
}
