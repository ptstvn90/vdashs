import { useEffect, useState } from "react";
import { Api } from "../lib/api.js";

const ui = {
  input: "h-10 px-3 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm w-full",
  btn: "h-9 px-3 rounded-md border border-gray-300 dark:border-gray-700",
  btnPri: "h-9 px-3 rounded-md bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900",
  row: "flex items-center gap-2 py-1",
};


export default function VideowallsModal({ open, currentId, onClose }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [selected, setSelected] = useState(currentId || "");
  const [newName, setNewName] = useState("");
  const [editId, setEditId] = useState("");
  const [editName, setEditName] = useState("");

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const list = await Api.listVideowalls();
        setItems(list);
        if (!selected && list[0]) setSelected(list[0].id);
      } catch {
        setErr("Nu pot încărca lista videowall-urilor.");
      } finally {
        setLoading(false);
      }
    })();
  }, [open]);

  if (!open) return null;

  const add = async () => {
    if (!newName.trim()) return;
    try {
      setLoading(true);
      await Api.createVideowall({ name: newName.trim() });
      setNewName("");
      const list = await Api.listVideowalls();
      setItems(list);
      setSelected(list[list.length - 1]?.id || "");
    } catch {
      setErr("Crearea a eșuat.");
    } finally {
      setLoading(false);
    }
  };

  const saveRename = async () => {
    if (!editId || !editName.trim()) { setEditId(""); return; }
    try {
      setLoading(true);
      await Api.updateVideowall(editId, { name: editName.trim() });
      const list = await Api.listVideowalls();
      setItems(list);
      setEditId("");
      setEditName("");
    } catch {
      setErr("Redenumirea a eșuat.");
    } finally {
      setLoading(false);
    }
  };

  const remove = async (id) => {
    if (!confirm("Ștergi acest videowall?")) return;
    try {
      setLoading(true);
      await Api.deleteVideowall(id);
      const list = await Api.listVideowalls();
      setItems(list);
      if (selected === id) setSelected(list[0]?.id || "");
    } catch {
      setErr("Ștergerea a eșuat.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="text-lg font-semibold">Manage videowalls</div>
          <button className={ui.btn} onClick={() => onClose(null)}>✕</button>
        </div>

        <div className="p-4 space-y-4">
          {err && <div className="text-sm text-red-600">{err}</div>}

          

          <div className="flex gap-2">
            <input
              className={ui.input}
              placeholder="Nume videowall nou…"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <button className={ui.btnPri} onClick={add} disabled={loading}>Add</button>
          </div>

         

          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {items.map(v => (
              <div key={v.id} className={ui.row}>
                <input
                  type="radio"
                  name="vw"
                  checked={selected === v.id}
                  onChange={() => setSelected(v.id)}
                  className="mr-1"
                />
                {editId === v.id ? (
                  <>
                    <input
                      className={`${ui.input} h-9`}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      autoFocus
                    />
                    <button className={ui.btnPri} onClick={saveRename} disabled={loading}>
                      Save
                    </button>
                    <button className={ui.btn} onClick={() => { setEditId(""); setEditName(""); }}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex-1">{v.name}</div>
                    <button
                      className={ui.btn}
                      onClick={() => { setEditId(v.id); setEditName(v.name); }}
                    >
                      Rename
                    </button>
                    <button
                      className={`${ui.btn} text-red-600 border-red-400`}
                      onClick={() => remove(v.id)}
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            ))}
            {!items.length && (
              <div className="text-sm opacity-70 py-2">Nu există videowall-uri încă.</div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
          <button className={ui.btn} onClick={() => onClose(null)}>Close</button>
          <button className={ui.btnPri} onClick={() => onClose(selected)} disabled={!selected}>
            Use selected
          </button>
        </div>
      </div>
    </div>
  );
}
