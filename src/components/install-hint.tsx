import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { useI18n } from "@/lib/i18n";

type PromptEvent = Event & { prompt: () => Promise<void> };

export function InstallHint() {
  const { t } = useI18n();
  const [evt, setEvt] = useState<PromptEvent | null>(null);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as { standalone?: boolean }).standalone === true;
    if (standalone) return;
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as PromptEvent);
    };
    const onInstalled = () => setEvt(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (evt) {
    return (
      <button
        type="button"
        onClick={async () => {
          await evt.prompt();
          setEvt(null);
        }}
        className="flex w-full items-center gap-2 rounded-lg bg-sidebar-accent/40 px-3 py-1.5 text-xs font-medium text-sidebar-foreground/70 transition-colors hover:text-sidebar-foreground"
      >
        <Download className="size-4" />
        {t("pwa_install")}
      </button>
    );
  }
  if (ios) return <p className="px-1 text-[11px] text-sidebar-foreground/60">{t("pwa_ios")}</p>;
  return null;
}
