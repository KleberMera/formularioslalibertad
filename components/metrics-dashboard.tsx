"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Activity, BarChart3, CalendarDays, Loader2, RefreshCw, UserX, UsersRound } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const FORMULARIO_ID = Number(process.env.NEXT_PUBLIC_FIRMES_FORMULARIO_ID);
const EVENTO_ID = Number(process.env.NEXT_PUBLIC_FIRMES_EVENTO_ID);
const REFRESH_MS = 5000;

type RegistrarMetric = {
  registradorId: number;
  nombre: string;
  cantidad: number;
  porcentaje: number;
  ultimoRegistro: string | null;
  tiempoDesdeUltimoRegistroMinutos: number | null;
};
type Metrics = {
  generadoEn: string;
  filtros: { formularioId: number; eventoId: number };
  resumen: {
    totalEncuestas: number;
    encuestasPublicas: number;
    registradores: number;
    registradoresConRegistros: number;
    promedioPorRegistrador: number;
    maximoPorRegistrador: number;
  };
  porRegistrador: RegistrarMetric[];
};

function formatDate(value: string | null) {
  if (!value) return "Sin registros";
  return new Intl.DateTimeFormat("es-EC", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-EC", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatInactivity(
  lastRegistration: string | null,
  generatedAt: string,
  currentTime: number,
  fetchedAt: number,
) {
  if (!lastRegistration) return { full: "—", clock: "—", level: "none" };
  const elapsedAtFetch = Math.floor(
    (new Date(generatedAt).getTime() - new Date(lastRegistration).getTime()) / 1000,
  );
  const elapsedSinceFetch = Math.floor((currentTime - fetchedAt) / 1000);
  const totalSeconds = Math.max(0, elapsedAtFetch + elapsedSinceFetch);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const paddedHours = String(hours).padStart(2, "0");
  const paddedMinutes = String(minutes).padStart(2, "0");
  const paddedSeconds = String(seconds).padStart(2, "0");
  const level = totalSeconds < 900 ? "ok" : totalSeconds < 1800 ? "warn" : "alert";
  return {
    full: `${hours} h ${paddedMinutes} min ${paddedSeconds} s`,
    clock: `${paddedHours}:${paddedMinutes}:${paddedSeconds}`,
    level,
  };
}

export default function MetricsDashboard() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [metricsFetchedAt, setMetricsFetchedAt] = useState(0);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const inFlight = useRef(false);
  const hasData = useRef(false);

  // Reloj de 1 s para el contador de inactividad
  useEffect(() => {
    const interval = window.setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  // Carga inicial + actualización automática cada 5 s
  useEffect(() => {
    loadMetrics();
    const interval = window.setInterval(() => loadMetrics(true), REFRESH_MS);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadMetrics(silent = false) {
    if (inFlight.current) return;

    if (!Number.isInteger(FORMULARIO_ID) || FORMULARIO_ID < 1 || !Number.isInteger(EVENTO_ID) || EVENTO_ID < 1) {
      setError("Configura NEXT_PUBLIC_FIRMES_FORMULARIO_ID y NEXT_PUBLIC_FIRMES_EVENTO_ID en .env.local.");
      return;
    }
    if (!API_URL) {
      setError("Falta configurar NEXT_PUBLIC_API_URL.");
      return;
    }

    inFlight.current = true;
    if (!silent) {
      setError("");
      setLoading(true);
    }
    try {
      const params = new URLSearchParams({
        formularioId: String(FORMULARIO_ID),
        eventoId: String(EVENTO_ID),
      });
      const response = await fetch(`${API_URL}/metricas?${params.toString()}`);
      const body = await response.json();
      if (!response.ok || body.status >= 400) {
        throw new Error(body.message || "No se pudieron obtener las métricas.");
      }
      setMetrics(body.data as Metrics);
      setMetricsFetchedAt(Date.now());
      hasData.current = true;
      setError("");
    } catch (cause) {
      // Si ya hay datos en pantalla, el fallo de una actualización automática se ignora.
      if (!silent || !hasData.current) {
        setError(cause instanceof Error ? cause.message : "Error de conexión con el servidor.");
      }
    } finally {
      inFlight.current = false;
      if (!silent) setLoading(false);
    }
  }

  // Cálculos propios: solo cuentan los registradores con registros
  const conRegistros = metrics ? metrics.porRegistrador.filter((r) => r.cantidad > 0) : [];
  const totalRegistradores = metrics?.resumen.registradores ?? 0;
  const activos = conRegistros.length;
  const sinRegistros = Math.max(0, totalRegistradores - activos);
  const sumaRegistradores = conRegistros.reduce((acc, r) => acc + r.cantidad, 0);
  const promedio = activos > 0 ? Math.round((sumaRegistradores / activos) * 10) / 10 : 0;
  const maximo = conRegistros.reduce((acc, r) => Math.max(acc, r.cantidad), 0);

  return (
    <main className="metrics-page">
      <header className="metrics-header">
        <a className="metrics-brand" href="/" aria-label="Ir al formulario público">
          <span className="metrics-brand-icon"><BarChart3 /></span>
          <span><strong>La Libertad</strong><small>Panel de métricas</small></span>
        </a>
        {metrics && <span className="metrics-updated">Actualizado {formatDate(metrics.generadoEn)}</span>}
      </header>

      <section className="metrics-content">
        <div className="metrics-title-row">
          <div>
            <span className="metrics-eyebrow">SEGUIMIENTO DE REGISTROS</span>
            <h1>Métricas del formulario</h1>
          </div>
          <button className="metrics-submit" type="button" onClick={() => loadMetrics()} disabled={loading} aria-label="Actualizar">
            {loading ? <Loader2 className="spin" /> : <RefreshCw />}
            <span className="metrics-submit-text">{loading ? "Consultando" : "Actualizar"}</span>
          </button>
        </div>

        {error && <div className="metrics-error" role="alert">{error}</div>}
        {loading && !metrics && <div className="metrics-loading"><Loader2 className="spin" /> Consultando métricas…</div>}

        {metrics && (
          <>
            <div className="metrics-summary" aria-label="Resumen de métricas">
              <MetricCard tone="blue" icon={<BarChart3 />} label="Encuestas Realizadas" value={metrics.resumen.totalEncuestas} detail="Del evento activo" />
              {metrics.resumen.encuestasPublicas > 0 && (
                <MetricCard tone="orange" icon={<Activity />} label="Encuestas públicas" value={metrics.resumen.encuestasPublicas} detail="Registros sin registrador" />
              )}
              <MetricCard tone="green" icon={<UsersRound />} label="Registradores Activos" value={activos} detail={`${totalRegistradores} habilitados en total`} />
              <MetricCard tone="red" icon={<UserX />} label="Registradores Ausentes" value={sinRegistros} detail="¡¡¡Compañeros estamos esperándoles!!!" />
              <MetricCard tone="purple" icon={<CalendarDays />} label="Promedio por registrador" value={promedio} detail={`Solo con registros · Máximo: ${maximo}`} />
            </div>

            <section className="metrics-table-card">
              <div className="metrics-table-heading">
                <div><h2>Registros por registrador</h2><p>Evento activo</p></div>
                <span>{metrics.resumen.totalEncuestas} registros</span>
              </div>
              {metrics.porRegistrador.length ? (
                <div className="metrics-table-scroll">
                  <table>
                    <thead><tr><th>Registrador</th><th>Registros</th><th>Participación</th><th>Último registro</th><th>Inactividad</th></tr></thead>
                    <tbody>{metrics.porRegistrador.map((registrar) => {
                      const inactivity = formatInactivity(registrar.ultimoRegistro, metrics.generadoEn, currentTime, metricsFetchedAt);
                      return (
                        <tr key={registrar.registradorId}>
                          <td data-label="Registrador"><strong>{registrar.nombre}</strong><small>ID {registrar.registradorId}</small></td>
                          <td className="metrics-count" data-label="Registros">{registrar.cantidad}</td>
                          <td data-label="Participación"><div className="metrics-share"><span><i style={{ width: `${Math.min(100, Math.max(0, registrar.porcentaje))}%` }} /></span><b>{registrar.porcentaje}%</b></div></td>
                          <td data-label="Último registro"><span className="metrics-date-full">{formatDate(registrar.ultimoRegistro)}</span><span className="metrics-date-mobile">{formatTime(registrar.ultimoRegistro)}</span></td>
                          <td data-label="Inactividad" className={`inactivity inactivity--${inactivity.level}`}>
                            <span className="metrics-elapsed-full">{inactivity.full}</span>
                          </td>
                        </tr>
                      );
                    })}</tbody>
                  </table>
                </div>
              ) : <div className="metrics-empty">No hay registros por registrador en este evento.</div>}
            </section>
          </>
        )}
      </section>
    </main>
  );
}

function MetricCard({ icon, label, value, detail, tone }: { icon: ReactNode; label: string; value: number; detail: string; tone: "blue" | "orange" | "green" | "purple" | "red" }) {
  return <article className={`metric-card metric-card--${tone}`}><span className="metric-card-icon">{icon}</span><div><p>{label}</p><strong>{value}</strong><small>{detail}</small></div></article>;
}
