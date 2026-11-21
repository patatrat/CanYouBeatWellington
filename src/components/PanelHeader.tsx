// Bold one-line headline for a History panel, with its controls on the right.
export default function PanelHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <p className="text-lg font-bold text-gray-800">{title}</p>
      {children ? <div className="flex flex-wrap items-center gap-x-4 gap-y-2">{children}</div> : null}
    </div>
  );
}
