do $$
begin
  if exists (select 1 from pg_roles where rolname = 'sandbox_exec') then
    execute 'grant usage on schema public to sandbox_exec';
    execute 'grant select, insert, update, delete on all tables in schema public to sandbox_exec';
    execute 'grant usage, select on all sequences in schema public to sandbox_exec';
    execute 'alter default privileges in schema public grant select, insert, update, delete on tables to sandbox_exec';
  end if;
end $$;