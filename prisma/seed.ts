import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminPassword = await hash("admin123", 12);
  const clientPassword = await hash("client123", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@agency.com" },
    update: {},
    create: {
      email: "admin@agency.com",
      name: "Admin User",
      passwordHash: adminPassword,
      role: "ADMIN",
    },
  });

  const client = await prisma.client.upsert({
    where: { slug: "demo-client" },
    update: {},
    create: {
      companyName: "Demo Client Co",
      slug: "demo-client",
      contactEmail: "contact@democlient.com",
    },
  });

  const clientUser = await prisma.user.upsert({
    where: { email: "client@democlient.com" },
    update: {},
    create: {
      email: "client@democlient.com",
      name: "Client User",
      passwordHash: clientPassword,
      role: "CLIENT",
      clientId: client.id,
    },
  });

  console.log("Seed complete:");
  console.log("  Admin:", admin.email, "(password: admin123)");
  console.log("  Client user:", clientUser.email, "(password: client123)");
  console.log("  Client:", client.companyName, "slug:", client.slug);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
