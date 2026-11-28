-- One-time flag so default categories are seeded once per user and renames/deletes stick
ALTER TABLE "User" ADD COLUMN "categoriesSeeded" BOOLEAN NOT NULL DEFAULT false;
