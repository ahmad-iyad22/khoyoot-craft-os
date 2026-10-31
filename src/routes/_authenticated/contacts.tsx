import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Globe, Instagram, Mail, Pencil, Phone, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { PageHeader } from "@/components/app-shell";
import { TatreezEmptyState } from "@/components/tatreez";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/contacts")({
  head: () => ({
    meta: [
      { title: "Contacts — Khoyoot" },
      { name: "description", content: "Companies, partners and suppliers with their contact details." },
      { property: "og:title", content: "Contacts — Khoyoot" },
      { property: "og:description", content: "Companies, partners and suppliers with their contact details." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ContactsPage,
});

const KINDS = ["company", "partner", "supplier", "other"] as const;
const KIND_TONE: Record<string, string> = {
  company: "border-primary/40 bg-primary/15 text-foreground",
  partner: "border-success/40 bg-success/15 text-foreground",
  supplier: "border-info/40 bg-info/15 text-foreground",
  other: "bg-muted text-muted-foreground",
};
const FIELDS = ["contact_person", "phone", "email", "website", "instagram", "other_social", "address"] as const;
const sel = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";
const empty = { name: "", kind: "company", contact_person: "", phone: "", email: "", website: "", instagram: "", other_social: "", address: "", notes: "" };
const href = (u: string) => (/^https?:\/\//i.test(u) ? u : `https://${u}`);
const igHref = (u: string) => (/^https?:\/\//i.test(u) ? u : `https://instagram.com/${u.replace(/^@/, "")}`);

function ContactsPage() {
  const { lang } = useI18n();
  const L = (en: string, ar: string) => (lang === "ar" ? ar : en);
  const LBL: Record<string, string> = {
    company: L("Company", "شركة"), partner: L("Partner", "شريك"), supplier: L("Supplier", "مورّد"), other: L("Other", "أخرى"),
    contact_person: L("Contact person", "الشخص المسؤول"), phone: L("Phone", "الهاتف"), email: L("Email", "البريد الإلكتروني"),
    website: L("Website", "الموقع الإلكتروني"), instagram: L("Instagram", "إنستغرام"), other_social: L("Other social / link", "رابط آخر"),
    address: L("Address", "العنوان"),
  };
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(empty);
  const [del, setDel] = useState<string | null>(null);
  const [kind, setKind] = useState("all");
  const [q, setQ] = useState("");

  const listQ = useQuery({ queryKey: ["contacts"], queryFn: async () => {
    const { data, error } = await supabase.from("contacts").select("*").order("name");
    if (error) throw error; return data ?? [];
  } });

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error(L("Name is required", "الاسم مطلوب"));
      const payload: any = { ...form, name: form.name.trim() };
      for (const k of Object.keys(payload)) if (payload[k] === "") payload[k] = null;
      payload.name = form.name.trim(); payload.kind = form.kind;
      const { error } = editing ? await supabase.from("contacts").update(payload).eq("id", editing.id) : await supabase.from("contacts").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => { toast.success(L("Saved", "تم الحفظ")); setOpen(false); void qc.invalidateQueries({ queryKey: ["contacts"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("contacts").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success(L("Deleted", "تم الحذف")); setDel(null); void qc.invalidateQueries({ queryKey: ["contacts"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const openForm = (c?: any) => {
    setEditing(c ?? null);
    setForm(c ? Object.fromEntries(Object.keys(empty).map((k) => [k, c[k] ?? ""])) : empty);
    setOpen(true);
  };

  const s = q.trim().toLowerCase();
  const rows = (listQ.data ?? []).filter((c: any) => (kind === "all" || c.kind === kind) &&
    (!s || [c.name, c.contact_person, c.email, c.phone, c.instagram].some((v) => v?.toLowerCase().includes(s))));

  return (
    <div className="space-y-6">
      <PageHeader title={L("Contacts", "جهات الاتصال")} description={L("Companies, partners, suppliers and their details.", "الشركات والشركاء والموردون وبيانات التواصل.")}
        action={<Button onClick={() => openForm()}><Plus className="size-4" />{L("Add contact", "إضافة جهة")}</Button>} />
      <p className="text-sm text-muted-foreground">
        {L("Supplier prices and payments stay on the ", "أسعار ومدفوعات الموردين في صفحة ")}
        <Link to="/suppliers" className="text-primary hover:underline">{L("Suppliers", "الموردون")}</Link>
        {L(" page; partner money stays on ", "؛ وأموال الشركاء في ")}
        <Link to="/partners" className="text-primary hover:underline">{L("Partners", "الشركاء")}</Link>.
      </p>
      <div className="flex flex-wrap gap-2">
        <Input className="max-w-xs" placeholder={L("Search…", "بحث…")} value={q} onChange={(e) => setQ(e.target.value)} />
        {["all", ...KINDS].map((k) => (
          <Button key={k} size="sm" variant={kind === k ? "default" : "outline"} onClick={() => setKind(k)}>{k === "all" ? L("All", "الكل") : LBL[k]}</Button>
        ))}
      </div>
      {rows.length === 0 ? <TatreezEmptyState title={L("No contacts yet", "لا توجد جهات اتصال بعد")} /> : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((c: any) => (
            <Card key={c.id}>
              <CardContent className="space-y-2 pt-6">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-display text-lg">{c.name}</div>
                    {c.contact_person && <div className="text-sm text-muted-foreground">{c.contact_person}</div>}
                  </div>
                  <Badge variant="outline" className={KIND_TONE[c.kind] ?? KIND_TONE["other"]}>{LBL[c.kind] ?? c.kind}</Badge>
                </div>
                <div className="space-y-1 text-sm">
                  {c.phone && <a href={`tel:${c.phone}`} className="flex items-center gap-2 hover:text-primary"><Phone className="size-4" />{c.phone}</a>}
                  {c.email && <a href={`mailto:${c.email}`} className="flex items-center gap-2 break-all hover:text-primary"><Mail className="size-4 shrink-0" />{c.email}</a>}
                  {c.website && <a href={href(c.website)} target="_blank" rel="noreferrer" className="flex items-center gap-2 break-all hover:text-primary"><Globe className="size-4 shrink-0" />{c.website}</a>}
                  {c.instagram && <a href={igHref(c.instagram)} target="_blank" rel="noreferrer" className="flex items-center gap-2 break-all hover:text-primary"><Instagram className="size-4 shrink-0" />{c.instagram}</a>}
                  {c.other_social && <a href={href(c.other_social)} target="_blank" rel="noreferrer" className="block break-all text-muted-foreground hover:text-primary">{c.other_social}</a>}
                  {c.address && <div className="text-muted-foreground">{c.address}</div>}
                  {c.notes && <div className="whitespace-pre-wrap text-muted-foreground">{c.notes}</div>}
                </div>
                <div className="flex justify-end gap-1">
                  <Button size="icon" variant="ghost" aria-label={L("Edit", "تعديل")} onClick={() => openForm(c)}><Pencil className="size-4" /></Button>
                  <Button size="icon" variant="ghost" aria-label={L("Delete", "حذف")} onClick={() => setDel(c.id)}><Trash2 className="size-4" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? L("Edit contact", "تعديل جهة") : L("Add contact", "إضافة جهة")}</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2"><Label>{L("Name", "الاسم")}</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-1 sm:col-span-2"><Label>{L("Type", "النوع")}</Label>
              <select className={sel} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>{KINDS.map((k) => <option key={k} value={k}>{LBL[k]}</option>)}</select></div>
            {FIELDS.map((f) => (
              <div key={f} className="space-y-1"><Label>{LBL[f]}</Label><Input value={form[f]} onChange={(e) => setForm({ ...form, [f]: e.target.value })} /></div>
            ))}
            <div className="space-y-1 sm:col-span-2"><Label>{L("Notes", "ملاحظات")}</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={() => save.mutate()} disabled={save.isPending}>{L("Save", "حفظ")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDelete open={!!del} onOpenChange={(v) => !v && setDel(null)} onConfirm={() => del && remove.mutate(del)} />
    </div>
  );
}
