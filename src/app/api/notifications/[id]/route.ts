import { NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function PATCH(_: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { id } = await params;

    const notification = await prisma.notification.findFirst({
      where: {
        id,
        org_id: session.user.org_id,
        user_id: session.user.id,
      },
      select: { id: true, is_read: true },
    });

    if (!notification) {
      return NextResponse.json(
        { success: false, error: "Notification not found" },
        { status: 404 },
      );
    }

    if (!notification.is_read) {
      await prisma.notification.update({
        where: { id },
        data: { is_read: true },
      });
    }

    return NextResponse.json({
      success: true,
      data: { id, is_read: true },
    });
  } catch (error) {
    console.error("Notification update error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update notification" },
      { status: 500 },
    );
  }
}
