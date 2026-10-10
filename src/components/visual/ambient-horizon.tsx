/** Static light architecture. Decorative, with no implied capability or live activity. */
export function AmbientHorizon() {
  return (
    <span className="io-horizon" aria-hidden="true">
      <span className="io-horizon-core" />
      <span className="io-horizon-orbit io-horizon-orbit-gold" />
      <span className="io-horizon-orbit io-horizon-orbit-emerald" />
      <span className="io-horizon-flare" />
    </span>
  );
}
