import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRoles } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { AccessDenied, PageHeader } from "@/components/app-shell";
import { TatreezEmptyState } from "@/components/tatreez";
import { ConfirmDelete } from "@/components/confirm-delete";
import { ReceiptUpload, openReceipt } from "@/components/receipt-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/documents")({
  head: () => ({
    meta: [
      { title: "Documents — Khoyoot" },
      { name: "description", content: "Private contracts, licences and invoices with expiry reminders." },
      { property: "og:title", content: "Documents — Khoyoot" },
      { property: "og:description", content: "Private contracts, licences and invoices with expiry reminders." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DocumentsPage,
});

const CATS = ["contract", "licence", "invoice", "other"] as const;
const sel = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

function DocumentsPage() {
  const roles = useRoles();
  const { lang } = useI18n();
  const L = (en: string, ar: string) => (lang === "ar" ? ar : en);
  const catLabel: Record<string, string> = {
    contract: L("Contract", "عقد"), licence: L("Licence", "ترخيص"), invoice: L("Invoice", "فاتورة"), other: L("Other", "أخرى"),
  };
  const qc = useQueryClient();
  const [edit, setEdit] = useState<{ row: any | null } | null>(null);
  const [del, setDel] = useState<string | null>(null);
  const [cat, setCat] = useState("all");

  const q = useQuery({
    queryKey: ["company-docs"], enabled: roles.isOwner,
    queryFn: async () => {
      const { data, error } = await supabase.from("company_documents").select("*").order("expires_on", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
  const save = useMutation({
    mutationFn: async (v: { id?: string; payload: any }) => {
      const t = supabase.from("company_documents");
      const { error } = v.id ? await t.update(v.payload).eq("id", v.id) : await t.insert(v.payload);
      if (error) throw error;
    },
    onSuccess: () => { toast.success(L("Saved", "تم الحفظ")); setEdit(null); qc.invalidateQueries({ queryKey: ["company-docs"] }); qc.invalidateQueries({ queryKey: ["notifications"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("company_documents").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { setDel(null); qc.invalidateQueries({ queryKey: ["company-docs"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!roles.isLoading && !roles.isOwner) return <AccessDenied />;
  const today = new Date().toISOString().slice(0, 10);
  const soon = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
  const rows = (q.data ?? []).filter((d) => cat === "all" || d.doc_type === cat);

  return (
    <div className="space-y-5">
      <PageHeader title={L("Documents", "المستندات")} description={L("Private contracts, licences and invoices. Only Owners can see them.", "عقود وتراخيص وفواتير خاصة. يراها المالكون فقط.")}
        action={<Button onClick={() => setEdit({ row: null })}><Plus className="size-4" /> {L("Add document", "إضافة مستند")}</Button>} />
      <div className="w-56">
        <select value={cat} onChange={(e) => setCat(e.target.value)} className={sel}>
          <option value="all">{L("All categories", "كل الفئات")}</option>
          {CATS.map((c) => <option key={c} value={c}>{catLabel[c]}</option>)}
        </select>
      </div>
      <div className="card-surface overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-xs uppercase text-muted-foreground"><tr>
            <th className="px-4 py-2 text-start">{L("Title", "العنوان")}</th>
            <th className="px-4 py-2 text-start">{L("Category", "الفئة")}</th>
            <th className="px-4 py-2 text-start">{L("Date", "التاريخ")}</th>
            <th className="px-4 py-2 text-start">{L("Expires", "ينتهي")}</th>
            <th className="px-4 py-2 text-start">{L("File", "الملف")}</th>
            <th className="px-4 py-2" /></tr></thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id} className="border-t">
                <td className="px-4 py-2"><p className="font-medium">{d.title}</p>{d.notes && <p className="text-xs text-muted-foreground">{d.notes}</p>}</td>
                <td className="px-4 py-2">{catLabel[d.doc_type] ?? d.doc_type}</td>
                <td className="px-4 py-2">{d.doc_date ? formatDate(d.doc_date) : "—"}</td>
                <td className="px-4 py-2">
                  {d.expires_on ? <>
                    {formatDate(d.expires_on)}{" "}
                    {d.expires_on < today ? <Badge variant="destructive">{L("Expired", "منتهي")}</Badge>
                      : d.expires_on <= soon ? <Badge variant="secondary">{L("Expires soon", "ينتهي قريباً")}</Badge> : null}
                  </> : "—"}
                </td>
                <td className="px-4 py-2">
                  {d.file_path ? <button className="text-primary underline" onClick={() => openReceipt(d.file_path)}>{L("Open", "فتح")}</button>
                    : d.url ? <a className="text-primary underline" href={d.url} target="_blank" rel="noopener noreferrer">{L("Link", "رابط")}</a> : "—"}
                </td>
                <td className="px-4 py-2"><div className="flex justify-end">
                  <Button size="icon" variant="ghost" aria-label={L("Edit", "تعديل")} onClick={() => setEdit({ row: d })}><Pencil className="size-4" /></Button>
                  <Button size="icon" variant="ghost" aria-label={L("Delete", "حذف")} onClick={() => setDel(d.id)}><Trash2 className="size-4" /></Button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <div className="p-4"><TatreezEmptyState title={L("No documents yet", "لا توجد مستندات بعد")} /></div>}
      </div>

      <ConfirmDelete open={!!del} onOpenChange={(v) => !v && setDel(null)} onConfirm={() => del && remove.mutate(del)} />

      <Dialog open={!!edit} onOpenChange={(v) => !v && setEdit(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{edit?.row ? L("Edit document", "تعديل المستند") : L("Add document", "إضافة مستند")}</DialogTitle></DialogHeader>
          {edit && (
            <form className="space-y-3" onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const s = (k: string) => String(f.get(k) || "") || null;
              save.mutate({ id: edit.row?.id, payload: {
                title: String(f.get("title")), doc_type: String(f.get("doc_type")), doc_date: s("doc_date"),
                expires_on: s("expires_on"), notes: s("notes"), file_path: s("receipt_path"), url: edit.row?.url ?? "",
              } });
            }}>
              <div className="space-y-2"><Label>{L("Title", "العنوان")}</Label><Input name="title" required dir="auto" defaultValue={edit.row?.title ?? ""} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>{L("Category", "الفئة")}</Label>
                  <select name="doc_type" defaultValue={edit.row?.doc_type ?? "contract"} className={sel}>{CATS.map((c) => <option key={c} value={c}>{catLabel[c]}</option>)}</select></div>
                <div className="space-y-2"><Label>{L("Date", "التاريخ")}</Label><Input name="doc_date" type="date" defaultValue={edit.row?.doc_date ?? ""} /></div>
                <div className="space-y-2 col-span-2"><Label>{L("Expiry date (optional)", "تاريخ الانتهاء (اختياري)")}</Label><Input name="expires_on" type="date" defaultValue={edit.row?.expires_on ?? ""} /></div>
              </div>
              <div className="space-y-2"><Label>{L("Notes", "ملاحظات")}</Label><Input name="notes" dir="auto" defaultValue={edit.row?.notes ?? ""} /></div>
              <ReceiptUpload idPrefix="doc" defaultPath={edit.row?.file_path} />
              <DialogFooter><Button type="submit" disabled={save.isPending}>{L("Save", "حفظ")}</Button></DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
