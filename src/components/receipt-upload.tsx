import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FileText, Paperclip, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { compressImage } from "@/lib/product-images";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const BUCKET = "receipts";
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_RAW_IMAGE = 20 * 1024 * 1024;

export async function openReceipt(path: string) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 300);
  if (error || !data) {
    toast.error(error?.message ?? "Error");
    return;
  }
  window.open(data.signedUrl, "_blank", "noopener");
}

/** Optional receipt (image or PDF). Emits a hidden form field `receipt_path`. */
export function ReceiptUpload({ defaultPath, idPrefix }: { defaultPath?: string | null; idPrefix: string }) {
  const { t } = useI18n();
  const [path, setPath] = useState(defaultPath ?? "");
  const [busy, setBusy] = useState(false);
  useEffect(() => setPath(defaultPath ?? ""), [defaultPath]);
  return (
    <div className="space-y-2">
      <Label htmlFor={`${idPrefix}-receipt`}>{t("receiptOptional")}</Label>
      <input type="hidden" name="receipt_path" value={path} />
      {path ? (
        <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
          {path.endsWith(".pdf") ? <FileText className="size-4" /> : <Paperclip className="size-4" />}
          <button type="button" className="truncate text-primary underline-offset-2 hover:underline" onClick={() => openReceipt(path)}>
            {t("viewReceipt")}
          </button>
          <Button type="button" variant="ghost" size="icon" className="ms-auto size-7" aria-label={t("removeReceipt")} onClick={() => setPath("")}>
            <X className="size-4" />
          </Button>
        </div>
      ) : (
        <Input
          id={`${idPrefix}-receipt`}
          type="file"
          accept="image/*,application/pdf"
          disabled={busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setBusy(true);
            try {
              const isPdf = file.type === "application/pdf";
              if (!isPdf && !file.type.startsWith("image/")) throw new Error(t("receiptType"));
              if (file.size > (isPdf ? MAX_BYTES : MAX_RAW_IMAGE)) throw new Error(t("receiptTooLarge"));
              const body = isPdf ? file : await compressImage(file);
              if (body.size > MAX_BYTES) throw new Error(t("receiptTooLarge"));
              const p = `${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.${isPdf ? "pdf" : "jpg"}`;
              const { error } = await supabase.storage.from(BUCKET).upload(p, body, { contentType: isPdf ? "application/pdf" : "image/jpeg" });
              if (error) throw error;
              setPath(p);
              toast.success(t("receiptUploaded"));
            } catch (err) {
              toast.error((err as Error).message);
            } finally {
              setBusy(false);
              e.target.value = "";
            }
          }}
        />
      )}
      <p className="text-xs text-muted-foreground">{busy ? t("uploading") : t("receiptHint")}</p>
    </div>
  );
}
