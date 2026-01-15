/**
 * Product Image with fallback skeleton
 */

import { useState } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/components/lib/utils";

interface ProductImageProps {
  src: string;
  alt: string;
  className?: string;
  onClick?: () => void;
}

export function ProductImage({ src, alt, className, onClick }: ProductImageProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  if (hasError) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-muted",
          className
        )}
        onClick={onClick}
      >
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <ImageOff className="h-12 w-12 opacity-50" />
          <span className="text-xs">Image unavailable</span>
        </div>
      </div>
    );
  }

  return (
    <>
      {isLoading && (
        <div
          className={cn(
            "absolute inset-0 animate-pulse bg-muted",
            className
          )}
        />
      )}
      <img
        src={src}
        alt={alt}
        className={cn(className, isLoading && "opacity-0")}
        onClick={onClick}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setHasError(true);
          setIsLoading(false);
        }}
        loading="lazy"
      />
    </>
  );
}
