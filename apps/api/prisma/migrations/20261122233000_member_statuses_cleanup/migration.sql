-- Étape 6 : un membre qui part perd ses avis. Avant cette étape, les avis des
-- membres partis restaient en base : on les supprime une fois pour toutes.
DELETE FROM "member_statuses" ms
USING "group_titles" gt
WHERE gt."id" = ms."group_title_id"
  AND NOT EXISTS (
    SELECT 1 FROM "group_members" gm
    WHERE gm."group_id" = gt."group_id" AND gm."user_id" = ms."user_id"
  );
