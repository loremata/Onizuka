import { isTelegramAdminChat } from "@/lib/outreach-telegram-actions";

describe("isTelegramAdminChat", () => {
  const prev = process.env.TELEGRAM_ADMIN_CHAT_IDS;

  afterEach(() => {
    process.env.TELEGRAM_ADMIN_CHAT_IDS = prev;
  });

  it("matches configured admin chat ids", () => {
    process.env.TELEGRAM_ADMIN_CHAT_IDS = "12345, 67890";
    expect(isTelegramAdminChat(12345)).toBe(true);
    expect(isTelegramAdminChat("67890")).toBe(true);
    expect(isTelegramAdminChat(99999)).toBe(false);
  });
});
