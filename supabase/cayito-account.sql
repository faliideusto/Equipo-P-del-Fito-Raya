-- Cuenta de un amigo del Ranking cayitos que no juega en el Fito (Tomás, de Top Bal).
-- Cambia el correo y la contraseña antes de ejecutarlo en el SQL Editor de Supabase.
-- Crea la cuenta ya confirmada con el rol "cayito" (solo ve el Ranking cayitos y el buscador SNP).
-- Si el correo ya existe, solo le pone el rol y la contraseña. Se puede ejecutar más de una vez.
do $$
declare
  v_email text := lower('CORREO@EJEMPLO.COM');
  v_password text := 'CONTRASEÑA';
  v_id uuid;
begin
  select id into v_id from auth.users where email = v_email;
  if v_id is null then
    v_id := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new)
    values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
      extensions.crypt(v_password, extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"],"role":"cayito"}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_id, v_id::text,
      jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true), 'email', now(), now(), now());
  else
    update auth.users
      set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"cayito"}'::jsonb,
          encrypted_password = extensions.crypt(v_password, extensions.gen_salt('bf')),
          email_confirmed_at = coalesce(email_confirmed_at, now()), updated_at = now()
      where id = v_id;
  end if;
end $$;
