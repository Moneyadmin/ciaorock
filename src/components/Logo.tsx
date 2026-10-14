/** Logo di Ciao Rock: un sasso dipinto su un gradiente viola → rosa. */
export function Logo({ className = "h-20 w-20" }: { className?: string }) {
  return (
    <svg viewBox="0 0 96 96" className={className} role="img" aria-label="Ciao Rock">
      <defs>
        <linearGradient id="logo-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7b5cff" />
          <stop offset="1" stopColor="#ff4fa3" />
        </linearGradient>
      </defs>
      <rect width="96" height="96" rx="28" fill="url(#logo-bg)" />
      <path
        d="M48 24c15.5 0 27 9.6 27 23.5C75 62.2 63 72 47.4 72 31.6 72 21 63.1 21 49.4 21 34.7 32.5 24 48 24Z"
        fill="#fff"
      />
      <circle cx="38" cy="44" r="4.5" fill="#2b2545" />
      <circle cx="58" cy="44" r="4.5" fill="#2b2545" />
      <circle cx="31" cy="54" r="4" fill="#ff4fa3" opacity="0.55" />
      <circle cx="65" cy="54" r="4" fill="#ff4fa3" opacity="0.55" />
      <path d="M40 56c4.6 4 11.4 4 16 0" fill="none" stroke="#2b2545" strokeWidth="4" strokeLinecap="round" />
      <circle cx="70" cy="30" r="6" fill="#d4ff3a" />
    </svg>
  );
}
