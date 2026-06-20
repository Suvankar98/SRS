type BrandLogoProps = {
  width?: number;
  className?: string;
};

export function BrandLogo({ width = 160, className }: BrandLogoProps) {
  const height = Math.round(width * 0.323);

  return (
    <img
      src="https://srtec.co.in/wp-content/uploads/2025/09/footer-logo-1-1.png"
      alt="SRTEC Automation"
      width={width}
      height={height}
      className={className}
      loading="eager"
    />
  );
}
