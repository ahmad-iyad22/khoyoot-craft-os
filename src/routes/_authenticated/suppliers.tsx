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
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/suppliers")({
  head: () => ({
    meta: [
      { title: "Suppliers — Khoyoot" },
      { name: "description", content: "Supplier contacts, products supplied and lead time notes." },
      { property: "og:title", content: "Suppliers — Khoyoot" },
      { property: "og:description", content: "Supplier contacts, products supplied and lead time notes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SuppliersPage,
});

function SuppliersPage() {
  const roles = useRoles();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const suppliersQ = useQuery({
    queryKey: ["suppliers"],
    enabled: roles.isOperations,
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      if (editing) {
        const { error } = await supabase.from("suppliers").update(payload as never).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("suppliers").insert(payload as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(tt("Supplier saved"));
      setOpen(false);
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["suppliers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!roles.isLoading && !roles.isOperations) {
    return <AccessDenied message={tt("Suppliers are available to Owner and Operations roles.")} />;
  }

  return (
    <div>
      <PageHeader
        title={tt("Suppliers")}
        description={tt("Who you buy from, and how long they take.")}
        action={
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            {tt("Add supplier")}
          </Button>
        }
      />

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tt("Name")}</TableHead>
                <TableHead>{tt("Contact")}</TableHead>
                <TableHead>{tt("Phone")}</TableHead>
                <TableHead>{tt("Products supplied")}</TableHead>
                <TableHead>{tt("Lead time")}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(suppliersQ.data ?? []).map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{s.contact_name ?? "—"}</TableCell>
                  <TableCell>{s.phone ?? "—"}</TableCell>
                  <TableCell className="rtl-content">{s.products_supplied ?? "—"}</TableCell>
                  <TableCell>{s.lead_time_notes ?? "—"}</TableCell>
                  <TableCell className="text-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditing(s);
                        setOpen(true);
                      }}
                    >
                      {tt("Edit")}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {(suppliersQ.data ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    {tt("No suppliers yet.")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit supplier" : "Add supplier"}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              save.mutate({
                name: String(f.get("name")),
                contact_name: String(f.get("contact_name") || "") || null,
                phone: String(f.get("phone") || "") || null,
                email: String(f.get("email") || "") || null,
                address: String(f.get("address") || "") || null,
                products_supplied: String(f.get("products_supplied") || "") || null,
                lead_time_notes: String(f.get("lead_time_notes") || "") || null,
              });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="s-name">{tt("Name")}</Label>
              <Input id="s-name" name="name" defaultValue={editing?.name ?? ""} required />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="s-contact">{tt("Contact person")}</Label>
                <Input id="s-contact" name="contact_name" defaultValue={editing?.contact_name ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="s-phone">{tt("Phone")}</Label>
                <Input id="s-phone" name="phone" defaultValue={editing?.phone ?? ""} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-email">{tt("Email")}</Label>
              <Input id="s-email" name="email" type="email" defaultValue={editing?.email ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-address">{tt("Address")}</Label>
              <Textarea id="s-address" name="address" defaultValue={editing?.address ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-products">{tt("Products supplied")}</Label>
              <Textarea
                id="s-products"
                name="products_supplied"
                defaultValue={editing?.products_supplied ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-lead">{tt("Lead time notes")}</Label>
              <Input id="s-lead" name="lead_time_notes" defaultValue={editing?.lead_time_notes ?? ""} />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={save.isPending}>{tt("Save")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
