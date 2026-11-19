ALTER TABLE "notifications"
  DROP CONSTRAINT IF EXISTS "notifications_link_path_safe_check";

ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_link_path_safe_check"
  CHECK (
    left("link_path", 1) = '/'
    AND left("link_path", 2) NOT IN ('//', '/\')
    AND "link_path" !~ '[[:cntrl:]]'
  );
