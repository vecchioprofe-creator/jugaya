-- Tareas automáticas (correr UNA vez en el SQL Editor de Supabase, después de la migración).
-- Vence las reservas cuyo plazo de seña terminó (FLUJOS.md §5).
create extension if not exists pg_cron;

select cron.schedule(
  'vencer-reservas',
  '* * * * *',                       -- cada minuto
  $$ select public.vencer_reservas() $$
);

-- Para ver las tareas programadas:   select * from cron.job;
-- Para ver las últimas ejecuciones:  select * from cron.job_run_details order by start_time desc limit 20;
