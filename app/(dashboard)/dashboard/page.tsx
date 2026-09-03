export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <p className="mt-2 text-gray-600">Welcome to DocuMind AI. Your document analysis workspace.</p>
      
      <div className="mt-8 grid gap-6 md:grid-cols-3">
        <StatCard title="Documents" value="0" />
        <StatCard title="Chats" value="0" />
        <StatCard title="Plan" value="Free" />
      </div>
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border bg-white p-6">
      <p className="text-sm font-medium text-gray-600">{title}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  );
}

