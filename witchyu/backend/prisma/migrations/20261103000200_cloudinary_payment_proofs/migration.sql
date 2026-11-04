-- Allow new Cloudinary-backed proofs to omit binary data.
-- Existing database-backed proofs retain their original bytes.
ALTER TABLE "PaymentProof"
  ALTER COLUMN "data" DROP NOT NULL;

ALTER TABLE "PaymentProof"
  ADD COLUMN "storageProvider" TEXT NOT NULL DEFAULT 'database',
  ADD COLUMN "cloudinaryPublicId" TEXT,
  ADD COLUMN "cloudinaryResourceType" TEXT,
  ADD COLUMN "cloudinaryDeliveryType" TEXT;
