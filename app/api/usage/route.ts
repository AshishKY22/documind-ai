import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma"; // adjust to your actual Prisma client import path

// Helper: pull a rough "type" label out of a filename's extension.
// Your schema doesn't store file type separately, so we derive it here.
function getDocType(name: string): string {
  const ext = name.split(".").pop()?.toUpperCase() ?? "OTHER";
  if (ext === "PDF") return "PDF";
  if (ext === "DOCX" || ext === "DOC") return "DOCX";
  if (ext === "TXT") return "TXT";
  return "OTHER";
}

export async function GET() {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { clerkId: clerkUserId },
    include: { subscription: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // --- Stat cards: totals ---
  const [totalDocuments, totalQueries, storageAgg] = await Promise.all([
    prisma.document.count({ where: { userId: user.id } }),
    prisma.message.count({
      where: { role: "USER", chat: { userId: user.id } },
    }),
    prisma.document.aggregate({
      where: { userId: user.id },
      _sum: { size: true },
    }),
  ]);

  const storageUsedBytes = storageAgg._sum.size ?? 0;
  const currentPlan = user.subscription?.tier ?? "FREE";

  // --- Queries per day, last 30 days (for the line chart) ---
  // Raw SQL because Prisma's query builder can't group by truncated date.
  const queriesPerDay = await prisma.$queryRaw<
    { day: Date; count: bigint }[]
  >`
    SELECT date_trunc('day', m."createdAt") AS day, COUNT(*) AS count
    FROM "Message" m
    JOIN "Chat" c ON m."chatId" = c.id
    WHERE c."userId" = ${user.id}
      AND m.role = 'USER'
      AND m."createdAt" >= NOW() - INTERVAL '30 days'
    GROUP BY day
    ORDER BY day ASC
  `;

  // Fill in missing days with 0 so the chart doesn't have gaps.
  const queriesByDayMap = new Map<string, number>();
  for (const row of queriesPerDay) {
    const key = row.day.toISOString().slice(0, 10);
    queriesByDayMap.set(key, Number(row.count));
  }
  const last30Days: { date: string; count: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    last30Days.push({ date: key, count: queriesByDayMap.get(key) ?? 0 });
  }

  // --- Document type breakdown (for the pie chart) ---
  const documents = await prisma.document.findMany({
    where: { userId: user.id },
    select: { name: true },
  });
  const typeCounts: Record<string, number> = {};
  for (const doc of documents) {
    const type = getDocType(doc.name);
    typeCounts[type] = (typeCounts[type] ?? 0) + 1;
  }
  const documentTypeBreakdown = Object.entries(typeCounts).map(
    ([type, count]) => ({ type, count })
  );

  // --- Recent activity feed (last 10 events across docs + chats) ---
  const [recentDocs, recentChats] = await Promise.all([
    prisma.document.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, name: true, createdAt: true, status: true },
    }),
    prisma.chat.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, title: true, createdAt: true },
    }),
  ]);

  const activity = [
    ...recentDocs.map((d) => ({
      type: "document_upload" as const,
      id: d.id,
      label: d.name,
      status: d.status,
      createdAt: d.createdAt,
    })),
    ...recentChats.map((c) => ({
      type: "chat_started" as const,
      id: c.id,
      label: c.title,
      createdAt: c.createdAt,
    })),
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 10);

  return NextResponse.json({
    stats: {
      totalDocuments,
      totalQueries,
      storageUsedBytes,
      currentPlan,
    },
    queriesPerDay: last30Days,
    documentTypeBreakdown,
    recentActivity: activity,
  });
}