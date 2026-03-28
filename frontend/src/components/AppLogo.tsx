import React from "react";
import clsx from "clsx";

import logoHorizontal from "@/assets/branding/logos/logo-primary-horizontal-tagline-transparent.png";
import logoVertical from "@/assets/branding/logos/logo-primary-vertical-tagline-transparent.png";
import logoSquare from "@/assets/branding/logos/logo-primary-square-yellow-bg.png";

const logos = {
  horizontal: logoHorizontal,
  vertical: logoVertical,
  square: logoSquare,
} as const;

type LogoVariant = keyof typeof logos;

interface AppLogoProps {
  variant?: LogoVariant;
  className?: string;
  alt?: string;
}

export default function AppLogo({
  variant = "horizontal",
  className,
  alt = "Universidad Mayor",
}: AppLogoProps) {
  return (
    <img
      src={logos[variant]}
      alt={alt}
      className={clsx("object-contain", className)}
      draggable={false}
    />
  );
}
