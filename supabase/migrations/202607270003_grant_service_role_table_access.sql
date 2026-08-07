grant usage on schema public to service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;

alter default privileges for role postgres in schema public
grant all privileges on tables to service_role;

alter default privileges for role postgres in schema public
grant all privileges on sequences to service_role;
