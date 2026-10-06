import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function ChangePasswordCard() {
  const { t } = useI18n();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle className="font-display">{t("changePassword")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (pw.length < 8) return void toast.error(t("passwordTooShort"));
            if (pw !== pw2) return void toast.error(t("passwordMismatch"));
            setBusy(true);
            const { error } = await supabase.auth.updateUser({ password: pw });
            setBusy(false);
            if (error) return void toast.error(error.message);
            toast.success(t("passwordUpdated"));
            setPw("");
            setPw2("");
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="np">{t("newPassword")}</Label>
            <Input id="np" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="np2">{t("confirmPassword")}</Label>
            <Input id="np2" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" />
          </div>
          <Button type="submit" disabled={busy}>{t("save")}</Button>
        </form>
      </CardContent>
    </Card>
  );
}
