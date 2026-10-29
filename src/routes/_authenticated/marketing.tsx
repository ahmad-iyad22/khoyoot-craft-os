import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { tt, useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { useRoles } from "@/lib/auth";
import { AccessDenied, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { Check, ExternalLink, Pencil, Trash2, Plus } from "lucide-react";
import { ConfirmDelete } from "@/components/confirm-delete";
import { ReceiptUpload, openReceipt } from "@/components/receipt-upload";
import { MoneyFields, readMoney, fmtMoney, useAppSettings } from "@/lib/money";

export const Route = createFileRoute("/_authenticated/marketing")({
  head: () => ({
    meta: [
      { title: "Marketing — Khoyoot" },
      { name: "description", content: "Content calendar and campaign tracking for Khoyoot." },
      { property: "og:title", content: "Marketing — Khoyoot" },
      { property: "og:description", content: "Content calendar and campaign tracking for Khoyoot." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MarketingPage,
});

const today = new Date().toISOString().slice(0, 10);
const CONTENT_STATUS = ["idea", "scripted", "posted"];
const CAMPAIGN_STATUS = ["planned", "running", "finished"];

function MarketingPage() {
  const { t, lang } = useI18n();
  const roles = useRoles();
  const base = useAppSettings().data?.base_currency ?? "MYR";
  const [editingPost, setEditingPost] = useState<any>(null);
  const [editingCampaign, setEditingCampaign] = useState<any>(null);
  const [costCampaign, setCostCampaign] = useState<any>(null);
  const [deleting, setDeleting] = useState<{ table: "content_calendar" | "campaigns" | "expenses" | "platform_analytics"; id: string } | null>(null);
  const [snapOpen, setSnapOpen] = useState(false);
  const [editingSnap, setEditingSnap] = useState<any>(null);
  const qc = useQueryClient();
  const [postOpen, setPostOpen] = useState(false);
  const [campaignOpen, setCampaignOpen] = useState(false);

  const productsQ = useQuery({
    queryKey: ["products-basic"],
    enabled: roles.isMarketing,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_products_basic");
      if (error) throw error;
      return data ?? [];
    },
  });

  const contentQ = useQuery({
    queryKey: ["content"],
    enabled: roles.isMarketing,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_calendar")
        .select("*")
        .order("scheduled_date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const campaignsQ = useQuery({
    queryKey: ["campaigns"],
    enabled: roles.isMarketing,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const channelsQ = useQuery({ queryKey: ["platform-fees"], enabled: roles.isMarketing, queryFn: async () => {
    const { data, error } = await supabase.from("platform_fees").select("platform").order("platform");
    if (error) throw error;
    return data ?? [];
  } });
  const channels = Array.from(new Set([...(channelsQ.data ?? []).map((p) => p.platform),
    ...(contentQ.data ?? []).map((p) => p.platform), ...(campaignsQ.data ?? []).map((p) => p.platform),
    editingPost?.platform, editingCampaign?.platform].filter((p): p is string => Boolean(p))));
  const partnersQ = useQuery({ queryKey: ["marketing-partners"], enabled: roles.isOwner, queryFn: async () => {
    const { data, error } = await supabase.from("partners").select("id, name, active").order("created_at");
    if (error) throw error;
    return data ?? [];
  } });
  const costsQ = useQuery({ queryKey: ["marketing-costs"], enabled: roles.isOwner, queryFn: async () => {
    const { data, error } = await supabase.from("expenses").select("*").not("campaign_id", "is", null).order("entry_date", { ascending: false });
    if (error) throw error;
    return data ?? [];
  } });
  const analyticsQ = useQuery({ queryKey: ["platform-analytics"], enabled: roles.isMarketing, queryFn: async () => {
    const { data, error } = await supabase.from("platform_analytics").select("*").order("snapshot_date", { ascending: false });
    if (error) throw error;
    return data ?? [];
  } });
  const socialQ = useQuery({ queryKey: ["social-links"], enabled: roles.isMarketing, queryFn: async () => {
    const { data, error } = await supabase.from("app_settings").select("list_options").eq("id", true).maybeSingle();
    if (error) throw error;
    return (((data?.list_options as any)?.social_links) ?? []) as { platform: string; url: string }[];
  } });
  const saveSocial = useMutation({ mutationFn: async (links: { platform: string; url: string }[]) => {
    const { data: cur, error: e1 } = await supabase.from("app_settings").select("list_options").eq("id", true).maybeSingle();
    if (e1) throw e1;
    const { error } = await supabase.from("app_settings").update({ list_options: { ...((cur?.list_options as any) ?? {}), social_links: links }, updated_at: new Date().toISOString() } as never).eq("id", true);
    if (error) throw error;
  }, onSuccess: () => { toast.success(t("saved")); void qc.invalidateQueries({ queryKey: ["social-links"] }); },
    onError: (e: Error) => toast.error(e.message) });
  const saveSnap = useMutation({ mutationFn: async (payload: Record<string, unknown>) => {
    const { error } = editingSnap
      ? await supabase.from("platform_analytics").update(payload as never).eq("id", editingSnap.id)
      : await supabase.from("platform_analytics").insert(payload as never);
    if (error) throw error;
  }, onSuccess: () => { toast.success(t("saved")); setSnapOpen(false); setEditingSnap(null); void qc.invalidateQueries({ queryKey: ["platform-analytics"] }); },
    onError: (e: Error) => toast.error(e.message) });
  const refreshCosts = () => {
    for (const key of ["marketing-costs", "shared-expenses", "expenses", "partner-transactions", "partner-ledger", "month-statement", "audit-log"]) void qc.invalidateQueries({ queryKey: [key] });
  };
  const saveCost = useMutation({ mutationFn: async (v: { e: Record<string, unknown>; splits: { partner_id: string; percent: number }[] }) => {
    const { error } = await supabase.rpc("save_shared_expense", { _id: null, _e: v.e, _splits: v.splits } as never);
    if (error) throw error;
  }, onSuccess: () => { toast.success(t("saved")); setCostCampaign(null); refreshCosts(); },
    onError: (e: Error) => toast.error(e.message.includes("SPLIT_NOT_100") ? t("splitMust100") : e.message) });
  const remove = useMutation({ mutationFn: async (v: { table: "content_calendar" | "campaigns" | "expenses" | "platform_analytics"; id: string }) => {
    const { error } = await supabase.from(v.table).delete().eq("id", v.id);
    if (error) throw error;
  }, onSuccess: () => { toast.success(t("deleted")); setDeleting(null); void qc.invalidateQueries({ queryKey: ["content"] }); void qc.invalidateQueries({ queryKey: ["campaigns"] }); void qc.invalidateQueries({ queryKey: ["platform-analytics"] }); refreshCosts(); }, onError: (e: Error) => toast.error(e.message) });
  const partnerName = (id: string | null) => tt((partnersQ.data ?? []).find((p) => p.id === id)?.name ?? "—");

  const addPost = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { error } = editingPost ? await supabase.from("content_calendar").update(payload as never).eq("id", editingPost.id) : await supabase.from("content_calendar").insert(payload as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("saved"));
      setPostOpen(false);
      qc.invalidateQueries({ queryKey: ["content"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addCampaign = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { error } = editingCampaign ? await supabase.from("campaigns").update(payload as never).eq("id", editingCampaign.id) : await supabase.from("campaigns").insert(payload as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("saved"));
      setCampaignOpen(false);
      qc.invalidateQueries({ queryKey: ["campaigns"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updatePost = useMutation({
    mutationFn: async (v: { id: string; status: string }) => {
      const { error } = await supabase.from("content_calendar").update({ status: v.status }).eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["content"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  if (!roles.isLoading && !roles.isMarketing) {
    return <AccessDenied message={tt("Marketing is available to Owner and Marketing roles.")} />;
  }

  const productName = (id: string | null) =>
    (productsQ.data ?? []).find((p: any) => p.id === id)?.[lang === "ar" ? "name_ar" : "name"] || (productsQ.data ?? []).find((p: any) => p.id === id)?.name || "—";

  return (
    <div>
      <PageHeader title={tt("Marketing")} description={tt("Content calendar and campaign tracking.")} />
      {[contentQ.error, campaignsQ.error, channelsQ.error, partnersQ.error].filter(Boolean).map((error, i) => <p key={i} className="mb-3 text-sm text-destructive">{error?.message}</p>)}

      <Tabs defaultValue="content">
        <TabsList>
          <TabsTrigger value="content">{tt("Content calendar")}</TabsTrigger>
          <TabsTrigger value="campaigns">{tt("Campaigns")}</TabsTrigger>
          <TabsTrigger value="analytics">{tt("Platform Analytics")}</TabsTrigger>
          <TabsTrigger value="accounts">{t("mk_accounts")}</TabsTrigger>
        </TabsList>

        <TabsContent value="content" className="mt-4">
          <div className="mb-4">
            <Button onClick={() => { setEditingPost(null); setPostOpen(true); }}>{tt("Plan a post")}</Button>
          </div>
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tt("Date")}</TableHead>
                    <TableHead>{tt("Title")}</TableHead>
                    <TableHead>{tt("Platform")}</TableHead>
                    <TableHead>{tt("Product")}</TableHead>
                    <TableHead>{tt("Status")}</TableHead>
                    <TableHead>{t("actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(contentQ.data ?? []).map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell>{formatDate(c.scheduled_date)}</TableCell>
                      <TableCell className="rtl-content font-medium">{c.title}</TableCell>
                      <TableCell>{tt(c.platform)}</TableCell>
                      <TableCell>{productName(c.product_id)}</TableCell>
                      <TableCell>
                        <select
                          value={c.status}
                           aria-label={t("status")}
                          onChange={(e) => updatePost.mutate({ id: c.id, status: e.target.value })}
                          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                        >
                          {CONTENT_STATUS.map((s) => (
                            <option key={s} value={s}>
                              {t(`mk_status_${s}`)}
                            </option>
                          ))}
                        </select>
                      </TableCell>
                      <TableCell><div className="flex gap-1">
                        {c.status !== "posted" && (
                          <Button size="icon" variant="ghost" aria-label={t("mk_markPosted")} title={t("mk_markPosted")} onClick={() => updatePost.mutate({ id: c.id, status: "posted" })}><Check className="size-4" /></Button>
                        )}
                        <Button size="icon" variant="ghost" aria-label={t("edit")} onClick={() => { setEditingPost(c); setPostOpen(true); }}><Pencil className="size-4" /></Button>
                        <Button size="icon" variant="ghost" aria-label={t("delete")} onClick={() => setDeleting({ table: "content_calendar", id: c.id })}><Trash2 className="size-4" /></Button>
                      </div></TableCell>
                    </TableRow>
                  ))}
                  {(contentQ.data ?? []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        {tt("Nothing planned yet.")}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="campaigns" className="mt-4">
          <div className="mb-4">
            <Button onClick={() => { setEditingCampaign(null); setCampaignOpen(true); }}>{tt("New campaign")}</Button>
          </div>
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tt("Campaign")}</TableHead>
                    <TableHead>{tt("Platform")}</TableHead>
                    <TableHead>{tt("Dates")}</TableHead>
                    <TableHead>{tt("Product")}</TableHead>
                    <TableHead className="text-end">{tt("Budget")}</TableHead>
                    <TableHead>{tt("Status")}</TableHead>
                    <TableHead>{t("actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(campaignsQ.data ?? []).map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>{tt(c.platform)}</TableCell>
                      <TableCell>
                        {formatDate(c.start_date)} → {formatDate(c.end_date)}
                      </TableCell>
                      <TableCell>{productName(c.product_id)}</TableCell>
                      <TableCell className="text-end tabular-nums">{fmtMoney(c.budget, base)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{t(`mk_status_${c.status}`)}</Badge>
                      </TableCell>
                      <TableCell><div className="flex gap-1">
                        <Button size="icon" variant="ghost" aria-label={t("edit")} onClick={() => { setEditingCampaign(c); setCampaignOpen(true); }}><Pencil className="size-4" /></Button>
                        <Button size="icon" variant="ghost" aria-label={t("delete")} onClick={() => setDeleting({ table: "campaigns", id: c.id })}><Trash2 className="size-4" /></Button>
                      </div></TableCell>
                    </TableRow>
                  ))}
                  {(campaignsQ.data ?? []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        {tt("No campaigns yet.")}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          {roles.isOwner && <div className="mt-6 space-y-6">
            {costsQ.error && <p className="text-destructive">{costsQ.error.message}</p>}
            {(campaignsQ.data ?? []).map((c) => {
              const costs = (costsQ.data ?? []).filter((e) => e.campaign_id === c.id);
              const spent = costs.reduce((sum, e) => sum + Number(e.base_amount ?? 0), 0);
              return <section key={c.id} className="border-t pt-4">
                <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">{c.name}</h3>
                  <Button size="sm" onClick={() => setCostCampaign(c)}><Plus className="size-4" />{t("mk_addCost")}</Button></div>
                <p className="my-3 text-sm text-muted-foreground">{t("mk_spent")}: {fmtMoney(spent, base)} / {t("Budget")}: {fmtMoney(c.budget, base)} · {t("mk_remaining")}: {fmtMoney(Number(c.budget) - spent, base)}</p>
                <Table><TableHeader><TableRow>{["date", "description", "amount", "paidBy", "receiptOptional", "actions"].map((k) => <TableHead key={k}>{t(k)}</TableHead>)}</TableRow></TableHeader><TableBody>
                  {costs.map((e) => <TableRow key={e.id}><TableCell>{formatDate(e.entry_date)}</TableCell><TableCell>{e.description}</TableCell>
                    <TableCell className="tabular-nums">{fmtMoney(e.base_amount, base)}<div className="text-xs text-muted-foreground">{fmtMoney(e.amount, e.currency)} · {e.fx_rate_to_base}</div></TableCell>
                    <TableCell>{e.paid_by_business ? t("businessAccount") : partnerName(e.paid_by_partner_id)}</TableCell>
                    <TableCell>{e.receipt_path ? <Button variant="ghost" size="sm" onClick={() => openReceipt(e.receipt_path ?? "")}>{t("viewReceipt")}</Button> : t("noReceipt")}</TableCell>
                    <TableCell><Button variant="ghost" size="icon" aria-label={t("delete")} onClick={() => setDeleting({ table: "expenses", id: e.id })}><Trash2 className="size-4" /></Button></TableCell></TableRow>)}
                  {!costs.length && <TableRow><TableCell colSpan={6} className="text-muted-foreground">{t("mk_noCosts")}</TableCell></TableRow>}
                </TableBody></Table>
              </section>;
            })}
          </div>}
        </TabsContent>

        <TabsContent value="analytics" className="mt-4">
          <AnalyticsTab
            rows={(analyticsQ.data ?? []) as any[]}
            error={analyticsQ.error}
            base={base}
            channels={channels}
            onAdd={() => { setEditingSnap(null); setSnapOpen(true); }}
            onEdit={(s) => { setEditingSnap(s); setSnapOpen(true); }}
            onDelete={(id) => setDeleting({ table: "platform_analytics", id })}
          />
        </TabsContent>

        <TabsContent value="accounts" className="mt-4">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <form
                className="flex flex-wrap items-end gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const f = new FormData(form);
                  const platform = String(f.get("platform") || "").trim();
                  const url = String(f.get("url") || "").trim();
                  if (!platform || !url) return;
                  saveSocial.mutate([...(socialQ.data ?? []), { platform, url }]);
                  form.reset();
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="s-platform">{tt("Platform")}</Label>
                  <Input id="s-platform" name="platform" required placeholder="Instagram" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="s-url">{t("mk_accountUrl")}</Label>
                  <Input id="s-url" name="url" type="url" required placeholder="https://instagram.com/..." className="min-w-64" dir="ltr" />
                </div>
                <Button type="submit" disabled={saveSocial.isPending}>{t("mk_addAccount")}</Button>
              </form>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tt("Platform")}</TableHead>
                    <TableHead>{t("mk_accountUrl")}</TableHead>
                    <TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(socialQ.data ?? []).map((s, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Input
                          defaultValue={s.platform}
                          onBlur={(e) => {
                            const v = e.target.value.trim();
                            if (v && v !== s.platform) saveSocial.mutate((socialQ.data ?? []).map((x, j) => (j === i ? { ...x, platform: v } : x)));
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Input
                            dir="ltr"
                            defaultValue={s.url}
                            onBlur={(e) => {
                              const v = e.target.value.trim();
                              if (v && v !== s.url) saveSocial.mutate((socialQ.data ?? []).map((x, j) => (j === i ? { ...x, url: v } : x)));
                            }}
                          />
                          <Button size="icon" variant="ghost" aria-label={t("mk_accountUrl")} onClick={() => window.open(s.url, "_blank", "noopener")}>
                            <ExternalLink className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" aria-label={t("delete")} onClick={() => saveSocial.mutate((socialQ.data ?? []).filter((_, j) => j !== i))}>
                          <Trash2 className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(socialQ.data ?? []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">{t("mk_noAccounts")}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={snapOpen} onOpenChange={setSnapOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSnap ? t("pa_editSnapshot") : t("pa_addSnapshot")}</DialogTitle>
          </DialogHeader>
          <form
            key={editingSnap?.id ?? "new-snap"}
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              saveSnap.mutate({
                platform: String(f.get("platform")),
                snapshot_date: String(f.get("snapshot_date")),
                views: Number(f.get("views") || 0),
                product_views: Number(f.get("product_views") || 0),
                orders: Number(f.get("orders") || 0),
                revenue: Number(f.get("revenue") || 0),
                ad_spend: Number(f.get("ad_spend") || 0),
                notes: String(f.get("notes") || "") || null,
              });
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="a-platform">{tt("Platform")}</Label>
                <select
                  id="a-platform"
                  defaultValue={editingSnap?.platform ?? channels[0]}
                  name="platform"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {channels.map((p) => (
                    <option key={p} value={p}>{tt(p)}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="a-date">{t("pa_weekOf")}</Label>
                <Input id="a-date" name="snapshot_date" type="date" defaultValue={editingSnap?.snapshot_date ?? today} required />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="a-views">{tt("Views")}</Label>
                <Input id="a-views" name="views" type="number" min={0} defaultValue={editingSnap?.views ?? 0} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="a-pviews">{t("pa_productViews")}</Label>
                <Input id="a-pviews" name="product_views" type="number" min={0} defaultValue={editingSnap?.product_views ?? 0} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="a-orders">{tt("Orders")}</Label>
                <Input id="a-orders" name="orders" type="number" min={0} defaultValue={editingSnap?.orders ?? 0} required />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="a-revenue">{tt("Revenue")} ({base})</Label>
                <Input id="a-revenue" name="revenue" type="number" min={0} step="0.01" defaultValue={editingSnap?.revenue ?? 0} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="a-adspend">{t("pa_adSpend")} ({base})</Label>
                <Input id="a-adspend" name="ad_spend" type="number" min={0} step="0.01" defaultValue={editingSnap?.ad_spend ?? 0} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="a-notes">{tt("Notes")}</Label>
              <Textarea id="a-notes" name="notes" defaultValue={editingSnap?.notes ?? ""} />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={saveSnap.isPending}>{tt("Save")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={postOpen} onOpenChange={setPostOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPost ? t("mk_editPost") : tt("Plan a post")}</DialogTitle>
          </DialogHeader>
          <form
            key={editingPost?.id ?? "new-post"}
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              addPost.mutate({
                title: String(f.get("title")),
                platform: String(f.get("platform")),
                scheduled_date: String(f.get("scheduled_date")),
                product_id: String(f.get("product_id") || "") || null,
                status: String(f.get("status")),
                notes: String(f.get("notes") || "") || null,
              });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="c-title">{tt("Title")}</Label>
              <Input id="c-title" name="title" defaultValue={editingPost?.title ?? ""} required />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="c-platform">{tt("Platform")}</Label>
                <select
                  id="c-platform"
                   defaultValue={editingPost?.platform ?? channels[0]}
                  name="platform"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {channels.map((p) => (
                    <option key={p} value={p}>
                      {tt(p)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-date">{tt("Date")}</Label>
                <Input id="c-date" name="scheduled_date" type="date" defaultValue={editingPost?.scheduled_date ?? today} required />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="c-product">{tt("Product")}</Label>
                <select
                  id="c-product"
                   defaultValue={editingPost?.product_id ?? ""}
                  name="product_id"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">{tt("None")}</option>
                  {(productsQ.data ?? []).map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-status">{tt("Status")}</Label>
                <select
                  id="c-status"
                   defaultValue={editingPost?.status ?? CONTENT_STATUS[0]}
                  name="status"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {CONTENT_STATUS.map((s) => (
                    <option key={s} value={s}>
                      {t(`mk_status_${s}`)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-notes">{tt("Notes")}</Label>
              <Textarea id="c-notes" name="notes" defaultValue={editingPost?.notes ?? ""} />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={addPost.isPending}>{tt("Save")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={campaignOpen} onOpenChange={setCampaignOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCampaign ? t("mk_editCampaign") : tt("New campaign")}</DialogTitle>
          </DialogHeader>
          <form
            key={editingCampaign?.id ?? "new-campaign"}
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              addCampaign.mutate({
                name: String(f.get("name")),
                platform: String(f.get("platform")),
                budget: Number(f.get("budget") || 0),
                start_date: String(f.get("start_date") || "") || null,
                end_date: String(f.get("end_date") || "") || null,
                product_id: String(f.get("product_id") || "") || null,
                status: String(f.get("status")),
                notes: String(f.get("notes") || "") || null,
              });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="k-name">{tt("Name")}</Label>
              <Input id="k-name" name="name" defaultValue={editingCampaign?.name ?? ""} required />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="k-platform">{tt("Platform")}</Label>
                <select
                  id="k-platform"
                   defaultValue={editingCampaign?.platform ?? channels[0]}
                  name="platform"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {channels.map((p) => (
                    <option key={p} value={p}>
                      {tt(p)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="k-budget">{tt("Budget")}</Label>
                <Input id="k-budget" name="budget" type="number" step="0.01" min="0" required defaultValue={editingCampaign?.budget ?? 0} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="k-start">{tt("Start")}</Label>
                <Input id="k-start" name="start_date" type="date" defaultValue={editingCampaign?.start_date ?? today} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="k-end">{tt("End")}</Label>
                <Input id="k-end" name="end_date" type="date" defaultValue={editingCampaign?.end_date ?? ""} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="k-product">{tt("Product")}</Label>
                <select
                  id="k-product"
                   defaultValue={editingCampaign?.product_id ?? ""}
                  name="product_id"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">{tt("None")}</option>
                  {(productsQ.data ?? []).map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="k-status">{tt("Status")}</Label>
                <select
                  id="k-status"
                   defaultValue={editingCampaign?.status ?? CAMPAIGN_STATUS[0]}
                  name="status"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {CAMPAIGN_STATUS.map((s) => (
                    <option key={s} value={s}>
                      {t(`mk_status_${s}`)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2"><Label htmlFor="k-notes">{t("notes")}</Label><Textarea id="k-notes" name="notes" defaultValue={editingCampaign?.notes ?? ""} /></div>
            <DialogFooter>
              <Button type="submit" disabled={addCampaign.isPending}>{tt("Save")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDelete open={Boolean(deleting)} onOpenChange={(open) => { if (!open) setDeleting(null); }} onConfirm={() => { if (deleting && !remove.isPending) remove.mutate(deleting); }} />
      <Dialog open={Boolean(costCampaign)} onOpenChange={(open) => { if (!open) setCostCampaign(null); }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>{t("mk_addCost")} · {costCampaign?.name}</DialogTitle></DialogHeader>
          {costCampaign && <CampaignCostForm partners={(partnersQ.data ?? []).filter((p) => p.active)} pending={saveCost.isPending} onSave={(e, splits) => saveCost.mutate({ e: { ...e, category: "marketing", campaign_id: costCampaign.id }, splits })} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CampaignCostForm({ partners, pending, onSave }: { partners: { id: string; name: string }[]; pending: boolean; onSave: (e: Record<string, unknown>, splits: { partner_id: string; percent: number }[]) => void }) {
  const { t } = useI18n();
  const [mode, setMode] = useState("equal");
  const [values, setValues] = useState<Record<string, string>>({});
  const total = partners.reduce((sum, p) => sum + Number(values[p.id] || 0), 0);
  return <form className="space-y-4" onSubmit={(ev) => {
    ev.preventDefault();
    const f = new FormData(ev.currentTarget);
    if (!partners.length || (mode === "percent" && Math.abs(total - 100) > 0.01)) return void toast.error(t("splitMust100"));
    const each = Math.floor(10000 / partners.length) / 100;
    const splits = partners.map((p, i) => ({ partner_id: p.id, percent: mode === "equal" ? (i === partners.length - 1 ? Math.round((100 - each * (partners.length - 1)) * 100) / 100 : each) : Number(values[p.id] || 0) }));
    const payer = String(f.get("payer") || "");
    onSave({ ...readMoney(f), entry_date: String(f.get("entry_date")), description: String(f.get("description") || ""), paid_by_business: payer === "business", paid_by_partner_id: payer === "business" ? null : payer, split_mode: mode, receipt_path: String(f.get("receipt_path") || "") || null }, splits);
  }}>
    <div className="space-y-2"><Label htmlFor="mc-date">{t("date")}</Label><Input id="mc-date" name="entry_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></div>
    <div className="space-y-2"><Label htmlFor="mc-description">{t("description")}</Label><Input id="mc-description" name="description" required /></div>
    <MoneyFields idPrefix="mc" />
    <div className="space-y-2"><Label htmlFor="mc-payer">{t("paidBy")}</Label><select id="mc-payer" name="payer" defaultValue="" required className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="" disabled>{t("choosePayer")}</option>{partners.map((p) => <option key={p.id} value={p.id}>{tt(p.name)}</option>)}<option value="business">{t("businessAccount")}</option></select></div>
    <fieldset className="space-y-3 rounded-md border p-3"><legend>{t("split")}</legend><div className="flex gap-2">{["equal", "percent"].map((m) => <Button key={m} type="button" size="sm" variant={mode === m ? "default" : "outline"} onClick={() => setMode(m)}>{t(`split_${m}`)}</Button>)}</div>
      {partners.map((p) => <div key={p.id} className="flex items-center justify-between gap-3"><Label htmlFor={`mc-${p.id}`}>{tt(p.name)}</Label>{mode === "equal" ? <span>{(100 / partners.length).toFixed(2)}%</span> : <Input id={`mc-${p.id}`} type="number" min="0" max="100" step="0.01" required className="w-28" value={values[p.id] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [p.id]: e.target.value }))} />}</div>)}
      {mode === "percent" && <p className="text-sm">{t("total")}: {total.toFixed(2)}%</p>}
    </fieldset>
    <ReceiptUpload idPrefix="mc" />
    <DialogFooter><Button type="submit" disabled={pending || !partners.length}>{t("save")}</Button></DialogFooter>
  </form>;
}

function AnalyticsTab({
  rows,
  error,
  base,
  channels,
  onAdd,
  onEdit,
  onDelete,
}: {
  rows: any[];
  error: Error | null;
  base: string;
  channels: string[];
  onAdd: () => void;
  onEdit: (s: any) => void;
  onDelete: (id: string) => void;
}) {
  const { t } = useI18n();

  const byPlatform = channels
    .map((platform) => {
      const pr = rows.filter((r) => r.platform === platform);
      if (!pr.length) return null;
      const views = pr.reduce((s, r) => s + Number(r.views), 0);
      const orders = pr.reduce((s, r) => s + Number(r.orders), 0);
      const revenue = pr.reduce((s, r) => s + Number(r.revenue), 0);
      const adSpend = pr.reduce((s, r) => s + Number(r.ad_spend), 0);
      const roas = adSpend > 0 ? revenue / adSpend : null;
      return { platform, views, orders, revenue, adSpend, roas };
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x));

  const totals = rows.reduce(
    (acc, r) => ({
      views: acc.views + Number(r.views),
      orders: acc.orders + Number(r.orders),
      revenue: acc.revenue + Number(r.revenue),
      adSpend: acc.adSpend + Number(r.ad_spend),
    }),
    { views: 0, orders: 0, revenue: 0, adSpend: 0 },
  );

  const best = byPlatform
    .filter((p) => p.roas !== null)
    .sort((a, b) => (b.roas ?? 0) - (a.roas ?? 0))[0];

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-destructive">{error.message}</p>}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t("pa_hint")}</p>
        <Button onClick={onAdd}>
          <Plus className="size-4" /> {t("pa_addSnapshot")}
        </Button>
      </div>

      {byPlatform.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {byPlatform.map((p) => (
            <Card key={p.platform} className={best?.platform === p.platform ? "border-primary" : undefined}>
              <CardContent className="space-y-2 pt-5">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{tt(p.platform)}</span>
                  {best?.platform === p.platform && <Badge>{t("pa_bestValue")}</Badge>}
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">{tt("Views")}</div>
                    <div className="tabular-nums">{p.views.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">{tt("Orders")}</div>
                    <div className="tabular-nums">{p.orders.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">{tt("Revenue")}</div>
                    <div className="tabular-nums">{fmtMoney(p.revenue, base)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">{t("pa_adSpend")}</div>
                    <div className="tabular-nums">{fmtMoney(p.adSpend, base)}</div>
                  </div>
                </div>
                <div className="border-t pt-2 text-sm">
                  <span className="text-muted-foreground">{t("pa_roas")}: </span>
                  <span className="font-medium">{p.roas === null ? "—" : `${p.roas.toFixed(2)}×`}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {rows.length > 0 && (
        <Card>
          <CardContent className="pt-5">
            <div className="mb-2 text-xs uppercase text-muted-foreground">{t("pa_totals")}</div>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <span>{tt("Views")}: <strong className="tabular-nums">{totals.views.toLocaleString()}</strong></span>
              <span>{tt("Orders")}: <strong className="tabular-nums">{totals.orders.toLocaleString()}</strong></span>
              <span>{tt("Revenue")}: <strong className="tabular-nums">{fmtMoney(totals.revenue, base)}</strong></span>
              <span>{t("pa_adSpend")}: <strong className="tabular-nums">{fmtMoney(totals.adSpend, base)}</strong></span>
              <span>
                {t("pa_roas")}:{" "}
                <strong className="tabular-nums">
                  {totals.adSpend > 0 ? `${(totals.revenue / totals.adSpend).toFixed(2)}×` : "—"}
                </strong>
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("pa_weekOf")}</TableHead>
                <TableHead>{tt("Platform")}</TableHead>
                <TableHead className="text-end">{tt("Views")}</TableHead>
                <TableHead className="text-end">{tt("Orders")}</TableHead>
                <TableHead className="text-end">{tt("Revenue")}</TableHead>
                <TableHead className="text-end">{t("pa_adSpend")}</TableHead>
                <TableHead className="text-end">{t("pa_roas")}</TableHead>
                <TableHead>{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{formatDate(r.snapshot_date)}</TableCell>
                  <TableCell>{tt(r.platform)}</TableCell>
                  <TableCell className="text-end tabular-nums">{Number(r.views).toLocaleString()}</TableCell>
                  <TableCell className="text-end tabular-nums">{r.orders}</TableCell>
                  <TableCell className="text-end tabular-nums">{fmtMoney(r.revenue, base)}</TableCell>
                  <TableCell className="text-end tabular-nums">{fmtMoney(r.ad_spend, base)}</TableCell>
                  <TableCell className="text-end tabular-nums">
                    {Number(r.ad_spend) > 0 ? `${(Number(r.revenue) / Number(r.ad_spend)).toFixed(2)}×` : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" aria-label={t("edit")} onClick={() => onEdit(r)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button size="icon" variant="ghost" aria-label={t("delete")} onClick={() => onDelete(r.id)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    {t("pa_noData")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
