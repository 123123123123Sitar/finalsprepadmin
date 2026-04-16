export default function AdminLoading() {
  return (
    <div className="space-y-6">
      <div className="admin-card h-32 animate-pulse bg-slate-100" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="admin-card h-32 animate-pulse bg-slate-100" />
        ))}
      </div>
      <div className="admin-card h-80 animate-pulse bg-slate-100" />
    </div>
  );
}

