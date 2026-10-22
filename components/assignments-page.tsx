"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, ClipboardList, Loader2, UserRoundPlus } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

type Choice = { id: number; nombre: string };
type Assignment = {
  id: number;
  registradorId: number;
  formularioId: number;
  eventoId: number | null;
  puedeRegistrar: boolean;
  capturaDatosPersonales: boolean;
  registrador?: { nombres: string; apellidos: string; cedula: string };
  formulario?: { nombre: string };
  evento?: { nombre: string } | null;
};
type Catalog = { registradores: Choice[]; formularios: Choice[]; eventos: Choice[] };

async function apiRequest(path: string, options?: RequestInit) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers || {}) },
  });
  const body = await response.json();
  if (!response.ok || body.status >= 400) {
    throw new Error(Array.isArray(body.message) ? body.message.join(", ") : body.message || "No se pudo completar la solicitud.");
  }
  return body.data;
}

export default function AssignmentsPage() {
  const [catalog, setCatalog] = useState<Catalog>({ registradores: [], formularios: [], eventos: [] });
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [registradorId, setRegistradorId] = useState("");
  const [formularioId, setFormularioId] = useState("");
  const [eventoId, setEventoId] = useState("");
  const [puedeRegistrar, setPuedeRegistrar] = useState(true);
  const [capturaDatosPersonales, setCapturaDatosPersonales] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadData = useCallback(async () => {
    if (!API_URL) throw new Error("Falta configurar NEXT_PUBLIC_API_URL.");
    const [nextCatalog, nextAssignments] = await Promise.all([
      apiRequest("/registrador-formulario/catalogo"),
      apiRequest("/registrador-formulario"),
    ]);
    setCatalog(nextCatalog as Catalog);
    setAssignments(nextAssignments as Assignment[]);
  }, []);

  useEffect(() => {
    loadData()
      .catch((cause) => setError(cause instanceof Error ? cause.message : "No se cargaron los datos."))
      .finally(() => setLoading(false));
  }, [loadData]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      await apiRequest("/registrador-formulario", {
        method: "POST",
        body: JSON.stringify({
          registradorId: Number(registradorId),
          formularioId: Number(formularioId),
          ...(eventoId ? { eventoId: Number(eventoId) } : {}),
          puedeRegistrar,
          capturaDatosPersonales,
        }),
      });
      setSuccess("La asignación se guardó correctamente.");
      await loadData();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar la asignación.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="assignments-page">
      <header className="metrics-header">
        <a className="metrics-brand" href="/">
          <span className="metrics-brand-icon"><ClipboardList /></span>
          <span><strong>La Libertad</strong><small>Asignación de formularios</small></span>
        </a>
        <a className="create-back-link" href="/metricas"><ArrowLeft /> Volver a métricas</a>
      </header>

      <section className="assignments-content">
        <div className="metrics-title-row">
          <div><span className="metrics-eyebrow">GESTIÓN DE ACCESOS</span><h1>Asignar formulario</h1><p>Vincula un registrador con un formulario y su evento.</p></div>
          <span className="metrics-title-icon"><UserRoundPlus /></span>
        </div>

        <form className="assignment-form" onSubmit={submit}>
          <label>Registrador<select value={registradorId} onChange={(event) => setRegistradorId(event.target.value)} required disabled={loading || saving}>
            <option value="">Selecciona un registrador</option>
            {catalog.registradores.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
          </select></label>
          <label>Formulario<select value={formularioId} onChange={(event) => setFormularioId(event.target.value)} required disabled={loading || saving}>
            <option value="">Selecciona un formulario</option>
            {catalog.formularios.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
          </select></label>
          <label>Evento<select value={eventoId} onChange={(event) => setEventoId(event.target.value)} disabled={loading || saving}>
            <option value="">Sin evento</option>
            {catalog.eventos.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
          </select></label>
          <div className="assignment-options">
            <label><input type="checkbox" checked={puedeRegistrar} onChange={(event) => setPuedeRegistrar(event.target.checked)} /> Puede registrar</label>
            <label><input type="checkbox" checked={capturaDatosPersonales} onChange={(event) => setCapturaDatosPersonales(event.target.checked)} /> Captura datos personales</label>
          </div>
          {error && <div className="metrics-error" role="alert">{error}</div>}
          {success && <div className="create-registrar-success" role="status">{success}</div>}
          <button className="metrics-submit assignment-submit" type="submit" disabled={loading || saving || !catalog.registradores.length || !catalog.formularios.length}>
            {loading || saving ? <Loader2 className="spin" /> : <ClipboardList />}
            {loading ? "Cargando opciones…" : saving ? "Guardando…" : "Guardar asignación"}
          </button>
        </form>

        <section className="assignments-list-card">
          <div className="metrics-table-heading"><div><h2>Asignaciones activas</h2><p>{assignments.length} registradores asignados</p></div></div>
          {loading ? <div className="metrics-empty"><Loader2 className="spin" /> Cargando asignaciones…</div> : assignments.length ? (
            <div className="assignments-list">{assignments.map((item) => (
              <article className="assignment-row" key={item.id}>
                <div><strong>{item.registrador ? `${item.registrador.nombres} ${item.registrador.apellidos}` : `Registrador #${item.registradorId}`}</strong><small>{item.registrador?.cedula || `ID ${item.registradorId}`}</small></div>
                <div><strong>{item.formulario?.nombre || `Formulario #${item.formularioId}`}</strong><small>{item.evento?.nombre || "Sin evento"}</small></div>
                <span className={item.puedeRegistrar ? "assignment-badge enabled" : "assignment-badge disabled"}>{item.puedeRegistrar ? "Habilitado" : "Deshabilitado"}</span>
                <span className="assignment-personal">{item.capturaDatosPersonales ? "Con datos personales" : "Anónimo"}</span>
              </article>
            ))}</div>
          ) : <div className="metrics-empty">No hay asignaciones activas todavía.</div>}
        </section>
      </section>
    </main>
  );
}
