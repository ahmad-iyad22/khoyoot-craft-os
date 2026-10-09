import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ROLE_LABELS, useRoles, type AppRole } from "@/lib/auth";
import { PageHeader } from "@/components/app-shell";
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
import { money } from "@/lib/format";
import { useI18n , tt } from "@/lib/i18n";
import { ChangePasswordCard } from "@/components/change-password";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Khoyoot" },
      { name: "description", content: "Product catalog, categories, platform fees and team roles." },
      { property: "og:title", content: "Settings — Khoyoot" },
      { property: "og:description", content: "Product catalog, categories, platform fees and team roles." },
    ],
  }),
  component: SettingsPage,
});

const ROLES: AppRole[] = ["owner", "operations", "marketing"];

function SettingsPage() {
  const roles = useRoles();
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const [productOpen, setProductOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [newSku, setNewSku] = useState("");

  async function previewSku(categoryId: string) {
    const cat = (categoriesQ.data ?? []).find((c: any) => c.id === categoryId);
    if (!cat?.prefix_code) {
      setNewSku("");
      return;
    }
    const { data } = await supabase.rpc("next_sku_preview", { _code: cat.prefix_code });
    setNewSku(typeof data === "string" ? data : "");
  }

  const productsQ = useQuery({
    queryKey: ["settings-products"],
    enabled: roles.isOperations,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, categories(name, name_ar)")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const categoriesQ = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const feesQ = useQuery({
    queryKey: ["platform-fees"],
    queryFn: async () => {
      const { data, error } = await supabase.from("platform_fees").select("*").order("platform");
      if (error) throw error;
      return data ?? [];
    },
  });

  const peopleQ = useQuery({
    queryKey: ["profiles-roles"],
    queryFn: async () => {
      const [{ data: profiles }, { data: userRoles }] = await Promise.all([
        supabase.from("profiles").select("id, email, full_name").order("email"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      return (profiles ?? []).map((p) => ({
        ...p,
        roles: (userRoles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role as AppRole),
      }));
    },
  });

  const saveProduct = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      if (editing) {
        const { error } = await supabase.from("products").update(payload as never).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert(payload as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(tt("Product saved"));
      setProductOpen(false);
      setEditing(null);
      setNewSku("");
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteProduct = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("deleted"));
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleArchive = useMutation({
    mutationFn: async (p: any) => {
      const { error } = await supabase.from("products").update({ archived: !p.archived }).eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings-products"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const addCategory = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { error } = await supabase.from("categories").insert(payload as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(tt("Category added"));
      qc.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveCategory = useMutation({
    mutationFn: async (v: { id: string; patch: Record<string, unknown> }) => {
      const { error } = await supabase.from("categories").update(v.patch as never).eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(tt("Category updated"));
      qc.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(tt("Category deleted"));
      qc.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveFee = useMutation({
    mutationFn: async (v: { id: string; fee_percent: number }) => {
      const { error } = await supabase
        .from("platform_fees")
        .update({ fee_percent: v.fee_percent })
        .eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(tt("Fee updated"));
      qc.invalidateQueries({ queryKey: ["platform-fees"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setRole = useMutation({
    mutationFn: async (v: { userId: string; role: AppRole }) => {
      const { error: delErr } = await supabase.from("user_roles").delete().eq("user_id", v.userId);
      if (delErr) throw delErr;
      const { error } = await supabase.from("user_roles").insert({ user_id: v.userId, role: v.role });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(tt("Role updated"));
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader title={t("settings")} description={t("settingsSubtitle")} />

      <Tabs defaultValue="products">
        <TabsList>
          <TabsTrigger value="products">{t("products")}</TabsTrigger>
          <TabsTrigger value="categories">{t("categories")}</TabsTrigger>
          <TabsTrigger value="fees">{t("platformFeesTab")}</TabsTrigger>
          <TabsTrigger value="account">{t("account")}</TabsTrigger>
          <TabsTrigger value="team">{t("team")}</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="mt-4">
          {roles.isOperations ? (
            <>
              <div className="mb-4">
                <Button
                  onClick={() => {
                    setEditing(null);
                    setNewSku("");
                    setProductOpen(true);
                  }}
                >
                  {t("addProduct")}
                </Button>
              </div>
              <Card>
                <CardContent className="pt-6">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("sku")}</TableHead>
                        <TableHead>{t("name")}</TableHead>
                        <TableHead>{t("category")}</TableHead>
                        <TableHead className="text-right">{t("cost")}</TableHead>
                        <TableHead className="text-right">{t("sellingPrice")}</TableHead>
                        <TableHead className="text-right">{t("reorderThreshold")}</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(productsQ.data ?? []).map((p: any) => (
                        <TableRow key={p.id} className={p.archived ? "opacity-50" : ""}>
                          <TableCell>{p.sku}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              {p.image_url ? (
                                <img src={p.image_url} alt={p.name} className="h-9 w-9 rounded-md border object-cover" />
                              ) : (
                                <div className="h-9 w-9 rounded-md border bg-muted" />
                              )}
                              <p className="font-medium">{p.name}</p>
                            </div>
                          </TableCell>
                          <TableCell>{(lang === "ar" ? p.categories?.name_ar || p.categories?.name : p.categories?.name) ?? "—"}</TableCell>
                          <TableCell className="text-right tabular-nums">{money(p.cost_price)}</TableCell>
                          <TableCell className="text-right tabular-nums">{money(p.sale_price)}</TableCell>
                          <TableCell className="text-right tabular-nums">{p.reorder_threshold}</TableCell>
                          <TableCell className="space-x-2 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditing(p);
                                setNewSku("");
                                setProductOpen(true);
                              }}
                            >
                              {t("edit")}
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => toggleArchive.mutate(p)}>
                              {p.archived ? t("restore") : t("archive")}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive"
                              onClick={() => {
                                if (confirm(t("deleteProductConfirm").replace("{name}", p.name)))
                                  deleteProduct.mutate(p.id);
                              }}
                            >
                              {t("delete")}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {(productsQ.data ?? []).length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground">
                            {t("none")}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("catalogRestricted")}
            </p>
          )}
        </TabsContent>

        <TabsContent value="categories" className="mt-4">
          <Card>
            <CardContent className="space-y-4 pt-6">
              {roles.isOperations && (
                <form
                  className="flex flex-wrap items-end gap-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = e.currentTarget;
                    const f = new FormData(form);
                    addCategory.mutate({
                      name: String(f.get("name")),
                      name_ar: String(f.get("name_ar") || "") || null,
                    });
                    form.reset();
                  }}
                >
                  <div className="space-y-2">
                    <Label htmlFor="cat-name">{t("name")}</Label>
                    <Input id="cat-name" name="name" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cat-ar">{t("arabicName")}</Label>
                    <Input id="cat-ar" name="name_ar" className="rtl-content" />
                  </div>
                  <Button type="submit">{t("add")}</Button>
                </form>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("name")}</TableHead>
                    <TableHead>{t("arabicName")}</TableHead>
                    {roles.isOperations && <TableHead className="w-24" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(categoriesQ.data ?? []).map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        {roles.isOperations ? (
                          <Input
                            defaultValue={lang === "ar" ? c.name_ar || c.name : c.name}
                            onBlur={(e) => {
                              const value = e.target.value.trim();
                              if (value && value !== c.name)
                                saveCategory.mutate({ id: c.id, patch: { name: value } });
                            }}
                          />
                        ) : (
                          c.name
                        )}
                      </TableCell>
                      <TableCell>
                        {roles.isOperations ? (
                          <Input
                            className="rtl-content"
                            defaultValue={c.name_ar ?? ""}
                            onBlur={(e) => {
                              const value = e.target.value.trim();
                              if (value !== (c.name_ar ?? ""))
                                saveCategory.mutate({ id: c.id, patch: { name_ar: value || null } });
                            }}
                          />
                        ) : (
                          <span className="rtl-content">{c.name_ar ?? "—"}</span>
                        )}
                      </TableCell>
                      {roles.isOperations && (
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (confirm(t("deleteConfirm"))) deleteCategory.mutate(c.id);
                            }}
                          >
                            {t("delete")}
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>


        <TabsContent value="fees" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("platform")}</TableHead>
                    <TableHead>{t("feePercent")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(feesQ.data ?? []).map((f: any) => (
                    <TableRow key={f.id}>
                      <TableCell>{f.platform}</TableCell>
                      <TableCell>
                        {roles.isOwner ? (
                          <Input
                            type="number"
                            step="0.01"
                            className="w-32"
                            defaultValue={Number(f.fee_percent)}
                            onBlur={(e) =>
                              saveFee.mutate({ id: f.id, fee_percent: Number(e.target.value) })
                            }
                          />
                        ) : (
                          `${Number(f.fee_percent)}%`
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("user")}</TableHead>
                    <TableHead>{t("role")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(peopleQ.data ?? []).map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <p className="font-medium">{p.full_name || p.email}</p>
                        <p className="text-xs text-muted-foreground">{p.email}</p>
                      </TableCell>
                      <TableCell>
                        {roles.isOwner ? (
                          <select
                            value={p.roles[0] ?? ""}
                            onChange={(e) => setRole.mutate({ userId: p.id, role: e.target.value as AppRole })}
                            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                          >
                            <option value="" disabled>
                              {tt("No role")}
                            </option>
                            {ROLES.map((r) => (
                              <option key={r} value={r}>
                                {t(`role_${r}`)}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <Badge variant="secondary">
                            {p.roles[0] ? t(`role_${p.roles[0]}`) : tt("No role")}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="account" className="mt-4">
          <ChangePasswordCard />
        </TabsContent>
      </Tabs>

      <Dialog open={productOpen} onOpenChange={setProductOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? t("editProduct") : t("addProduct")}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const categoryId = String(f.get("category_id") || "") || null;
              let sku = editing ? String(f.get("sku")) : newSku;
              if (!editing && categoryId) {
                const cat = (categoriesQ.data ?? []).find((c: any) => c.id === categoryId);
                if (cat?.prefix_code) {
                  const { data, error } = await supabase.rpc("claim_next_sku", { _code: cat.prefix_code });
                  if (error) {
                    toast.error(error.message);
                    return;
                  }
                  sku = String(data);
                }
              }
              if (!sku) {
                toast.error(t("pickCategory"));
                return;
              }
              saveProduct.mutate({
                sku,
                name: String(f.get("name")),
                name_ar: null,
                description: String(f.get("description") || "") || null,
                notes: String(f.get("notes") || "") || null,
                category_id: String(f.get("category_id") || "") || null,
                cost_price: Number(f.get("cost_price") || 0),
                sale_price: Number(f.get("sale_price") || 0),
                reorder_threshold: Number(f.get("reorder_threshold") || 0),
                image_url: String(f.get("image_url") || "").trim(),
              });
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pr-sku">{t("sku")}</Label>
                {editing ? (
                  <Input id="pr-sku" name="sku" defaultValue={editing.sku} required />
                ) : (
                  <Input
                    id="pr-sku"
                    name="sku"
                    value={newSku}
                    readOnly
                    placeholder={t("pickCategory")}
                    className="bg-muted"
                  />
                )}
                {!editing && newSku && (
                  <p className="text-xs text-muted-foreground">{t("nextCode")}: {newSku}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="pr-cat">{t("category")}</Label>
                <select
                  id="pr-cat"
                  name="category_id"
                  defaultValue={editing?.category_id ?? ""}
                  onChange={(e) => {
                    if (!editing) void previewSku(e.target.value);
                  }}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">—</option>
                  {(categoriesQ.data ?? []).map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {lang === "ar" ? c.name_ar || c.name : c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pr-name">{t("name")}</Label>
              <Input id="pr-name" name="name" defaultValue={editing?.name ?? ""} required />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="pr-cost">{t("cost")}</Label>
                <Input
                  id="pr-cost"
                  name="cost_price"
                  type="number"
                  step="0.01"
                  defaultValue={editing?.cost_price ?? 0}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pr-sale">{t("sellingPrice")}</Label>
                <Input
                  id="pr-sale"
                  name="sale_price"
                  type="number"
                  step="0.01"
                  defaultValue={editing?.sale_price ?? 0}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pr-reorder">{t("reorderThreshold")}</Label>
                <Input
                  id="pr-reorder"
                  name="reorder_threshold"
                  type="number"
                  defaultValue={editing?.reorder_threshold ?? 0}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pr-image">{t("photoUrl")}</Label>
              <Input
                id="pr-image"
                name="image_url"
                type="url"
                placeholder="https://…"
                defaultValue={editing?.image_url ?? ""}
              />
              {editing?.image_url && (
                <img
                  src={editing.image_url}
                  alt={editing.name}
                  className="h-16 w-16 rounded-md border object-cover"
                />
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="pr-desc">{t("description")}</Label>
              <Textarea id="pr-desc" name="description" defaultValue={editing?.description ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pr-notes">{t("notes")}</Label>
              <Textarea id="pr-notes" name="notes" defaultValue={editing?.notes ?? ""} />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={saveProduct.isPending}>{t("save")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
