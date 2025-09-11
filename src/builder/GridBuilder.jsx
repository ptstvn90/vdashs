import { useMemo, useState } from "react";
import RGL, { WidthProvider } from "react-grid-layout";
import WidgetRenderer from "../components/WidgetRenderer.jsx";
import ErrorBoundary from "../components/ErrorBoundary.jsx";

const GridLayout = WidthProvider(RGL);

const ui = {
  header:
    "widget-handle cursor-move h-9 px-3 flex items-center justify-between border-b border-gray-200 dark:border-gray-700",
  card: "h-full bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden",
  btn: "px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700",
  title: "text-[11px] uppercase tracking-wide opacity-70",
  cta: "h-9 px-3 rounded-md bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900",
};


const clampOrInf = (n, min, max) => {
  if (n === Infinity) return Infinity;
  const v = Number(n);
  if (!Number.isFinite(v)) return min;
  return Math.min(max, Math.max(min, v));
};
const intOrInf = (n, fallback = 0) => {
  if (n === Infinity) return Infinity;
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(0, Math.floor(v));
};
const sameLayout = (a = {}, b = {}) =>
  a.i === b.i && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;


export default function GridBuilder({
  widgets,
  setWidgets,
  onEditWidget,
  onAddWidget,
}) {
  const [dragging, setDragging] = useState(false);

  
  const layout = useMemo(
    () =>
      widgets.map((w) => {
        const L = w.layout || {};
        return {
          i: String(L.i || w.id),
          x: clampOrInf(L.x ?? 0, 0, 11),
          y: L.y === Infinity ? Infinity : intOrInf(L.y ?? 0, 0),
          w: clampOrInf(L.w ?? 4, 1, 12),
          h: clampOrInf(L.h ?? 4, 2, 12),
          minW: 2,
          minH: 2,
        };
      }),
    [widgets]
  );

  
  const persistLayout = (nextLayout) => {
    setWidgets((prev) => {
      let changed = false;
      const next = prev.map((w) => {
        const key = String(w.layout?.i || w.id);
        const li = nextLayout.find((l) => l.i === key);
        if (!li) return w;
        const newL = {
          i: li.i,
          x: clampOrInf(li.x, 0, 11),
          y: intOrInf(li.y ?? 0, 0), // RGL provides a concrete number here
          w: clampOrInf(li.w, 1, 12),
          h: clampOrInf(li.h, 2, 12),
        };
        if (!sameLayout(w.layout, newL)) {
          changed = true;
          return { ...w, layout: newL };
        }
        return w;
      });
      return changed ? next : prev;
    });
  };

  const stop = (e) => {
    e.stopPropagation();
    e.preventDefault();
  };

  const editWidget = (w) => {
    onEditWidget(w, (payload) =>
      setWidgets((prev) =>
        prev.map((x) =>
          x.id === w.id
            ? { ...x, type: payload.type, config: payload.config }
            : x
        )
      )
    );
  };

  const deleteWidget = (id) =>
    setWidgets((prev) => prev.filter((w) => w.id !== id));

  return (
    <div className="relative">
      
      <div className="mb-3">
        {onAddWidget && (
          <button className={ui.cta} onClick={onAddWidget}>
            + Add widget
          </button>
        )}
      </div>

      <div className="relative min-h-[480px] max-h-[70vh] overflow-auto">
        <GridLayout
          className="layout"
          cols={12}
          rowHeight={44}
          margin={[12, 12]}
          containerPadding={[0, 0]}
          compactType="vertical"
          autoSize={true}
          isDraggable={true}
          isResizable={true}
          draggableHandle=".widget-handle"
          isBounded={true}
          layout={layout}
          resizeHandles={["se", "e", "s"]} // <— add this
          onDragStart={() => setDragging(true)}
          onDragStop={(l) => {
            setDragging(false);
            persistLayout(l);
          }}
          onResizeStart={() => setDragging(true)}
          onResizeStop={(l) => {
            setDragging(false);
            persistLayout(l);
          }}
        >
          {widgets.map((w) => (
            <div key={w.layout?.i || w.id}>
              <div className={ui.card}>
                <div className={ui.header}>
                  <span className={ui.title}>{w.type?.toUpperCase()}</span>
                  <div className="flex gap-2">
                    <button
                      className={ui.btn}
                      onMouseDown={stop}
                      onPointerDown={stop}
                      onClick={() => editWidget(w)}
                    >
                      Edit
                    </button>
                    <button
                      className={ui.btn + " text-red-600 border-red-400"}
                      onMouseDown={stop}
                      onPointerDown={stop}
                      onClick={() => deleteWidget(w.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <div
                  className={`h-[calc(100%-2.25rem)] p-2 ${
                    dragging ? "pointer-events-none" : ""
                  }`}
                >
                  <ErrorBoundary>
                    <WidgetRenderer widget={w} />
                  </ErrorBoundary>
                </div>
              </div>
            </div>
          ))}
        </GridLayout>
      </div>
    </div>
  );
}
