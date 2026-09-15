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
  const qc = useQueryClient();
  const [productOpen, setProductOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const productsQ = useQuery({
    queryKey: ["settings-products"],
    enabled: roles.isOperations,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, categories(name)")
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
      toast.success("Product saved");
      setProductOpen(false);
      setEditing(null);
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
      toast.success("Category added");
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
      toast.success("Fee updated");
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
      toast.success("Role updated");
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader title="Settings" description="Catalog, categories, platform fees and team roles." />

      <Tabs defaultValue="products">
        <TabsList>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="fees">Platform fees</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="mt-4">
          {roles.isOperations ? (
            <>
              <div className="mb-4">
                <Button
                  onClick={() => {
                    setEditing(null);
                    setProductOpen(true);
                  }}
                >
                  Add product
                </Button>
              </div>
              <Card>
                <CardContent className="pt-6">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>SKU</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Cost</TableHead>
                        <TableHead className="text-right">Sale</TableHead>
                        <TableHead className="text-right">Reorder at</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(productsQ.data ?? []).map((p: any) => (
                        <TableRow key={p.id} className={p.archived ? "opacity-50" : ""}>
                          <TableCell>{p.sku}</TableCell>
                          <TableCell>
                            <p className="font-medium">{p.name}</p>
                            {p.name_ar && <p className="rtl-content text-xs text-muted-foreground">{p.name_ar}</p>}
                          </TableCell>
                          <TableCell>{p.categories?.name ?? "—"}</TableCell>
                          <TableCell className="text-right tabular-nums">{money(p.cost_price)}</TableCell>
                          <TableCell className="text-right tabular-nums">{money(p.sale_price)}</TableCell>
                          <TableCell className="text-right tabular-nums">{p.reorder_threshold}</TableCell>
                          <TableCell className="space-x-2 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditing(p);
                                setProductOpen(true);
                              }}
                            >
                              Edit
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => toggleArchive.mutate(p)}>
                              {p.archived ? "Restore" : "Archive"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {(productsQ.data ?? []).length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground">
                            No products yet.
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
              The product catalog is managed by Owner and Operations roles.
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
                    <Label htmlFor="cat-name">Name</Label>
                    <Input id="cat-name" name="name" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cat-ar">Arabic name</Label>
                    <Input id="cat-ar" name="name_ar" className="rtl-content" />
                  </div>
                  <Button type="submit">Add</Button>
                </form>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Arabic</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(categoriesQ.data ?? []).map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell>{c.name}</TableCell>
                      <TableCell className="rtl-content">{c.name_ar ?? "—"}</TableCell>
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
                    <TableHead>Platform</TableHead>
                    <TableHead>Fee %</TableHead>
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
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
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
                              No role
                            </option>
                            {ROLES.map((r) => (
                              <option key={r} value={r}>
                                {ROLE_LABELS[r]}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <Badge variant="secondary">
                            {p.roles[0] ? ROLE_LABELS[p.roles[0] as AppRole] : "No role"}
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
      </Tabs>

      <Dialog open={productOpen} onOpenChange={setProductOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit product" : "Add product"}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              saveProduct.mutate({
                sku: String(f.get("sku")),
                name: String(f.get("name")),
                name_ar: String(f.get("name_ar") || "") || null,
                description: String(f.get("description") || "") || null,
                category_id: String(f.get("category_id") || "") || null,
                cost_price: Number(f.get("cost_price") || 0),
                sale_price: Number(f.get("sale_price") || 0),
                reorder_threshold: Number(f.get("reorder_threshold") || 0),
              });
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pr-sku">SKU</Label>
                <Input id="pr-sku" name="sku" defaultValue={editing?.sku ?? ""} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pr-cat">Category</Label>
                <select
                  id="pr-cat"
                  name="category_id"
                  defaultValue={editing?.category_id ?? ""}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">None</option>
                  {(categoriesQ.data ?? []).map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pr-name">Name</Label>
              <Input id="pr-name" name="name" defaultValue={editing?.name ?? ""} required />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="pr-cost">Cost price</Label>
                <Input
                  id="pr-cost"
                  name="cost_price"
                  type="number"
                  step="0.01"
                  defaultValue={editing?.cost_price ?? 0}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pr-sale">Sale price</Label>
                <Input
                  id="pr-sale"
                  name="sale_price"
                  type="number"
                  step="0.01"
                  defaultValue={editing?.sale_price ?? 0}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pr-reorder">Reorder at</Label>
                <Input
                  id="pr-reorder"
                  name="reorder_threshold"
                  type="number"
                  defaultValue={editing?.reorder_threshold ?? 0}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pr-desc">Description</Label>
              <Textarea id="pr-desc" name="description" defaultValue={editing?.description ?? ""} />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={saveProduct.isPending}>Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
