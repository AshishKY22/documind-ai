"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

type UsageData = {
  stats: {
    totalDocuments: number;
    totalQueries: number;
    storageUsedBytes: number;
    currentPlan: string;
  };
  queriesPerDay: { date: string; count: number }[];
  documentTypeBreakdown: { type: string; count: number }[];
  recentActivity: {
    type: "document_upload" | "chat_started";
    id: string;
    label: string;
    status?: string;
    createdAt: string;
  }[];
};

const PIE_COLORS = ["#7C3AED", "#1E1B4B", "#A78BFA", "#C4B5FD"];

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 border-b border-zinc-200 pb-4 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-6 last:border-r-0 last:pr-0">
      <span className="text-sm text-zinc-500">{label}</span>
      <span className="text-3xl font-serif text-zinc-900">{value}</span>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<UsageData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/usage")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load usage data");
        return res.json();
      })
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  if (error) {
    return (
      <div className="max-w-5xl mx-auto p-8">
        <p className="text-zinc-600">
          Couldn&apos;t load your dashboard right now. Refresh to try again.
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-5xl mx-auto p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-20 bg-zinc-100 rounded" />
          <div className="h-64 bg-zinc-100 rounded" />
        </div>
      </div>
    );
  }

  const { stats, queriesPerDay, documentTypeBreakdown, recentActivity } = data;

  return (
    <div className="max-w-5xl mx-auto p-8 space-y-12">
      <h1 className="text-3xl font-serif text-zinc-900">Dashboard</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-0">
        <StatCard label="Documents" value={String(stats.totalDocuments)} />
        <StatCard label="Queries asked" value={String(stats.totalQueries)} />
        <StatCard label="Storage used" value={formatBytes(stats.storageUsedBytes)} />
        <StatCard label="Current plan" value={stats.currentPlan} />
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-10">
        <div>
          <h2 className="text-sm text-zinc-500 mb-3">Queries per day, last 30 days</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={queriesPerDay}>
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                tick={{ fontSize: 12, fill: "#71717A" }}
                interval={6}
                axisLine={{ stroke: "#E4E4E7" }}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 12, fill: "#71717A" }}
                axisLine={false}
                tickLine={false}
                width={28}
              />
              <Tooltip
                labelFormatter={(label) => formatDate(String(label))}
                contentStyle={{ fontSize: 13, borderRadius: 4, borderColor: "#E4E4E7" }}
              />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#7C3AED"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div>
          <h2 className="text-sm text-zinc-500 mb-3">Documents by type</h2>
          {documentTypeBreakdown.length === 0 ? (
            <p className="text-zinc-400 text-sm">No documents uploaded yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={documentTypeBreakdown}
                  dataKey="count"
                  nameKey="type"
                  outerRadius={80}
                  label={(entry: { name?: string; value?: number }) =>
                    `${entry.name} (${entry.value})`
                  }
                >
                  {documentTypeBreakdown.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 13, borderRadius: 4, borderColor: "#E4E4E7" }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Recent activity */}
      <div>
        <h2 className="text-sm text-zinc-500 mb-3">Recent activity</h2>
        {recentActivity.length === 0 ? (
          <p className="text-zinc-400 text-sm">Nothing here yet. Upload a document to get started.</p>
        ) : (
          <ul className="divide-y divide-zinc-200">
            {recentActivity.map((item) => (
              <li key={item.id} className="py-3 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-zinc-900">{item.label}</span>
                  <span className="text-xs text-zinc-500">
                    {item.type === "document_upload" ? "Uploaded" : "Chat started"}
                    {item.status ? ` · ${item.status.toLowerCase()}` : ""}
                  </span>
                </div>
                <span className="text-xs text-zinc-400">
                  {new Date(item.createdAt).toLocaleDateString("en-IN", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}