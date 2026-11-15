-- Normalize legacy off-step question points to 0.25-step scale
-- while preserving assessments that already have confirmed (GRADED) or published (RETURNED) submissions.
UPDATE "questions" q
SET "points" = GREATEST(0.25, ROUND((q."points" * 4.0)::numeric) / 4.0)::double precision
WHERE ABS(q."points" * 4.0 - ROUND((q."points" * 4.0)::numeric)) > 1e-6
  AND NOT EXISTS (
    SELECT 1
    FROM "class_assignments" ca
    JOIN "submissions" s ON s."class_assignment_id" = ca."id"
    WHERE ca."assessment_id" = q."assessment_id"
      AND s."status" IN ('GRADED', 'RETURNED')
  );
