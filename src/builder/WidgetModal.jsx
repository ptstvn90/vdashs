import { useState, useEffect } from "react";

export default function WidgetModal({ open, initial, onClose, onSave }) {
  const [type, setType] = useState(initial?.type || "iframe");
  const [config, setConfig] = useState(initial?.config || {});
  useEffect(() => {
    if (open) {
      setType(initial?.type || "iframe");
      setConfig(initial?.config || {});
    }
  }, [open, initial]);

  if (!open) return null;

  const save = () => {
    onSave({ type, config });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{initial ? "Edit widget" : "Add widget"}</h2>
          <button className="px-3 py-1 rounded border" onClick={onClose}>✕</button>
        </div>

        <div className="space-y-3">
          <label className="block text-sm">
            Type
            <select
              className="mt-1 w-full px-3 py-2 rounded border bg-transparent"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="iframe">iframe</option>
              <option value="php">php snippet</option>
              <option value="html">html static</option>
            </select>
          </label>

          {type === "iframe" && (
            <label className="block text-sm">
              URL
              <input
                className="mt-1 w-full px-3 py-2 rounded border bg-transparent"
                placeholder="https://grafana.local/…"
                value={config.url || ""}
                onChange={(e) => setConfig({ ...config, url: e.target.value })}
              />
            </label>
          )}

          {type === "php" && (
            <label className="block text-sm">
              PHP code (placeholder)
              <textarea
                className="mt-1 w-full px-3 py-2 rounded border bg-transparent h-28"
                placeholder="<?php echo 'Hello'; ?>"
                value={config.code || ""}
                onChange={(e) => setConfig({ ...config, code: e.target.value })}
              />
            </label>
          )}

          {type === "html" && (
            <label className="block text-sm">
              HTML
              <textarea
                className="mt-1 w-full px-3 py-2 rounded border bg-transparent h-28"
                placeholder="<h2>Title</h2><p>Text…</p>"
                value={config.html || ""}
                onChange={(e) => setConfig({ ...config, html: e.target.value })}
              />
            </label>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button className="px-3 py-2 rounded border" onClick={onClose}>Cancel</button>
          <button className="px-3 py-2 rounded bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900" onClick={save}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
