-- CreateTable
CREATE TABLE "hr_requests" (
    "id"          TEXT NOT NULL,
    "org_id"      TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "type"        TEXT NOT NULL,
    "subject"     TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status"      TEXT NOT NULL DEFAULT 'open',
    "reply"       TEXT,
    "replied_by"  TEXT,
    "replied_at"  TIMESTAMP(3),
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hr_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hr_requests_org_id_status_idx" ON "hr_requests"("org_id", "status");

-- CreateIndex
CREATE INDEX "hr_requests_employee_id_created_at_idx" ON "hr_requests"("employee_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "hr_requests" ADD CONSTRAINT "hr_requests_org_id_fkey"
    FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_requests" ADD CONSTRAINT "hr_requests_employee_id_fkey"
    FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
