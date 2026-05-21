interface SkeletonCardProps {
  height?: string;
  width?: string;
  className?: string;
  rounded?: string;
}

/**
 * Animated shimmer skeleton placeholder for loading states
 */
export default function SkeletonCard({
  height = "120px",
  width = "100%",
  className = "",
  rounded = "rounded-xl",
}: SkeletonCardProps) {
  return (
    <div
      className={`skeleton ${rounded} ${className}`}
      style={{ height, width }}
      aria-hidden="true"
    />
  );
}
