"use client";

import { useFormState } from "react-dom";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient, updateClient } from "./actions";
import type { Client } from "@prisma/client";

type ClientFormProps = { client?: Client };

export function ClientForm({ client }: ClientFormProps) {
  const isEdit = !!client;
  const [state, formAction] = useFormState(
    isEdit
      ? (_: unknown, fd: FormData) => updateClient(client.id, _, fd)
      : (_: unknown, fd: FormData) => createClient(_, fd),
    null as { error: string } | null
  );

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {state.error}
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="companyName">Company name</Label>
        <Input
          id="companyName"
          name="companyName"
          required
          defaultValue={client?.companyName}
          placeholder="Acme Inc."
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="slug">Slug</Label>
        <Input
          id="slug"
          name="slug"
          defaultValue={client?.slug}
          placeholder="acme-inc (optional; auto-generated if empty)"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="contactEmail">Contact email</Label>
        <Input
          id="contactEmail"
          name="contactEmail"
          type="email"
          required
          defaultValue={client?.contactEmail}
          placeholder="contact@acme.com"
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit">{isEdit ? "Save changes" : "Create client"}</Button>
        <Button asChild type="button" variant="outline">
          <Link href="/admin/clients">Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
