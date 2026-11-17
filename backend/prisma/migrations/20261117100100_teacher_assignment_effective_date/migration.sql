UPDATE "class_teacher_assignments"
SET "assigned_from" = ("created_at" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
WHERE "assigned_from" > ("created_at" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
