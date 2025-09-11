import { Responsive, WidthProvider } from "react-grid-layout";
import WidgetRenderer from "../components/WidgetRenderer.jsx";

const ResponsiveGridLayout = WidthProvider(Responsive);

export default function SceneRenderer({ scene }) {
  if (!scene) return null;
  const widgets = scene.widgets || [];

  const layouts = {
    lg: widgets.map(w => ({
      i: w.id,
      x: w.layout?.x ?? 0,
      y: w.layout?.y ?? 0,
      w: w.layout?.w ?? 4,
      h: w.layout?.h ?? 3,
      static: true,
    })),
  };

  return (
    <ResponsiveGridLayout
      className="layout"
      layouts={layouts}
      breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
      cols={{ lg: 12, md: 10, sm: 8, xs: 6, xxs: 4 }}
      rowHeight={40}
      margin={[12, 12]}
      isResizable={false}
      isDraggable={false}
      measureBeforeMount={false}
      compactType={null}
      preventCollision
    >
      {widgets.map(w => (
        <div key={w.id} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
          <WidgetRenderer widget={w} />
        </div>
      ))}
    </ResponsiveGridLayout>
  );
}
