-- Seed users
-- Orgs
INSERT INTO public.organizations (id, name, region) VALUES
('11111111-1111-1111-1111-111111111111', 'Estancia Didáctica Concordia', 'Entre Ríos'),
('22222222-2222-2222-2222-222222222222', 'Estancia Vecina', 'Entre Ríos');

-- Create users in auth schema (Supabase GoTrue)
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, confirmation_token, email_change, email_change_token_new, recovery_token)
VALUES
('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'productor@agropulse.test', crypt('123456', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), 'authenticated', '', '', '', ''),
('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'operador@agropulse.test', crypt('123456', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), 'authenticated', '', '', '', ''),
('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'asesor@agropulse.test', crypt('123456', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), 'authenticated', '', '', '', ''),
('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'externo@otro.test', crypt('123456', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), 'authenticated', '', '', '', '');

INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
VALUES
('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '{"sub":"00000000-0000-0000-0000-000000000001","email":"productor@agropulse.test"}', 'email', now(), now(), now()),
('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', '{"sub":"00000000-0000-0000-0000-000000000002","email":"operador@agropulse.test"}', 'email', now(), now(), now()),
('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003', '{"sub":"00000000-0000-0000-0000-000000000003","email":"asesor@agropulse.test"}', 'email', now(), now(), now()),
('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000004', '{"sub":"00000000-0000-0000-0000-000000000004","email":"externo@otro.test"}', 'email', now(), now(), now());

-- Memberships
INSERT INTO public.memberships (user_id, organization_id, role) VALUES
('00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'producer'),
('00000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'operator'),
('00000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'advisor'),
('00000000-0000-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222', 'producer');

-- Plots (Concordia aprox lat -31.38, lng -58.02)
INSERT INTO public.plots (id, organization_id, name, crop, geom, threshold_min, threshold_max) VALUES
('33333333-3333-3333-3333-333333333331', '11111111-1111-1111-1111-111111111111', 'Costa 1', 'Citrus', '[{"latitude": -31.3800, "longitude": -58.0200}, {"latitude": -31.3800, "longitude": -58.0180}, {"latitude": -31.3820, "longitude": -58.0180}, {"latitude": -31.3820, "longitude": -58.0200}]', 25, 45),
('33333333-3333-3333-3333-333333333332', '11111111-1111-1111-1111-111111111111', 'Costa 2', 'Citrus', '[{"latitude": -31.3825, "longitude": -58.0200}, {"latitude": -31.3825, "longitude": -58.0180}, {"latitude": -31.3845, "longitude": -58.0180}, {"latitude": -31.3845, "longitude": -58.0200}]', 25, 45),
('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Monte A', 'Soja', '[{"latitude": -31.3800, "longitude": -58.0225}, {"latitude": -31.3800, "longitude": -58.0205}, {"latitude": -31.3845, "longitude": -58.0205}, {"latitude": -31.3845, "longitude": -58.0225}]', 20, 40);

-- Stations
INSERT INTO public.stations (id, plot_id, name, lat, lng) VALUES
('44444444-4444-4444-4444-444444444441', '33333333-3333-3333-3333-333333333331', 'Station C1', -31.3810, -58.0190),
('44444444-4444-4444-4444-444444444442', '33333333-3333-3333-3333-333333333332', 'Station C2', -31.3835, -58.0190),
('44444444-4444-4444-4444-444444444443', '33333333-3333-3333-3333-333333333333', 'Station MA', -31.3822, -58.0215);

-- Valves
INSERT INTO public.valves (id, plot_id, name, status) VALUES
('55555555-5555-5555-5555-555555555551', '33333333-3333-3333-3333-333333333331', 'Valve C1', 'closed'),
('55555555-5555-5555-5555-555555555552', '33333333-3333-3333-3333-333333333332', 'Valve C2', 'closed'),
('55555555-5555-5555-5555-555555555553', '33333333-3333-3333-3333-333333333333', 'Valve MA', 'closed');

-- Readings
DO $$
DECLARE
    i INT;
    ts TIMESTAMPTZ;
BEGIN
    FOR i IN 1..15 LOOP
        ts := now() - ((16 - i) * interval '24 minutes');
        
        -- Costa 1: Optimal (around 34%)
        INSERT INTO public.readings (id, station_id, measured_at, moisture_pct, temp_c, rain_mm, source)
        VALUES (uuid_generate_v4(), '44444444-4444-4444-4444-444444444441', ts, 34 + (random() * 2 - 1), 22 + (random() * 2 - 1), 0, 'sensor');
        
        -- Costa 2: Dry (around 18%)
        INSERT INTO public.readings (id, station_id, measured_at, moisture_pct, temp_c, rain_mm, source)
        VALUES (uuid_generate_v4(), '44444444-4444-4444-4444-444444444442', ts, 18 + (random() * 2 - 1), 24 + (random() * 2 - 1), 0, 'sensor');
        
    END LOOP;
    
    -- Monte A: Stale (last reading was 20 mins ago)
    FOR i IN 1..15 LOOP
        ts := now() - interval '20 minutes' - ((16 - i) * interval '24 minutes');
        INSERT INTO public.readings (id, station_id, measured_at, moisture_pct, temp_c, rain_mm, source)
        VALUES (uuid_generate_v4(), '44444444-4444-4444-4444-444444444443', ts, 30 + (random() * 2 - 1), 21 + (random() * 2 - 1), 0, 'sensor');
    END LOOP;
END $$;
