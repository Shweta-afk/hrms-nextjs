-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "billing_email" TEXT,
ADD COLUMN     "plan" TEXT NOT NULL DEFAULT 'starter',
ADD COLUMN     "plan_employee_limit" INTEGER NOT NULL DEFAULT 25,
ADD COLUMN     "razorpay_customer_id" TEXT,
ADD COLUMN     "razorpay_subscription_id" TEXT,
ADD COLUMN     "subscription_status" TEXT NOT NULL DEFAULT 'active',
ADD COLUMN     "trial_ends_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "reset_token" TEXT,
ADD COLUMN     "reset_token_expiry" TIMESTAMP(3);
