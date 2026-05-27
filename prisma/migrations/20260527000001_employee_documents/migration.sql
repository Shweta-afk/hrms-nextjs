CREATE TABLE "employee_documents" (
  "id"          TEXT NOT NULL,
  "org_id"      TEXT NOT NULL,
  "employee_id" TEXT NOT NULL,
  "type"        TEXT NOT NULL,
  "file_key"    TEXT NOT NULL,
  "file_name"   TEXT NOT NULL,
  "file_size"   INTEGER,
  "mime_type"   TEXT,
  "notes"       TEXT,
  "is_verified" BOOLEAN NOT NULL DEFAULT false,
  "verified_by" TEXT,
  "verified_at" TIMESTAMP(3),
  "uploaded_by" TEXT NOT NULL,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "employee_documents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "employee_documents_org_id_employee_id_idx" ON "employee_documents"("org_id", "employee_id");
CREATE INDEX "employee_documents_employee_id_type_idx"   ON "employee_documents"("employee_id", "type");

ALTER TABLE "employee_documents"
  ADD CONSTRAINT "employee_documents_employee_id_fkey"
    FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "employee_documents"
  ADD CONSTRAINT "employee_documents_org_id_fkey"
    FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
