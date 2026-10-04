import Image from "next/image";
import { cn } from "@/lib/cn";

interface ProductImageProps {
  /** Photo URL; when absent the category illustration is shown */
  image?: string;
  /** Illustration key = file name in /public/illustrations */
  illustration: string;
  alt: string;
  /** `sizes` for the photo, e.g. "(min-width: 1024px) 25vw, 50vw" */
  sizes?: string;
  /** Preload: use for the main image above the fold */
  preload?: boolean;
  className?: string;
}

/** Square product tile: supplier photo if there is one, otherwise the line illustration of the part */
export function ProductImage({ image, illustration, alt, sizes, preload = false, className }: ProductImageProps) {
  return (
    <div
      className={cn(
        "relative isolate aspect-square overflow-hidden bg-linear-to-b from-[#f8fafd] to-[#edf1f6]",
        className,
      )}
    >
      {image ? (
        <Image
          src={image}
          alt={alt}
          fill
          sizes={sizes ?? "(min-width: 1280px) 300px, (min-width: 768px) 33vw, 50vw"}
          preload={preload}
          className="object-contain p-3 mix-blend-multiply"
        />
      ) : (
        <Image
          src={`/illustrations/${illustration}.svg`}
          alt={alt}
          fill
          unoptimized
          preload={preload}
          className="object-contain p-[8%]"
        />
      )}
    </div>
  );
}
