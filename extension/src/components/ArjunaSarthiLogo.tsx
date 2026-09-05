import React from "react";

interface ArjunaSarthiLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  animate?: boolean;
}

export const ArjunaSarthiLogo: React.FC<ArjunaSarthiLogoProps> = ({
  size = "md",
  className = "",
  animate = true,
}) => {
  const dim =
    size === "sm" ? 28 : size === "md" ? 40 : size === "lg" ? 64 : 110;

  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-full select-none ${className}`}
      style={{ width: dim, height: dim }}
      title="Arjuna Sarthi — Circular Emblem with 4-Layer Orbit"
    >
      <svg
        viewBox="0 0 160 160"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full overflow-visible rounded-full"
      >
        <defs>
          <linearGradient id="extBronze" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#D9C2AA" />
            <stop offset="50%" stopColor="#B5906A" />
            <stop offset="100%" stopColor="#785A3C" />
          </linearGradient>

          <linearGradient id="extSteel" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#9AB0C2" />
            <stop offset="100%" stopColor="#556D7F" />
          </linearGradient>

          <radialGradient id="extCoreBg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#2D2620" />
            <stop offset="70%" stopColor="#231E19" />
            <stop offset="100%" stopColor="#1A1613" />
          </radialGradient>

          <radialGradient id="extGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#B5906A" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#1A1613" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Circular Outer Boundary & Base */}
        <circle
          cx="80"
          cy="80"
          r="76"
          fill="url(#extCoreBg)"
          stroke="#3D332A"
          strokeWidth="1.5"
        />

        {/* Subtle Ambient Radial Glow */}
        <circle cx="80" cy="80" r="68" fill="url(#extGlow)" />

        {/* ================= 4-LAYER CIRCULAR / ELLIPTICAL ORBITS ================= */}
        {/* Layer 4: Outermost Orbit (Slate Steel) */}
        <g
          className={animate ? "origin-center animate-[spin_20s_linear_infinite]" : ""}
          style={{ transformOrigin: "80px 80px" }}
        >
          <ellipse
            cx="80"
            cy="80"
            rx="68"
            ry="28"
            transform="rotate(-25 80 80)"
            stroke="#728A9E"
            strokeWidth="1.2"
            strokeDasharray="4 3"
            strokeOpacity="0.5"
          />
          <circle cx="140" cy="52" r="3" fill="#C7D5E0" stroke="#556D7F" strokeWidth="1" />
        </g>

        {/* Layer 3: Middle-Outer Orbit (Sandstone Bronze) */}
        <g
          className={animate ? "origin-center animate-[spin_14s_linear_infinite_reverse]" : ""}
          style={{ transformOrigin: "80px 80px" }}
        >
          <ellipse
            cx="80"
            cy="80"
            rx="56"
            ry="23"
            transform="rotate(35 80 80)"
            stroke="#A38465"
            strokeWidth="1.4"
            strokeDasharray="5 2.5"
            strokeOpacity="0.6"
          />
          <circle cx="36" cy="100" r="2.8" fill="#E3D7C8" stroke="#785A3C" strokeWidth="1" />
        </g>

        {/* Layer 2: Middle-Inner Orbit (Steel Slate) */}
        <g
          className={animate ? "origin-center animate-[spin_9s_linear_infinite]" : ""}
          style={{ transformOrigin: "80px 80px" }}
        >
          <ellipse
            cx="80"
            cy="80"
            rx="45"
            ry="18"
            transform="rotate(-15 80 80)"
            stroke="#8E7F72"
            strokeWidth="1.5"
            strokeDasharray="3 3"
            strokeOpacity="0.75"
          />
          <circle cx="118" cy="72" r="2.6" fill="#F2EDE5" stroke="#5E4E40" strokeWidth="1" />
        </g>

        {/* Layer 1: Innermost Core Orbit (Warm Bronze) */}
        <g
          className={animate ? "origin-center animate-[spin_6s_linear_infinite_reverse]" : ""}
          style={{ transformOrigin: "80px 80px" }}
        >
          <ellipse
            cx="80"
            cy="80"
            rx="34"
            ry="14"
            transform="rotate(20 80 80)"
            stroke="url(#extBronze)"
            strokeWidth="1.6"
            strokeOpacity="0.85"
          />
          <circle cx="54" cy="69" r="2.5" fill="#D9C2AA" stroke="#785A3C" strokeWidth="1" />
        </g>

        {/* ================= MAHABHARAT ARROW / APEX EMBLEM "A" ================= */}
        {/* Left Leg of A */}
        <path
          d="M80 34 L42 120"
          stroke="url(#extBronze)"
          strokeWidth="11"
          strokeLinecap="round"
        />

        {/* Right Leg of A */}
        <path
          d="M80 34 L118 120"
          stroke="url(#extBronze)"
          strokeWidth="11"
          strokeLinecap="round"
        />

        {/* Sudarshana Knowledge Crossbar */}
        <line
          x1="57"
          y1="90"
          x2="103"
          y2="90"
          stroke="url(#extSteel)"
          strokeWidth="7"
          strokeLinecap="round"
        />

        {/* Center Charioteer Hub Jewel */}
        <circle cx="80" cy="90" r="5" fill="#F2EDE5" stroke="#785A3C" strokeWidth="2" />

        {/* Ekagrata Arrow Apex Jewel */}
        <circle cx="80" cy="34" r="4.5" fill="#F2EDE5" stroke="#B5906A" strokeWidth="2" />
      </svg>
    </div>
  );
};
