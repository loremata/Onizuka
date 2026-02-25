"use client";

import { useFormState } from "react-dom";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createUser } from "./actions";
import type { Client } from "@prisma/client";

type UserFormProps = { clients: Client[] };

export function UserForm({ clients }: UserFormProps) {
  const [state, formAction] = useFormState(
    (_: unknown, fd: FormData) => createUser(_, fd),
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
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          placeholder="user@company.com"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="name">Name (optional)</Label>
        <Input id="name" name="name" placeholder="Jane Doe" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          placeholder="At least 8 characters"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="role">Role</Label>
        <select
          id="role"
          name="role"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="CLIENT">Client</option>
          <option value="ADMIN">Admin</option>
        </select>
      </div>
      <div className="space-y-2" id="clientIdWrapper">
        <Label htmlFor="clientId">Client (required for Client role)</Label>
        <select
          id="clientId"
          name="clientId"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">Select a client</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.companyName} ({c.slug})
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-2">
        <Button type="submit">Create user</Button>
        <Button asChild type="button" variant="outline">
          <Link href="/admin/users">Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
