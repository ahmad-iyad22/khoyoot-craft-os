import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Bot, Send, User } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { askAiManager } from "@/lib/ai-manager.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/ai-manager")({
  head: () => ({
    meta: [
      { title: "AI Manager · Khoyoot" },
      { name: "description", content: "Read-only AI business advisor for Khoyoot." },
      { property: "og:title", content: "AI Manager · Khoyoot" },
      { property: "og:description", content: "Read-only AI business advisor for Khoyoot." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AiManagerPage,
});

type Msg = { role: "user" | "assistant"; content: string };

function AiManagerPage() {
  const { t, lang } = useI18n();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const suggestions = [
    t("aiSuggest1"),
    t("aiSuggest2"),
    t("aiSuggest3"),
    t("aiSuggest4"),
  ];

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setError(null);
    const next = [...messages, { role: "user" as const, content: trimmed }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res = await askAiManager({ data: { messages: next, language: lang } });
      setMessages([...next, { role: "assistant", content: res.reply }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight }), 50);
    }
  }

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col gap-4 p-4">
      <div>
        <h1 className="text-2xl font-bold">{t("aiManager")}</h1>
        <p className="text-sm text-muted-foreground">{t("aiManagerSubtitle")}</p>
      </div>

      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto rounded-md border p-4 min-h-[40vh]">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{t("aiManagerEmpty")}</p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <Button key={s} variant="outline" size="sm" onClick={() => send(s)}>
                  {s}
                </Button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            {m.role === "assistant" && <Bot className="mt-1 h-5 w-5 shrink-0 text-primary" />}
            <Card className={m.role === "user" ? "max-w-[80%] bg-primary text-primary-foreground" : "max-w-[80%]"}>
              <CardContent className="whitespace-pre-wrap p-3 text-sm">{m.content}</CardContent>
            </Card>
            {m.role === "user" && <User className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />}
          </div>
        ))}
        {busy && <p className="text-sm text-muted-foreground">{t("aiThinking")}</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("aiAskPlaceholder")}
          rows={2}
          className="flex-1"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
        />
        <Button type="submit" disabled={busy || !input.trim()}>
          <Send className="h-4 w-4" />
          <span className="sr-only">{t("send")}</span>
        </Button>
      </form>
    </div>
  );
}
