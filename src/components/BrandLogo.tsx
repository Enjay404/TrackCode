interface BrandLogoProps {
  className?: string;
}

export function BrandLogo({ className = 'h-[44px] sm:h-[48px]' }: BrandLogoProps) {
  return (
    <img
      src="/logo.svg"
      alt="TrackCode — ISRC Finder"
      draggable={false}
      className={`w-auto object-contain select-none shrink-0 block ${className}`}
    />
  );
}

export default BrandLogo;
