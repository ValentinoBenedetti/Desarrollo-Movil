import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { MetricCard } from '../../src/ui/components/MetricCard';
import { SignalGauge } from '../../src/ui/components/SignalGauge';
import { TimeSeriesChart } from '../../src/ui/components/TimeSeriesChart';

describe('UI Components Suite', () => {
  describe('MetricCard', () => {
    it('debe renderizar label, valor y unidad correctamente', () => {
      let renderer: ReactTestRenderer.ReactTestRenderer;
      ReactTestRenderer.act(() => {
        renderer = ReactTestRenderer.create(
          <MetricCard label="Latencia RTT" value={42.5} unit="ms" variant="primary" />
        );
      });

      const root = renderer!.root;
      expect(root.findByProps({ children: 'Latencia RTT' })).toBeDefined();
      expect(root.findByProps({ children: 42.5 })).toBeDefined();
      expect(root.findByProps({ children: 'ms' })).toBeDefined();
    });

    it('debe renderizar subtitle opcional cuando se proporciona', () => {
      let renderer: ReactTestRenderer.ReactTestRenderer;
      ReactTestRenderer.act(() => {
        renderer = ReactTestRenderer.create(
          <MetricCard label="Pérdida" value="0%" subtitle="RFC 3550" />
        );
      });

      const root = renderer!.root;
      expect(root.findByProps({ children: 'RFC 3550' })).toBeDefined();
    });
  });

  describe('SignalGauge', () => {
    it('debe renderizar 4 barras de señal con el operador y tecnología móvil', () => {
      let renderer: ReactTestRenderer.ReactTestRenderer;
      ReactTestRenderer.act(() => {
        renderer = ReactTestRenderer.create(
          <SignalGauge carrier="Claro AR" generation="4G" level={3} dbm={-85} />
        );
      });

      const root = renderer!.root;
      expect(root.findByProps({ children: 'Claro AR' })).toBeDefined();
      expect(root.findByProps({ children: '4G' })).toBeDefined();
      expect(root.findByProps({ children: '-85 dBm' })).toBeDefined();
      expect(root.findByProps({ children: 'Excelente Cobertura' })).toBeDefined();
    });

    it('debe mostrar cobertura regular para nivel 2', () => {
      let renderer: ReactTestRenderer.ReactTestRenderer;
      ReactTestRenderer.act(() => {
        renderer = ReactTestRenderer.create(
          <SignalGauge carrier="Personal" generation="3G" level={2} dbm={-100} />
        );
      });

      const root = renderer!.root;
      expect(root.findByProps({ children: 'Cobertura Regular' })).toBeDefined();
    });
  });

  describe('TimeSeriesChart', () => {
    it('debe mostrar mensaje cuando hay menos de 2 muestras', () => {
      let renderer: ReactTestRenderer.ReactTestRenderer;
      ReactTestRenderer.act(() => {
        renderer = ReactTestRenderer.create(
          <TimeSeriesChart title="Latencia" data={[{ x: 0, y: 50 }]} unit="ms" />
        );
      });

      const root = renderer!.root;
      expect(
        root.findByProps({ children: 'Muestras insuficientes para graficar' })
      ).toBeDefined();
    });

    it('debe renderizar gráfico SVG Polyline cuando hay 2 o más muestras', () => {
      let renderer: ReactTestRenderer.ReactTestRenderer;
      ReactTestRenderer.act(() => {
        renderer = ReactTestRenderer.create(
          <TimeSeriesChart
            title="Latencia"
            data={[
              { x: 0, y: 30 },
              { x: 1, y: 45 },
              { x: 2, y: 25 },
            ]}
            unit="ms"
          />
        );
      });

      const root = renderer!.root;
      expect(root.findByProps({ children: 'Latencia' })).toBeDefined();
      const valueNode = root.findAll(
        (node) =>
          node.props.children &&
          node.props.children.toString().includes('25.0')
      );
      expect(valueNode.length).toBeGreaterThan(0);
    });
  });
});
