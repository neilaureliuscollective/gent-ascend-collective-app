/** Coalesce streamed tokens into one paint; completion cancels stale partial work. */
export function frameText(
  paint: (text: string) => void,
  schedule = requestAnimationFrame,
  cancel = cancelAnimationFrame,
) {
  let text = '',
    frame: number | null = null;
  return {
    append(delta: string) {
      text += delta;
      if (frame === null)
        frame = schedule(() => {
          frame = null;
          paint(text);
        });
    },
    finish(showPartial = false) {
      if (frame !== null) cancel(frame);
      frame = null;
      if (showPartial && text) paint(text);
    },
  };
}
