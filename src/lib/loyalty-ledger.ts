import { Prisma, type Booking, type Payment, type UserSubscription } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { calculateLoyaltyStatus, calculatePawsEarned, LOYALTY_REWARDS } from "@/lib/loyalty";

const VALIDATED_LOYALTY_STATUSES = ["CONFIRMED", "IN_PROGRESS", "COMPLETED"] as const;

type LoyaltyDb = typeof prisma | Prisma.TransactionClient;

type LoyaltyBooking = Pick<Booking, "id" | "clientId" | "status" | "totalPrice" | "notes"> & {
  payment?: Pick<Payment, "amount" | "status"> | null;
  client?: {
    subscription?: Pick<UserSubscription, "status"> | null;
  };
};

const LOYALTY_REWARD_OPTIONS = LOYALTY_REWARDS;

export function isLoyaltyValidatedStatus(status: string) {
  return VALIDATED_LOYALTY_STATUSES.includes(status as (typeof VALIDATED_LOYALTY_STATUSES)[number]);
}

function loyaltyAmountForBooking(booking: LoyaltyBooking) {
  if (booking.payment?.status === "SUCCEEDED") return booking.payment.amount;
  return booking.totalPrice;
}

async function createUniqueLoyaltyTransaction(
  db: LoyaltyDb,
  data: Prisma.LoyaltyTransactionCreateInput
) {
  try {
    return await db.loyaltyTransaction.create({ data });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return null;
    }
    throw error;
  }
}

async function awardBookingRecord(db: LoyaltyDb, booking: LoyaltyBooking) {
  if (!isLoyaltyValidatedStatus(booking.status)) return null;

  const existing = await db.loyaltyTransaction.findFirst({
    where: { bookingId: booking.id, type: "EARN" },
    select: { id: true },
  });
  if (existing) return null;

  const amount = loyaltyAmountForBooking(booking);
  const isPremium = booking.notes?.includes("Premium actif") ||
    booking.notes?.includes("Avantage Premium") ||
    booking.client?.subscription?.status === "ACTIVE";
  const multiplier = isPremium ? 2 : 1;
  const paws = calculatePawsEarned(amount, isPremium);
  if (paws <= 0) return null;

  return createUniqueLoyaltyTransaction(db, {
    type: "EARN",
    paws,
    amount,
    multiplier,
    description: `Pattes gagnées pour la réservation ${booking.id}`,
    user: { connect: { id: booking.clientId } },
    booking: { connect: { id: booking.id } },
  });
}

export async function awardBookingLoyalty(bookingId: string, db: LoyaltyDb = prisma) {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: {
      payment: { select: { amount: true, status: true } },
      client: { select: { subscription: { select: { status: true } } } },
    },
  });
  if (!booking) return null;
  return awardBookingRecord(db, booking);
}

export async function reverseBookingLoyalty(
  bookingId: string,
  description = "Annulation de la réservation",
  db: LoyaltyDb = prisma
) {
  const earned = await db.loyaltyTransaction.findFirst({
    where: { bookingId, type: "EARN" },
    select: { id: true, userId: true, paws: true, amount: true, multiplier: true },
  });
  if (!earned) return null;

  const existingReversal = await db.loyaltyTransaction.findFirst({
    where: { bookingId, type: "REVERSAL" },
    select: { id: true },
  });
  if (existingReversal) return null;

  return createUniqueLoyaltyTransaction(db, {
    type: "REVERSAL",
    paws: -earned.paws,
    amount: earned.amount,
    multiplier: earned.multiplier,
    description,
    user: { connect: { id: earned.userId } },
    booking: { connect: { id: bookingId } },
  });
}

async function syncUserLoyalty(userId: string, db: LoyaltyDb = prisma) {
  const bookings = await db.booking.findMany({
    where: {
      clientId: userId,
      status: { in: [...VALIDATED_LOYALTY_STATUSES] },
      loyaltyTransactions: { none: { type: "EARN" } },
    },
    include: {
      payment: { select: { amount: true, status: true } },
      client: { select: { subscription: { select: { status: true } } } },
    },
  });

  for (const booking of bookings) {
    await awardBookingRecord(db, booking);
  }
}

