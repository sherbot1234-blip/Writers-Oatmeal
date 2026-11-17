/** A bowl of oatmeal with a little book and rising steam. */
export function OatLogo({ size = 64, steam = true }: { size?: number; steam?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={'oat-logo' + (steam ? ' steamy' : '')} aria-hidden>
      {steam && (
        <g className="steam" fill="none" stroke="#c9a77c" strokeWidth="2.2" strokeLinecap="round">
          <path d="M24 20c-3-4 3-6 0-10" />
          <path d="M32 18c-3-4 3-6 0-10" />
          <path d="M40 20c-3-4 3-6 0-10" />
        </g>
      )}
      <ellipse cx="32" cy="33" rx="22" ry="6" fill="#f3e3c3" />
      <g fill="#e2c897">
        <circle cx="24" cy="32" r="1.6" />
        <circle cx="30" cy="34" r="1.4" />
        <circle cx="37" cy="31.5" r="1.7" />
        <circle cx="42" cy="34" r="1.3" />
        <circle cx="19" cy="34" r="1.2" />
      </g>
      <path d="M38 31l6-3 1 4-6 2z" fill="#d1495b" />
      <path d="M10 33c0 13 10 21 22 21s22-8 22-21" fill="#c26a2e" />
      <path d="M10 33c0 13 10 21 22 21s22-8 22-21" fill="none" stroke="#9a4f1c" strokeWidth="1.5" />
      <path d="M17 41c4 5 9 7 15 7" stroke="#e8a46b" strokeWidth="2" fill="none" strokeLinecap="round" opacity=".8" />
      <ellipse cx="32" cy="56" rx="12" ry="2.2" fill="#9a4f1c" opacity=".25" />
    </svg>
  );
}
