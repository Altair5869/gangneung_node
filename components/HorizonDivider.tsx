export default function HorizonDivider({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1440 120"
      preserveAspectRatio="none"
      className={`w-full h-16 ${className}`}
      aria-hidden="true"
    >
      <path
        d="M0,80 L120,40 L240,70 L360,20 L480,60 L600,30 L720,65 L840,15 L960,55 L1080,35 L1200,70 L1320,25 L1440,60"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <line x1="0" y1="95" x2="1440" y2="95" stroke="currentColor" strokeWidth="1" opacity="0.5" />
    </svg>
  );
}
