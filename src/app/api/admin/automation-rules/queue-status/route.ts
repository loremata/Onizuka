import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  isAutomationRedisQueueEnabled,
  redisAutomationQueueDepth,
} from "@/lib/automation-flow-redis";
import { isAutomationSqsQueueEnabled, sqsAutomationQueueDepth } from "@/lib/automation-flow-sqs";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== "ADMIN" && session.user.role !== "STAFF")) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const [pending, deadLetter, redisDepth, sqsDepth] = await Promise.all([
    prisma.automationFlowRun.count({
      where: { status: "PENDING", scheduledAt: { lte: new Date() } },
    }),
    prisma.automationFlowRunDeadLetter.count(),
    isAutomationRedisQueueEnabled() ? redisAutomationQueueDepth() : Promise.resolve(null),
    isAutomationSqsQueueEnabled() ? sqsAutomationQueueDepth() : Promise.resolve(null),
  ]);

  return NextResponse.json({
    redisEnabled: isAutomationRedisQueueEnabled(),
    sqsEnabled: isAutomationSqsQueueEnabled(),
    pending,
    deadLetterPostgres: deadLetter,
    redis: redisDepth,
    sqs: sqsDepth,
  });
}
