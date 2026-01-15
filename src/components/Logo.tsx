/**
 * DJewel Boutique Logo Component
 * Diamond-shaped logo with gold gradient
 */

import { cn } from "@/components/lib/utils";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
}

export function Logo({ size = "md", showText = true, className }: LogoProps) {
  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-14 w-14",
  };

  const textSizeClasses = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-2xl",
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <svg
        viewBox="0 0 32 32"
        className={cn(sizeClasses[size], "flex-shrink-0")}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="logoGold" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: "#D4A84B" }} />
            <stop offset="50%" style={{ stopColor: "#F4D03F" }} />
            <stop offset="100%" style={{ stopColor: "#D4A84B" }} />
          </linearGradient>
        </defs>
        {/* Diamond shape */}
        <path
          d="M16 2 L28 12 L16 30 L4 12 Z"
          fill="url(#logoGold)"
          stroke="#B8860B"
          strokeWidth="1"
        />
        {/* Inner facets */}
        <path
          d="M16 2 L16 30 M4 12 L28 12 M16 2 L4 12 M16 2 L28 12 M16 30 L4 12 M16 30 L28 12"
          stroke="#B8860B"
          strokeWidth="0.5"
          fill="none"
          opacity="0.6"
        />
        {/* DJ text */}
        <text
          x="16"
          y="18"
          fontFamily="Georgia, serif"
          fontSize="8"
          fontWeight="bold"
          fill="#1a1a1a"
          textAnchor="middle"
        >
          DJ
        </text>
      </svg>
      {showText && (
        <span className={cn("font-semibold", textSizeClasses[size])}>
          DJewel Boutique
        </span>
      )}
    </div>
  );
}
