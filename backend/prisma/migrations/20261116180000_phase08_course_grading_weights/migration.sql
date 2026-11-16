ALTER TABLE "courses"
  ADD COLUMN "mini_test_weight" INTEGER NOT NULL DEFAULT 20,
  ADD COLUMN "midterm_weight" INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN "final_weight" INTEGER NOT NULL DEFAULT 50,
  ADD COLUMN "passing_score" DOUBLE PRECISION NOT NULL DEFAULT 5;

ALTER TABLE "courses"
  ADD CONSTRAINT "courses_grading_weights_check" CHECK (
    "mini_test_weight" >= 0 AND "midterm_weight" >= 0 AND "final_weight" >= 0
    AND "mini_test_weight" + "midterm_weight" + "final_weight" = 100
    AND "passing_score" >= 0 AND "passing_score" <= 10
  );
