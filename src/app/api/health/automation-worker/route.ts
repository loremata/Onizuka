import { NextResponse } from "next/server";
import { isAutomationRedisQueueEnabled } from "@/lib/automation-flow-redis";
import { isAutomationSqsQueueEnabled } from "@/lib/automation-flow-sqs";

/** Health probe per Deployment Kubernetes automation-worker. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    role: "automation-worker",
    redis: isAutomationRedisQueueEnabled(),
    sqs: isAutomationSqsQueueEnabled(),
    k8sManifest: "deploy/k8s/automation-worker.yaml",
  });
}
