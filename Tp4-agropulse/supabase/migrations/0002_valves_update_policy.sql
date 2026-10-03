-- Allow producers and operators to update valve status directly
CREATE POLICY "Producers and Operators can update valves" ON public.valves
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM plots p
      WHERE p.id = valves.plot_id
        AND public.user_can_command(p.organization_id)
    )
  );
