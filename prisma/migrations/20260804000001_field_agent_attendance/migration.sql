-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "is_field_agent" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "geofences" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "radius_m" INTEGER NOT NULL DEFAULT 200,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "geofences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_geofences" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "geofence_id" TEXT NOT NULL,
    "assigned_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_geofences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_punches" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "punch_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "accuracy_m" DECIMAL(7,2),
    "status" TEXT NOT NULL,
    "reject_reason" TEXT,
    "geofence_id" TEXT,
    "distance_m" DECIMAL(8,2),
    "selfie_key" TEXT,
    "attendance_record_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "field_punches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "geofences_org_id_is_active_idx" ON "geofences"("org_id", "is_active");

-- CreateIndex
CREATE INDEX "employee_geofences_org_id_employee_id_idx" ON "employee_geofences"("org_id", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "employee_geofences_employee_id_geofence_id_key" ON "employee_geofences"("employee_id", "geofence_id");

-- CreateIndex
CREATE INDEX "field_punches_org_id_employee_id_punch_time_idx" ON "field_punches"("org_id", "employee_id", "punch_time");

-- CreateIndex
CREATE INDEX "field_punches_org_id_status_idx" ON "field_punches"("org_id", "status");

-- AddForeignKey
ALTER TABLE "geofences" ADD CONSTRAINT "geofences_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_geofences" ADD CONSTRAINT "employee_geofences_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_geofences" ADD CONSTRAINT "employee_geofences_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_geofences" ADD CONSTRAINT "employee_geofences_geofence_id_fkey" FOREIGN KEY ("geofence_id") REFERENCES "geofences"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_punches" ADD CONSTRAINT "field_punches_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_punches" ADD CONSTRAINT "field_punches_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_punches" ADD CONSTRAINT "field_punches_geofence_id_fkey" FOREIGN KEY ("geofence_id") REFERENCES "geofences"("id") ON DELETE SET NULL ON UPDATE CASCADE;
