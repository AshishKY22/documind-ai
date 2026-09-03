import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = req.nextUrl.searchParams;
  const documentId = searchParams.get("id");

  if (!documentId) {
    return NextResponse.json({ error: "Missing document ID" }, { status: 400 });
  }

  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: { user: true },
  });

  if (!document || document.user.clerkId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ status: document.status });
}