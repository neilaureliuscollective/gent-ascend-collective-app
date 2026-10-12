-- Bounded synchronous delivery avoids storing credentials in pg_net queues.
create extension if not exists http with schema extensions;
