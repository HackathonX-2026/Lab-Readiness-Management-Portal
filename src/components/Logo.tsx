export function CloudLabsLogo({ size = 40 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="cl-cloud-purple" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
      {/* Purple cloud silhouette */}
      <path
        d="M17 48c-6 0-10.5-4.4-10.5-10s4.5-10 10.5-10c1 0 1.9.1 2.8.4C22.2 22.5 27.7 18 34.5 18 43 18 50 24.5 50 32.5c0 .5 0 1-.1 1.5 4.9.9 8.6 4.9 8.6 9.7 0 5.4-4.5 9.8-10 9.8H17c-.7 0-1.4-.1-2-.2.7.5 1.5.7 2 .7z"
        fill="url(#cl-cloud-purple)"
      />
      {/* Pie chart inside the cloud (three slices, matching reference) */}
      <g transform="translate(24 28)">
        {/* Bottom-left slice */}
        <path d="M11 11 L0 11 A11 11 0 0 1 5.5 1.5 z" fill="#c4b5fd" />
        {/* Top slice */}
        <path d="M11 11 L5.5 1.5 A11 11 0 0 1 16.5 1.5 z" fill="#8b5cf6" />
        {/* Bottom-right slice */}
        <path d="M11 11 L16.5 1.5 A11 11 0 1 1 0 11 z" fill="#6d28d9" opacity="0.85" />
        {/* subtle inner ring */}
        <circle cx="11" cy="11" r="2.2" fill="#0b1220" />
      </g>
    </svg>
  );
}
