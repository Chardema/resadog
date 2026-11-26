import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockSend, mockEmailLogCreate, ResendMock } = vi.hoisted(() => {
  const mockSend = vi.fn();
  return {
    mockSend,
    mockEmailLogCreate: vi.fn(),
    ResendMock: vi.fn(function ResendMock() {
      return { emails: { send: mockSend } };
    }),
  };
});

vi.mock("resend", () => ({ Resend: ResendMock }));

vi.mock("@/lib/db/prisma", () => ({
  prisma: { emailLog: { create: mockEmailLogCreate } },
}));

import {
  maskEmailAddress,
  NON_PRODUCTION_EMAIL_ERROR,
  sendBookingNoticeEmail,
} from "@/lib/email";

const notice = {
  id: "notice-1",
  to: "client@example.com",
  subject: "Rappel de réservation",
  text: "Bonjour,\nÀ demain.",
};

describe("envoi d'e-mails selon l'environnement", () => {
  beforeEach(() => {
    mockSend.mockReset();
    mockEmailLogCreate.mockReset();
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it.each([["preview"], ["development"], [""]])(
    "VERCEL_ENV=%s : n'appelle jamais Resend, journalise et trace en FAILED",
    async (vercelEnv) => {
      vi.stubEnv("VERCEL_ENV", vercelEnv);
      const info = vi.spyOn(console, "info").mockImplementation(() => {});

      await expect(sendBookingNoticeEmail(notice)).resolves.toBeNull();

      expect(mockSend).not.toHaveBeenCalled();
      expect(info).toHaveBeenCalledWith("E-mail non envoyé (hors production)", {
        to: ["c***@example.com"],
        subject: notice.subject,
      });
      expect(JSON.stringify(info.mock.calls)).not.toContain("client@example.com");
      expect(mockEmailLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: "FAILED",
          to: [notice.to],
          subject: notice.subject,
          idempotencyKey: notice.id,
          error: NON_PRODUCTION_EMAIL_ERROR,
        }),
      });
    }
  );

  it("NODE_ENV=production sans VERCEL_ENV=production reste hors production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.spyOn(console, "info").mockImplementation(() => {});

    await sendBookingNoticeEmail(notice);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("production : envoie via Resend et trace en SENT (comportement inchangé)", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    mockSend.mockResolvedValue({ data: { id: "re_123" }, error: null });

    await expect(sendBookingNoticeEmail(notice)).resolves.toEqual({ id: "re_123" });

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend.mock.calls[0][0]).toMatchObject({ to: notice.to, subject: notice.subject });
    expect(mockSend.mock.calls[0][1]).toEqual({ headers: { "Idempotency-Key": notice.id } });
    expect(mockEmailLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: "SENT", resendId: "re_123" }),
    });
  });

  it("production : une erreur Resend reste levée et tracée en FAILED", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockSend.mockResolvedValue({ data: null, error: { message: "boom" } });

    await expect(sendBookingNoticeEmail(notice)).rejects.toThrow();
    expect(mockEmailLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: "FAILED" }),
    });
  });
});

describe("maskEmailAddress", () => {
  it("masque la partie locale", () => {
    expect(maskEmailAddress("client@example.com")).toBe("c***@example.com");
    expect(maskEmailAddress("Client <client@example.com>")).toBe("c***@example.com");
    expect(maskEmailAddress("pas-un-email")).toBe("***");
  });
});
