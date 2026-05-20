-- AlterTable
ALTER TABLE "attendance_records" ADD COLUMN     "device_id" TEXT,
ADD COLUMN     "device_name" TEXT;

-- CreateTable
CREATE TABLE "devices" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ip_address" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 4370,
    "serial_no" TEXT,
    "location" TEXT,
    "push_token" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_heartbeat" TIMESTAMP(3),
    "last_sync" TIMESTAMP(3),
    "total_punches" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'offline',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "punch_logs" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "emp_code" TEXT NOT NULL,
    "punch_time" TIMESTAMP(3) NOT NULL,
    "direction" TEXT NOT NULL,
    "raw_data" TEXT,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "punch_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_enrollments" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "synced_at" TIMESTAMP(3),
    "enrolled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "devices_push_token_key" ON "devices"("push_token");

-- CreateIndex
CREATE UNIQUE INDEX "device_enrollments_device_id_employee_id_key" ON "device_enrollments"("device_id", "employee_id");

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "punch_logs" ADD CONSTRAINT "punch_logs_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "punch_logs" ADD CONSTRAINT "punch_logs_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_enrollments" ADD CONSTRAINT "device_enrollments_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_enrollments" ADD CONSTRAINT "device_enrollments_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_enrollments" ADD CONSTRAINT "device_enrollments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
