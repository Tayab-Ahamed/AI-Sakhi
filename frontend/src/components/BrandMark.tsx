type BrandMarkProps = {
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
};

const sizes = {
  sm: { box: 30, icon: 14, cap: 12, radius: 10 },
  md: { box: 38, icon: 17, cap: 15, radius: 12 },
  lg: { box: 52, icon: 23, cap: 20, radius: 16 },
};

export function BrandMark({ size = "md", showLabel = false, className = "" }: BrandMarkProps) {
  const s = sizes[size];
  return (
    <span className={`brand-lockup ${className}`}>
      <span className="brand-mark" style={{ width: s.box, height: s.box, borderRadius: s.radius }} aria-hidden="true">
        <span className="brand-mark-glow" />
        <svg className="brand-mark-svg" viewBox="0 0 48 48" width={s.box * 0.7} height={s.box * 0.7} fill="none">
          <path d="M10 25.5 24 31l14-5.5v10L24 41 10 35.5v-10Z" fill="rgba(255,255,255,.92)" />
          <path d="m10 25.5 14 5.7 14-5.7L24 20 10 25.5Z" fill="#fff" />
          <path d="M24 31.2v9.4M15.5 28.2v6.1M32.5 28.2v6.1" stroke="#047857" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M24 20c0-5.3 3.2-8.7 8.5-10.2" stroke="#d1fae5" strokeWidth="2" strokeLinecap="round" />
          <path d="m33.2 7.5.9 2.5 2.5.9-2.5.9-.9 2.5-.9-2.5-2.5-.9 2.5-.9.9-2.5Z" fill="#fff" />
        </svg>
      </span>
      {showLabel && <span className="brand-lockup-label">AI Sakhi</span>}
    </span>
  );
}
