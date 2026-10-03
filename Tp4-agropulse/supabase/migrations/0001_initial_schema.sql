-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Organizations
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    region TEXT NOT NULL
);

-- 2. Memberships
CREATE TABLE memberships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('producer', 'operator', 'advisor')),
    UNIQUE(user_id, organization_id)
);

-- 3. Plots
CREATE TABLE plots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    crop TEXT NOT NULL,
    geom JSONB NOT NULL,
    threshold_min NUMERIC NOT NULL DEFAULT 25,
    threshold_max NUMERIC NOT NULL DEFAULT 45
);

-- 4. Stations
CREATE TABLE stations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plot_id UUID NOT NULL REFERENCES plots(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    lat NUMERIC NOT NULL,
    lng NUMERIC NOT NULL
);

-- 5. Readings
CREATE TABLE readings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    measured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    moisture_pct NUMERIC NOT NULL,
    temp_c NUMERIC NOT NULL,
    rain_mm NUMERIC NOT NULL DEFAULT 0,
    source TEXT NOT NULL CHECK (source IN ('sensor', 'manual')),
    notes TEXT,
    client_request_id UUID UNIQUE
);
CREATE INDEX idx_readings_station_measured ON readings (station_id, measured_at DESC);

-- 6. Valves
CREATE TABLE valves (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plot_id UUID NOT NULL REFERENCES plots(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('open', 'closed')) DEFAULT 'closed'
);

-- 7. Irrigation Commands
CREATE TABLE irrigation_commands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    valve_id UUID NOT NULL REFERENCES valves(id) ON DELETE CASCADE,
    requested_by UUID NOT NULL REFERENCES auth.users(id),
    action TEXT NOT NULL CHECK (action IN ('open', 'close', 'irrigate_minutes')),
    duration_min INT CHECK (duration_min BETWEEN 1 AND 120),
    status TEXT NOT NULL CHECK (status IN ('pending', 'applied', 'failed', 'cancelled')) DEFAULT 'pending',
    error_reason TEXT,
    client_request_id UUID UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    applied_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX idx_one_pending_per_valve ON irrigation_commands (valve_id) WHERE status = 'pending';

-- 8. Alerts
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plot_id UUID NOT NULL REFERENCES plots(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('dry', 'stale')),
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    read_at TIMESTAMPTZ
);

-- REALTIME
-- In migrations we can recreate or simply alter
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime;
COMMIT;
ALTER PUBLICATION supabase_realtime ADD TABLE readings, valves, irrigation_commands, plots, alerts;

-- RLS POLICIES
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE plots ENABLE ROW LEVEL SECURITY;
ALTER TABLE stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE valves ENABLE ROW LEVEL SECURITY;
ALTER TABLE irrigation_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- Helper functions for RLS
CREATE OR REPLACE FUNCTION public.get_user_organizations() 
RETURNS SETOF UUID AS $$
  SELECT organization_id FROM memberships WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_user_roles(org_id UUID) 
RETURNS TEXT AS $$
  SELECT role FROM memberships WHERE user_id = auth.uid() AND organization_id = org_id LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- Organizations: users can see orgs they belong to
CREATE POLICY "Users can view their organizations" ON organizations
  FOR SELECT TO authenticated
  USING (id IN (SELECT public.get_user_organizations()));

-- Memberships: users can see their own memberships
CREATE POLICY "Users can view their memberships" ON memberships
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Plots: view if in org
CREATE POLICY "Users can view plots in their org" ON plots
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.get_user_organizations()));

CREATE POLICY "Producers and Operators can insert plots" ON plots
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_roles(organization_id) IN ('producer', 'operator'));

CREATE POLICY "Producers and Operators can update plots" ON plots
  FOR UPDATE TO authenticated
  USING (public.get_user_roles(organization_id) IN ('producer', 'operator'));

-- Stations: view if plot is in org
CREATE POLICY "Users can view stations in their org" ON stations
  FOR SELECT TO authenticated
  USING (plot_id IN (SELECT id FROM plots WHERE organization_id IN (SELECT public.get_user_organizations())));

-- Readings: view if station's plot is in org
CREATE POLICY "Users can view readings in their org" ON readings
  FOR SELECT TO authenticated
  USING (station_id IN (
    SELECT s.id FROM stations s 
    JOIN plots p ON s.plot_id = p.id 
    WHERE p.organization_id IN (SELECT public.get_user_organizations())
  ));

CREATE POLICY "Users can insert manual readings" ON readings
  FOR INSERT TO authenticated
  WITH CHECK (
    source = 'manual' AND 
    station_id IN (
      SELECT s.id FROM stations s 
      JOIN plots p ON s.plot_id = p.id 
      WHERE public.get_user_roles(p.organization_id) IN ('producer', 'operator')
    )
  );

-- Valves: view if plot is in org
CREATE POLICY "Users can view valves in their org" ON valves
  FOR SELECT TO authenticated
  USING (plot_id IN (SELECT id FROM plots WHERE organization_id IN (SELECT public.get_user_organizations())));

-- Irrigation Commands: view if valve's plot is in org
CREATE POLICY "Users can view commands in their org" ON irrigation_commands
  FOR SELECT TO authenticated
  USING (valve_id IN (
    SELECT v.id FROM valves v 
    JOIN plots p ON v.plot_id = p.id 
    WHERE p.organization_id IN (SELECT public.get_user_organizations())
  ));

CREATE POLICY "Producers and Operators can insert commands" ON irrigation_commands
  FOR INSERT TO authenticated
  WITH CHECK (
    valve_id IN (
      SELECT v.id FROM valves v 
      JOIN plots p ON v.plot_id = p.id 
      WHERE public.get_user_roles(p.organization_id) IN ('producer', 'operator')
    )
  );

CREATE POLICY "Producers and Operators can update commands" ON irrigation_commands
  FOR UPDATE TO authenticated
  USING (
    valve_id IN (
      SELECT v.id FROM valves v 
      JOIN plots p ON v.plot_id = p.id 
      WHERE public.get_user_roles(p.organization_id) IN ('producer', 'operator')
    )
  );

-- Alerts: view if plot is in org
CREATE POLICY "Users can view alerts in their org" ON alerts
  FOR SELECT TO authenticated
  USING (plot_id IN (SELECT id FROM plots WHERE organization_id IN (SELECT public.get_user_organizations())));
