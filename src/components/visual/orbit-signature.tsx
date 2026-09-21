// A static material motif for the dashboard focal surface; no renderer or animation dependency.
export function OrbitSignature() {
  return (
    <svg
      className="orbit-signature"
      viewBox="0 0 420 420"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="210" cy="210" r="164" stroke="currentColor" strokeOpacity=".22" />
      <circle cx="210" cy="210" r="157" stroke="currentColor" strokeOpacity=".09" />
      <circle
        cx="210"
        cy="210"
        r="180"
        stroke="currentColor"
        strokeOpacity=".3"
        strokeDasharray="1 13"
      />
      <ellipse
        cx="210"
        cy="210"
        rx="184"
        ry="82"
        transform="rotate(-38 210 210)"
        stroke="currentColor"
        strokeOpacity=".55"
      />
      <ellipse
        cx="210"
        cy="210"
        rx="105"
        ry="176"
        transform="rotate(-38 210 210)"
        stroke="currentColor"
        strokeOpacity=".3"
      />
      <path d="M46 210h328M210 46v328" stroke="currentColor" strokeOpacity=".1" />
      <circle cx="69" cy="183" r="4" fill="currentColor" />
      <circle cx="350" cy="238" r="3" fill="currentColor" />
      <path d="m210 191 4 15 15 4-15 4-4 15-4-15-15-4 15-4Z" fill="currentColor" />
    </svg>
  );
}
