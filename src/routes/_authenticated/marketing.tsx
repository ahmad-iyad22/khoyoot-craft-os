import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
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
import { formatDate, money, titleCase } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/marketing")({
  head: () => ({
    meta: [
      { title: "Marketing — Khoyoot" },
      { name: "description", content: "Content calendar and campaign tracking for Khoyoot." },
      { property: "og:title", content: "Marketing — Khoyoot" },
      { property: "og:description", content: "Content calendar and campaign tracking for Khoyoot." },
    ],
  }),
  component: MarketingPage,
});

const today = new Date().toISOString().slice(0, 10);
const CONTENT_STATUS = ["idea", "scripted", "posted"];
const CAMPAIGN_STATUS = ["planned", "running", "finished"];
const CHANNELS = ["Instagram", "TikTok", "Facebook", "Shopee", "Lazada"];

function MarketingPage() {
  const roles = useRoles();
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

  const addPost = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { error } = await supabase.from("content_calendar").insert(payload as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Post planned");
      setPostOpen(false);
      qc.invalidateQueries({ queryKey: ["content"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addCampaign = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { error } = await supabase.from("campaigns").insert(payload as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Campaign added");
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
    return <AccessDenied message="Marketing is available to Owner and Marketing roles." />;
  }

  const productName = (id: string | null) =>
    (productsQ.data ?? []).find((p: any) => p.id === id)?.name ?? "—";

  return (
    <div>
      <PageHeader title="Marketing" description="Content calendar and campaign tracking." />

      <Tabs defaultValue="content">
        <TabsList>
          <TabsTrigger value="content">Content calendar</TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
        </TabsList>

        <TabsContent value="content" className="mt-4">
          <div className="mb-4">
            <Button onClick={() => setPostOpen(true)}>Plan a post</Button>
          </div>
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(contentQ.data ?? []).map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell>{formatDate(c.scheduled_date)}</TableCell>
                      <TableCell className="rtl-content font-medium">{c.title}</TableCell>
                      <TableCell>{c.platform}</TableCell>
                      <TableCell>{productName(c.product_id)}</TableCell>
                      <TableCell>
                        <select
                          value={c.status}
                          onChange={(e) => updatePost.mutate({ id: c.id, status: e.target.value })}
                          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                        >
                          {CONTENT_STATUS.map((s) => (
                            <option key={s} value={s}>
                              {titleCase(s)}
                            </option>
                          ))}
                        </select>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(contentQ.data ?? []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        Nothing planned yet.
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
            <Button onClick={() => setCampaignOpen(true)}>New campaign</Button>
          </div>
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Budget</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(campaignsQ.data ?? []).map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>{c.platform}</TableCell>
                      <TableCell>
                        {formatDate(c.start_date)} → {formatDate(c.end_date)}
                      </TableCell>
                      <TableCell>{productName(c.product_id)}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(c.budget)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{titleCase(c.status)}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(campaignsQ.data ?? []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No campaigns yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={postOpen} onOpenChange={setPostOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Plan a post</DialogTitle>
          </DialogHeader>
          <form
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
              <Label htmlFor="c-title">Title</Label>
              <Input id="c-title" name="title" required />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="c-platform">Platform</Label>
                <select
                  id="c-platform"
                  name="platform"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {CHANNELS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-date">Date</Label>
                <Input id="c-date" name="scheduled_date" type="date" defaultValue={today} required />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="c-product">Product</Label>
                <select
                  id="c-product"
                  name="product_id"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">None</option>
                  {(productsQ.data ?? []).map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-status">Status</Label>
                <select
                  id="c-status"
                  name="status"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {CONTENT_STATUS.map((s) => (
                    <option key={s} value={s}>
                      {titleCase(s)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-notes">Notes</Label>
              <Textarea id="c-notes" name="notes" />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={addPost.isPending}>Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={campaignOpen} onOpenChange={setCampaignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New campaign</DialogTitle>
          </DialogHeader>
          <form
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
              });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="k-name">Name</Label>
              <Input id="k-name" name="name" required />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="k-platform">Platform</Label>
                <select
                  id="k-platform"
                  name="platform"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {CHANNELS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="k-budget">Budget</Label>
                <Input id="k-budget" name="budget" type="number" step="0.01" defaultValue={0} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="k-start">Start</Label>
                <Input id="k-start" name="start_date" type="date" defaultValue={today} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="k-end">End</Label>
                <Input id="k-end" name="end_date" type="date" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="k-product">Product</Label>
                <select
                  id="k-product"
                  name="product_id"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">None</option>
                  {(productsQ.data ?? []).map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="k-status">Status</Label>
                <select
                  id="k-status"
                  name="status"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {CAMPAIGN_STATUS.map((s) => (
                    <option key={s} value={s}>
                      {titleCase(s)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={addCampaign.isPending}>Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