export async function getLoyaltyAccount(userId: string, db: LoyaltyDb = prisma) {
  await syncUserLoyalty(userId, db);

  const [balance, earned, redeemed, transactions, rewardCoupons] = await Promise.all([
    db.loyaltyTransaction.aggregate({
      where: { userId },
      _sum: { paws: true },
    }),
    db.loyaltyTransaction.aggregate({
      where: { userId, type: "EARN" },
      _sum: { amount: true, paws: true },
    }),
    db.loyaltyTransaction.aggregate({
      where: { userId, type: "REDEEM" },
      _sum: { paws: true },
    }),
    db.loyaltyTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        coupon: {
          select: {
            code: true,
            discountType: true,
            discountValue: true,
            isActive: true,
            currentUses: true,
            maxUses: true,
            validUntil: true,
          },
        },
      },
    }),
    db.loyaltyTransaction.findMany({
      where: { userId, type: "REDEEM", couponId: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        coupon: {
          select: {
            code: true,
            discountType: true,
            discountValue: true,
            isActive: true,
            currentUses: true,
            maxUses: true,
            validUntil: true,
          },
        },
      },
    }),
  ]);

  const paws = Math.max(0, balance._sum.paws || 0);

  return {
    paws,
    totalEarnedPaws: earned._sum.paws || 0,
    totalRedeemedPaws: Math.abs(redeemed._sum.paws || 0),
    totalQualifiedAmount: earned._sum.amount || 0,
    status: calculateLoyaltyStatus(paws),
    rewards: LOYALTY_REWARD_OPTIONS,
    transactions,
    rewardCoupons: rewardCoupons
      .map((transaction) => transaction.coupon)
      .filter((coupon): coupon is NonNullable<typeof coupon> => Boolean(coupon)),
  };
}

function rewardForThreshold(threshold: number) {
  return LOYALTY_REWARD_OPTIONS.find((reward) => reward.threshold === threshold) || null;
}

function randomRewardCode(threshold: number) {
  const token = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `PATTE${threshold}-${token}`;
}

async function createRewardCouponCode(db: LoyaltyDb, threshold: number) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = randomRewardCode(threshold);
    const existing = await db.coupon.findUnique({ where: { code }, select: { id: true } });
    if (!existing) return code;
  }
  return `${randomRewardCode(threshold)}-${Date.now().toString(36).toUpperCase()}`;
}

export async function redeemLoyaltyReward(userId: string, threshold: number) {
  const reward = rewardForThreshold(threshold);
  if (!reward) {
    throw new Error("Récompense fidélité inconnue");
  }

  return prisma.$transaction(async (tx) => {
    await syncUserLoyalty(userId, tx);

    const [balance, user] = await Promise.all([
      tx.loyaltyTransaction.aggregate({
        where: { userId },
        _sum: { paws: true },
      }),
      tx.user.findUnique({
        where: { id: userId },
        select: { email: true },
      }),
    ]);

    const paws = balance._sum.paws || 0;
    if (paws < reward.threshold) {
      throw new Error(`Il manque ${reward.threshold - paws} Pattes pour cette récompense`);
    }
    if (!user?.email) {
      throw new Error("Email client introuvable");
    }

    const code = await createRewardCouponCode(tx, reward.threshold);
    const validUntil = new Date();
    validUntil.setFullYear(validUntil.getFullYear() + 1);

    const coupon = await tx.coupon.create({
      data: {
        code,
        description: `Récompense fidélité : ${reward.label}`,
        discountType: "FIXED_AMOUNT",
        discountValue: reward.discountEquivalent,
        maxUses: 1,
        validUntil,
        restrictedTo: [user.email],
        applicableServices: [],
      },
    });

    await tx.loyaltyTransaction.create({
      data: {
        type: "REDEEM",
        paws: -reward.threshold,
        amount: reward.discountEquivalent,
        multiplier: 1,
        description: `Récompense utilisée : ${reward.label}`,
        userId,
        couponId: coupon.id,
      },
    });

    return { reward, coupon };
  });
}
