import { getDashboardMetrics } from "@/features/metrics-dashboard/application/get-dashboard-metrics";

const CHANNEL_LABELS = {
  own: "Local",
  pedidosya: "PedidosYa",
} as const;

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const DEFAULT_RANGE_DAYS = 30;

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseRangeParam(value: string | undefined, fallback: Date): Date {
  if (!value) {
    return fallback;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

/**
 * `/admin/dashboard` — the metrics-dashboard capability's single page (spec
 * "Sales metrics by channel and date range" + "PedidosYa cash-vs-settlement
 * variance view"). This is Phase 10's closing capability and the last of
 * the whole MVP task list.
 *
 * The date-range picker below IS the "historicals" mechanism per
 * mvp-decisions: there is no separate weekly-close/archive module — history
 * is just re-querying these same transactional tables by date range.
 *
 * A plain GET form (no server action) re-navigates this same route with
 * `?start=&end=` query params — Next 15's `searchParams` is a Promise on
 * this route, same async-request-API convention as every other Next 15
 * dynamic input to a page.
 *
 * Viewable by both admin and colaborador (gated only by the shared
 * `/admin` layout's any-authenticated-session check) — read-only data,
 * matching this project's established open-read pattern for every other
 * capability's admin list page (`/admin/purchases`, `/admin/pedidosya`).
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string; end?: string }>;
}) {
  const params = await searchParams;

  const today = new Date();
  const defaultStart = new Date(today.getTime() - DEFAULT_RANGE_DAYS * DAY_IN_MS);

  const start = parseRangeParam(params.start, defaultStart);
  const end = parseRangeParam(params.end, today);

  const metrics = await getDashboardMetrics(start, end);

  return (
    <main>
      <h1>Panel de métricas</h1>

      <form method="GET">
        <label>
          Desde
          <input type="date" name="start" defaultValue={toDateInputValue(start)} required />
        </label>
        <label>
          Hasta
          <input type="date" name="end" defaultValue={toDateInputValue(end)} required />
        </label>
        <button type="submit">Filtrar</button>
      </form>

      <section>
        <h2>Ventas por canal</h2>
        <table>
          <thead>
            <tr>
              <th>Canal</th>
              <th>Cantidad de ventas</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {(Object.keys(CHANNEL_LABELS) as Array<keyof typeof CHANNEL_LABELS>).map((channel) => (
              <tr key={channel}>
                <td>{CHANNEL_LABELS[channel]}</td>
                <td>{metrics.salesByChannel[channel].orderCount}</td>
                <td>${metrics.salesByChannel[channel].totalAmount.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2>Variance PedidosYa (estimado vs. liquidación real)</h2>
        <table>
          <tbody>
            <tr>
              <td>Total estimado (caja diaria)</td>
              <td>${metrics.pyaVariance.totalEstimatedNetKept.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Total real (liquidación PedidosYa)</td>
              <td>${metrics.pyaVariance.totalActualNetKept.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Diferencia (real − estimado)</td>
              <td>${metrics.pyaVariance.totalVarianceAmount.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        <h3>
          Pedidos con diferencia fuera de tolerancia ({metrics.pyaVariance.mismatchedOrders.length})
        </h3>
        {metrics.pyaVariance.mismatchedOrders.length === 0 ? (
          <p>Ninguno en este rango.</p>
        ) : (
          <ul>
            {metrics.pyaVariance.mismatchedOrders.map((order) => (
              <li key={order.orderNumber}>
                #{order.orderNumber} — diferencia: ${order.varianceAmount.toFixed(2)}
              </li>
            ))}
          </ul>
        )}

        <h3>
          Liquidados sin estimación previa ({metrics.pyaVariance.noEstimateFoundOrders.length})
        </h3>
        {metrics.pyaVariance.noEstimateFoundOrders.length === 0 ? (
          <p>Ninguno en este rango.</p>
        ) : (
          <ul>
            {metrics.pyaVariance.noEstimateFoundOrders.map((orderNumber) => (
              <li key={orderNumber}>#{orderNumber}</li>
            ))}
          </ul>
        )}

        <h3>
          Estimados sin liquidación recibida todavía (
          {metrics.pyaVariance.estimatesWithoutSettlementRow.length})
        </h3>
        {metrics.pyaVariance.estimatesWithoutSettlementRow.length === 0 ? (
          <p>Ninguno en este rango.</p>
        ) : (
          <ul>
            {metrics.pyaVariance.estimatesWithoutSettlementRow.map((orderNumber) => (
              <li key={orderNumber}>#{orderNumber}</li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
