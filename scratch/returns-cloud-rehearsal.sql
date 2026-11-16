-- Append after proposed migration with its COMMIT removed. Always rolls back.
do $test$
declare caller uuid; own uuid; other uuid;
begin
 select id,pharmacy_id into caller,own from public.profiles where pharmacy_id is not null order by id limit 1;
 select pharmacy_id into other from public.profiles where pharmacy_id <> own limit 1;
 if caller is null or other is null then raise exception 'Two pharmacies required'; end if;
 perform set_config('request.jwt.claims',json_build_object('sub',caller,'role','authenticated')::text,true);
 perform set_config('request.jwt.claim.sub',caller::text,true);
 perform set_config('app.test_own',own::text,true);
 perform set_config('app.test_other',other::text,true);
 insert into public.company_return_documents values(other,'{"version":1,"activeId":null,"reports":[]}',1,now());
end $test$;
set local role authenticated;
insert into public.company_return_documents(pharmacy_id,data,revision)
values(current_setting('app.test_own')::uuid,'{"version":1,"activeId":null,"reports":[]}',1);
do $test$
declare n integer;
begin
 if (select count(*) from public.company_return_documents) <> 1 then raise exception 'RLS read isolation failed'; end if;
 begin
 insert into public.company_return_documents(pharmacy_id,data,revision)
 values(current_setting('app.test_other')::uuid,'{"version":1,"activeId":null,"reports":[]}',1);
 raise exception 'Cross pharmacy insert succeeded';
 exception when insufficient_privilege then null;
 end;
 update public.company_return_documents set revision=2 where pharmacy_id=current_setting('app.test_own')::uuid and revision=1;
 get diagnostics n = row_count;
 if n<>1 then raise exception 'Own update failed'; end if;
 update public.company_return_documents set revision=2 where pharmacy_id=current_setting('app.test_own')::uuid and revision=1;
 get diagnostics n = row_count;
 if n<>0 then raise exception 'Stale save succeeded'; end if;
 update public.company_return_documents set revision=2 where pharmacy_id=current_setting('app.test_other')::uuid;
 get diagnostics n = row_count;
 if n<>0 then raise exception 'Cross pharmacy update succeeded'; end if;
 begin
 delete from public.company_return_documents;
 raise exception 'Unexpected document deletion permission';
 exception when insufficient_privilege then null;
 end;
end $test$;
set local role anon;
do $test$ begin
 begin
 perform * from public.company_return_documents;
 raise exception 'Anonymous read succeeded';
 exception when insufficient_privilege then null;
 end;
end $test$;
rollback;
select to_regclass('public.company_return_documents') is null as rehearsal_rolled_back;
