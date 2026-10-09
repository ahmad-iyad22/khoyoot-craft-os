import { ImageOff } from "lucide-react";
import { useState } from "react";

export function ProductThumbnail({ url, name }: { url?: string | null; name?: string | null }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return url && failedUrl !== url ? (
    <img src={url} alt={name ?? ""} loading="lazy" onError={() => setFailedUrl(url)} className="size-9 shrink-0 rounded-md border object-cover" />
  ) : (
    <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground">
      <ImageOff className="size-4" />
    </span>
  );
}