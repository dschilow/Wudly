-- Product variant families: the de-variantized family key used to detect that
-- a new title is just another size/color/storage of an existing product.
ALTER TABLE "Product" ADD COLUMN "variantBaseName" TEXT;

CREATE INDEX "Product_variantBaseName_idx" ON "Product"("variantBaseName");

-- One variant per configuration label and product ("65 Zoll · Schwarz").
-- Existing rows: no ProductVariant data exists in production yet (the model
-- was unused), so the unique constraint is safe to add directly.
CREATE UNIQUE INDEX "ProductVariant_productId_name_key" ON "ProductVariant"("productId", "name");
