CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "lemonSqueezyCustomerId" TEXT,
  "lemonSqueezySubscriptionId" TEXT,
  "plan" TEXT NOT NULL DEFAULT 'free'
);
