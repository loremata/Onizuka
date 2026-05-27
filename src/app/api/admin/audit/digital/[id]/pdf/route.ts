import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { auditPdfFilename, buildAuditPdfBuffer } from "@/lib/audit-pdf";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const { id } = await params;
  const variantParam = new URL(request.url).searchParams.get("variant");
  const variant = variantParam === "client" ? "client" : "internal";

  const audit = await prisma.digitalAudit.findFirst({
    where: { id, ownerUserId: session.user.id },
    include: {
      sections: true,
      recommendedBrand: { select: { name: true } },
      recommendedService: { select: { name: true } },
    },
  });

  if (!audit || audit.overallScore == null) {
    return NextResponse.json({ error: "Audit non trovato" }, { status: 404 });
  }

  const buffer = await buildAuditPdfBuffer({
    variant,
    businessName: audit.businessName ?? "Cliente",
    vatNumber: audit.vatNumber,
    website: audit.website,
    overallScore: audit.overallScore,
    priorityProblem: audit.priorityProblem,
    brandName: audit.recommendedBrand?.name ?? null,
    serviceName: audit.recommendedService?.name ?? null,
    sections: audit.sections,
    auditId: audit.id,
  });

  const filename = auditPdfFilename(audit.businessName ?? "audit", audit.id, variant);

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
