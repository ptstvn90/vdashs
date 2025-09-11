export default function WidgetRenderer({ widget }) {
  if (!widget) return null;

  const type = (widget.type || "").toLowerCase();
  const cfg = widget.config || {};

  const sanitize = (html) => {
    const s = String(html ?? "");
    try {
      if (typeof window !== "undefined" && window.DOMPurify) {
        return window.DOMPurify.sanitize(s);
      }
    } catch {}
    return s;
  };

  if (type === "iframe") {
    const url = String(cfg.url || "");
    if (!url) return <div className="text-sm opacity-70">Set iframe URL…</div>;
    return (
      <iframe
        src={url}
        title={cfg.title || "iframe"}
        className="w-full h-full rounded-md border"
        allow="fullscreen"
      />
    );
  }

  if (type === "html") {
    const html = sanitize(cfg.html ?? "<em>HTML empty</em>");
    return <div className="p-2 text-sm" dangerouslySetInnerHTML={{ __html: html }} />;
  }

  if (type === "php") {
    const code = String(cfg.code ?? "<?php /* snippet empty */ ?>");
    return (
      <pre className="text-xs bg-black/5 dark:bg-white/5 p-2 rounded-md overflow-auto">
        {code}
      </pre>
    );
  }

  return <div className="text-sm opacity-70">Unknown widget type</div>;
}
