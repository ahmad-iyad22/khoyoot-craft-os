import { ImageOff } from "lucide-react";
import { useEffect, useState } from "react";
import { isStoredImage, resolveImageUrl } from "@/lib/product-images";

export function ProductThumbnail({ url, name, size = "size-9" }: { url?: string | null; name?: string | null; size?: string }) {
  const [src, setSrc] = useState<string | null>(url && !isStoredImage(url) ? url : null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    setFailed(false);
    resolveImageUrl(url).then((u) => alive && setSrc(u));
    return () => {
      alive = false;
    };
  }, [url]);
  return src && !failed ? (
    <img src={src} alt={name ?? ""} loading="lazy" onError={() => setFailed(true)} className={`${size} shrink-0 rounded-md border object-cover`} />
  ) : (
    <span aria-hidden="true" className={`flex ${size} shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground`}>
      <ImageOff className="size-4" />
    </span>
  );
}
