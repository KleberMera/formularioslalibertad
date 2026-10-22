"use client";

import { useState, type FormEvent } from "react";
import { ArrowLeft, ClipboardList, Loader2, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

type RegistrarForm = {
  nombres: string;
  apellidos: string;
  cedula: string;
  celular: string;
};

const EMPTY_FORM: RegistrarForm = {
  nombres: "",
  apellidos: "",
  cedula: "",
  celular: "",
};

export default function CreateRegistrarPage() {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function update(field: keyof RegistrarForm, value: string) {
    setSuccess("");
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (!API_URL) {
      setError("Falta configurar NEXT_PUBLIC_API_URL.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/auth/registrador`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombres: form.nombres.trim(),
          apellidos: form.apellidos.trim(),
          cedula: form.cedula.trim(),
          celular: form.celular.trim(),
          rolId: 2,
        }),
      });
      const body = await response.json();
      if (!response.ok || body.status >= 400) {
        throw new Error(body.message || "No se pudo crear el registrador.");
      }
      setSuccess(`${body.message || "Registrador creado correctamente"}. Su contraseña inicial es su número de cédula.`);
      setForm(EMPTY_FORM);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Error de conexión con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="create-registrar-page">
      <header className="metrics-header">
        <a className="metrics-brand" href="/">
          <span className="metrics-brand-icon"><UserPlus /></span>
          <span><strong>La Libertad</strong><small>Administración de registradores</small></span>
        </a>
        <a className="create-back-link" href="/metricas"><ArrowLeft /> Volver a métricas</a>
      </header>

      <section className="create-registrar-card">
        <div className="create-registrar-heading">
          <span className="metrics-eyebrow">NUEVA CUENTA</span>
          <h1>Crear registrador</h1>
          <p>Completa los datos para habilitar una cuenta de registro en campo.</p>
        </div>

        <form className="create-registrar-form" onSubmit={submit}>
          <div className="create-registrar-grid">
            <label>Nombres<input autoComplete="given-name" value={form.nombres} onChange={(event) => update("nombres", event.target.value)} required maxLength={100} /></label>
            <label>Apellidos<input autoComplete="family-name" value={form.apellidos} onChange={(event) => update("apellidos", event.target.value)} required maxLength={100} /></label>
            <label>Cédula<input inputMode="numeric" autoComplete="off" value={form.cedula} onChange={(event) => update("cedula", event.target.value.replace(/\D/g, "").slice(0, 10))} required minLength={10} maxLength={10} pattern="[0-9]{10}" title="Ingresa una cédula de 10 dígitos" /></label>
            <label>Celular<input inputMode="tel" autoComplete="tel" value={form.celular} onChange={(event) => update("celular", event.target.value.replace(/\D/g, "").slice(0, 10))} required minLength={7} maxLength={10} pattern="[0-9]{7,10}" title="Ingresa entre 7 y 10 dígitos" /></label>
          </div>

          <div className="create-registrar-role"><span>Rol asignado</span><strong>REGISTRADOR</strong><small>La contraseña inicial será igual a la cédula.</small></div>
          {error && <div className="metrics-error" role="alert">{error}</div>}
          {success && <div className="create-registrar-success" role="status">{success}</div>}
          <div className="create-registrar-actions">
            <button className="metrics-submit create-registrar-submit" type="submit" disabled={loading}>
              {loading ? <Loader2 className="spin" /> : <UserPlus />}
              {loading ? "Creando cuenta…" : "Crear registrador"}
            </button>
            <button
              className="create-registrar-assign-link"
              type="button"
              disabled={!success || loading}
              onClick={() => router.push("/asignaciones")}
            >
              <ClipboardList /> Asignar formulario
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
