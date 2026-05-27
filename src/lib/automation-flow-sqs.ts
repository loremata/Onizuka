const RUN_ATTR = "runId";

export function isAutomationSqsQueueEnabled(): boolean {
  return !!(
    process.env.AUTOMATION_SQS_QUEUE_URL?.trim() &&
    process.env.AWS_ACCESS_KEY_ID?.trim() &&
    process.env.AWS_SECRET_ACCESS_KEY?.trim()
  );
}

function sqsDlqUrl(): string | undefined {
  return process.env.AUTOMATION_SQS_DLQ_URL?.trim() || undefined;
}

async function getSqsClient() {
  const { SQSClient, SendMessageCommand, ReceiveMessageCommand, DeleteMessageCommand } = await import(
    "@aws-sdk/client-sqs"
  );
  const region = process.env.AWS_REGION?.trim() || "eu-west-1";
  return {
    client: new SQSClient({
      region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!.trim(),
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!.trim(),
      },
    }),
    SendMessageCommand,
    ReceiveMessageCommand,
    DeleteMessageCommand,
  };
}

export async function sqsEnqueueAutomationRun(runId: string): Promise<boolean> {
  const queueUrl = process.env.AUTOMATION_SQS_QUEUE_URL?.trim();
  if (!queueUrl || !isAutomationSqsQueueEnabled()) return false;
  try {
    const { client, SendMessageCommand } = await getSqsClient();
    await client.send(
      new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: runId,
        MessageAttributes: {
          [RUN_ATTR]: { DataType: "String", StringValue: runId },
        },
      })
    );
    return true;
  } catch {
    return false;
  }
}

export async function sqsDequeueAutomationRuns(limit: number): Promise<string[]> {
  const queueUrl = process.env.AUTOMATION_SQS_QUEUE_URL?.trim();
  if (!queueUrl || !isAutomationSqsQueueEnabled() || limit <= 0) return [];
  try {
    const { client, ReceiveMessageCommand, DeleteMessageCommand } = await getSqsClient();
    const res = await client.send(
      new ReceiveMessageCommand({
        QueueUrl: queueUrl,
        MaxNumberOfMessages: Math.min(10, limit),
        WaitTimeSeconds: 0,
        VisibilityTimeout: 120,
      })
    );
    const ids: string[] = [];
    for (const msg of res.Messages ?? []) {
      const runId = msg.Body?.trim() || msg.MessageAttributes?.[RUN_ATTR]?.StringValue?.trim();
      if (!runId || !msg.ReceiptHandle) continue;
      await client.send(
        new DeleteMessageCommand({ QueueUrl: queueUrl, ReceiptHandle: msg.ReceiptHandle })
      );
      ids.push(runId);
      if (ids.length >= limit) break;
    }
    return ids;
  } catch {
    return [];
  }
}

export async function sqsPushAutomationDeadLetter(payload: string): Promise<void> {
  const dlq = sqsDlqUrl();
  if (!dlq || !isAutomationSqsQueueEnabled()) return;
  try {
    const { client, SendMessageCommand } = await getSqsClient();
    await client.send(
      new SendMessageCommand({
        QueueUrl: dlq,
        MessageBody: payload.slice(0, 10000),
      })
    );
  } catch {
    /* ignore */
  }
}

export async function sqsAutomationQueueDepth(): Promise<{ queue: number; dlq: number } | null> {
  const queueUrl = process.env.AUTOMATION_SQS_QUEUE_URL?.trim();
  const dlq = sqsDlqUrl();
  if (!queueUrl || !isAutomationSqsQueueEnabled()) return null;
  try {
    const { client } = await getSqsClient();
    const { GetQueueAttributesCommand } = await import("@aws-sdk/client-sqs");
    const [main, dead] = await Promise.all([
      client.send(
        new GetQueueAttributesCommand({
          QueueUrl: queueUrl,
          AttributeNames: ["ApproximateNumberOfMessages"],
        })
      ),
      dlq
        ? client.send(
            new GetQueueAttributesCommand({
              QueueUrl: dlq,
              AttributeNames: ["ApproximateNumberOfMessages"],
            })
          )
        : Promise.resolve(null),
    ]);
    return {
      queue: Number(main.Attributes?.ApproximateNumberOfMessages ?? 0),
      dlq: Number(dead?.Attributes?.ApproximateNumberOfMessages ?? 0),
    };
  } catch {
    return { queue: 0, dlq: 0 };
  }
}
