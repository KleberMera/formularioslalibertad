"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ClipboardList,
  FileText,
  List,
  Loader2,
  LockKeyhole,
  MapPin,
  MessageCircle,
  PartyPopper,
  Tag,
} from "lucide-react";
import Swal from "sweetalert2";

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const EVENTO_ID = Number(process.env.NEXT_PUBLIC_FIRMES_EVENTO_ID);
const FORMULARIO_ID = Number(process.env.NEXT_PUBLIC_FIRMES_FORMULARIO_ID);

type Option = { id: number; orden: number; texto: string; valor: string };

type QuestionRules = {
  minLength?: number;
  maxLength?: number;
  permitirEspacios?: boolean;
  soloAlfanumerico?: boolean;
  regex?: string;
  min?: number;
  max?: number;
  esEntero?: boolean;
  decimales?: number;
  minSeleccion?: number;
  maxSeleccion?: number;
};

type Question = {
  id: number;
  orden: number;
  codigo: string;
  enunciado: string;
  tipo: string;
  obligatoria: boolean;
  reglas?: QuestionRules;
  dependeDePreguntaId: number | null;
  dependeDeOpcionId: number | null;
  opciones?: Option[];
};

type Section = { nombre: string; orden: number; preguntas: Question[] };
type FormSchema = {
  id: number;
  nombre: string;
  descripcion: string;
  version: number;
  secciones: Section[];
};
type Answer = {
  valorTexto?: string;
  valorNumero?: number;
  opcionId?: number;
  opciones?: number[];
};

async function request(path: string, options: RequestInit = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const body = await response.json();
  if (!response.ok || body.status >= 400)
    throw new Error(body.message || "No se pudo completar la solicitud");
  return body.data;
}

/* ----------------------------- Helpers ----------------------------- */

function getKind(
  tipo: string,
): "texto" | "textarea" | "numero" | "unica" | "multiple" {
  const t = String(tipo || "TEXTO")
    .toUpperCase()
    .replace(/[-_ ]/g, "");
  if (t === "TEXTAREA" || t === "TEXTOLARGO") return "textarea";
  if (t === "NUMERO" || t === "NUMBER" || t === "INTEGER" || t === "DECIMAL")
    return "numero";
  if (t === "UNICA" || t === "UNIQUE" || t === "RADIO" || t === "SELECT")
    return "unica";
  if (t === "MULTIPLE" || t === "MULTI" || t === "CHECKBOX") return "multiple";
  return "texto";
}

/**
 * Limpia el texto a medida que el usuario escribe,
 * según las reglas configuradas en la pregunta.
 */
function filtrarTexto(valor: string, reglas?: QuestionRules): string {
  if (!reglas) return valor;
  let resultado = valor;

  if (reglas.permitirEspacios === false) {
    resultado = resultado.replace(/\s/g, "");
  }
  if (reglas.soloAlfanumerico === true) {
    resultado = resultado.replace(/[^A-Za-z0-9]/g, "");
  }
  if (reglas.regex) {
    try {
      const re = new RegExp(reglas.regex);
      // Se van quitando caracteres del final hasta que cumpla el patrón
      while (resultado.length > 0 && !re.test(resultado)) {
        resultado = resultado.slice(0, -1);
      }
    } catch {
      /* regex inválida, se ignora */
    }
  }
  if (reglas.maxLength !== undefined && resultado.length > reglas.maxLength) {
    resultado = resultado.slice(0, reglas.maxLength);
  }
  return resultado;
}

/**
 * Valida el valor de una pregunta según su tipo y reglas.
 * Devuelve un mensaje de error o null si está OK.
 */
function validarPregunta(
  question: Question,
  answer: Answer | undefined,
): string | null {
  const reglas = question.reglas ?? {};
  const kind = getKind(question.tipo);
  const req = question.obligatoria;

  if (kind === "texto" || kind === "textarea") {
    const valor = answer?.valorTexto?.trim() ?? "";
    if (!valor) return req ? "Este campo es obligatorio" : null;

    if (reglas.minLength !== undefined && valor.length < reglas.minLength) {
      return `Debe tener al menos ${reglas.minLength} caracteres`;
    }
    if (reglas.maxLength !== undefined && valor.length > reglas.maxLength) {
      return `No debe superar los ${reglas.maxLength} caracteres`;
    }
    if (reglas.permitirEspacios === false && /\s/.test(valor)) {
      return "No se permiten espacios";
    }
    if (reglas.soloAlfanumerico === true && !/^[A-Za-z0-9]+$/.test(valor)) {
      return "Solo se permiten letras y números";
    }
    if (reglas.regex) {
      try {
        if (!new RegExp(reglas.regex).test(valor)) {
          return "El formato no es válido";
        }
      } catch {
        /* regex inválida, se ignora */
      }
    }
    return null;
  }

  if (kind === "numero") {
    const valor = answer?.valorNumero;
    if (valor === undefined || valor === null || Number.isNaN(valor)) {
      return req ? "Este campo es obligatorio" : null;
    }
    if (reglas.min !== undefined && valor < reglas.min) {
      return `Debe ser mayor o igual a ${reglas.min}`;
    }
    if (reglas.max !== undefined && valor > reglas.max) {
      return `Debe ser menor o igual a ${reglas.max}`;
    }
    if (reglas.esEntero === true && !Number.isInteger(valor)) {
      return "Debe ser un número entero";
    }
    return null;
  }

  if (kind === "unica") {
    if (!answer?.opcionId) return req ? "Selecciona una opción" : null;
    return null;
  }

  if (kind === "multiple") {
    const n = answer?.opciones?.length ?? 0;
    if (n === 0) return req ? "Selecciona al menos una opción" : null;
    if (reglas.minSeleccion !== undefined && n < reglas.minSeleccion) {
      return `Selecciona al menos ${reglas.minSeleccion} opción(es)`;
    }
    if (reglas.maxSeleccion !== undefined && n > reglas.maxSeleccion) {
      return `Máximo ${reglas.maxSeleccion} opción(es)`;
    }
    return null;
  }

  return null;
}

/* ------------------------- App principal ------------------------- */

export function PublicRegistrationApp() {
  const [done, setDone] = useState(false);
  const [started, setStarted] = useState(false);
  const [schema, setSchema] = useState<FormSchema | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setLoading(true);
    request(`/formulario/${FORMULARIO_ID}`)
      .then(setSchema)
      .catch((error) => setNotice(error.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <main className="empty-state">
        <Loader2 className="spin" />
        <p>Cargando formulario...</p>
      </main>
    );
  }

  if (!schema) {
    return (
      <main className="empty-state">
        <h1>Formulario no disponible</h1>
        <p>{notice || "No se pudo cargar el formulario."}</p>
      </main>
    );
  }

  if (done) {
    return (
      <div className="welcome-page">
        <div className="welcome-bg" aria-hidden="true">
          <span className="blob blob-orange" />
          <span className="blob blob-teal" />
          <span className="blob blob-yellow" />
          <span className="blob blob-blue" />
        </div>

        <header className="welcome-header">
          <span className="welcome-chip">
            <span className="welcome-dot" />
            Registro enviado
          </span>
        </header>

        <main className="welcome-card thanks-card">
          <div className="welcome-icon thanks-icon">
            <PartyPopper />
          </div>
          <div className="welcome-kicker">GRACIAS</div>

          <h1>¡Registro completado!</h1>

          <p className="thanks-lead">
            ¡Gracias por registrarte en <strong>La Libertad Baila</strong>! 💃🕺
          </p>
          <p>
            Tu información nos ayudará a conocer y conectar a los bailarines de
            nuestra provincia y a construir nuevas oportunidades de formación,
            integración y crecimiento artístico.
          </p>

          <div className="thanks-note">
            <MessageCircle />
            <span>
              Si seleccionaste que deseas formar parte de la comunidad oficial
              de WhatsApp, recibirás la información correspondiente para unirte.
            </span>
          </div>

          <p className="thanks-closing">
            ¡La danza de Santa Elena crece cuando bailamos juntos! 🔥
          </p>

          <button
            className="welcome-cta"
            onClick={() => {
              setDone(false);
              setStarted(false);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            Registrar otra persona
          </button>
        </main>
      </div>
    );
  }

  if (!started) {
    return <WelcomeScreen schema={schema} onStart={() => setStarted(true)} />;
  }

  return (
    <PublicForm
      schema={schema}
      eventoId={EVENTO_ID}
      onDone={() => setDone(true)}
    />
  );
}

/* --------------------------- Bienvenida --------------------------- */

function WelcomeScreen({
  schema,
  onStart,
}: {
  schema: FormSchema;
  onStart: () => void;
}) {
  const total = schema.secciones.length;

  return (
    <div className="welcome-page">
      <div className="welcome-bg" aria-hidden="true">
        <span className="blob blob-orange" />
        <span className="blob blob-teal" />
        <span className="blob blob-yellow" />
        <span className="blob blob-blue" />
      </div>

      <header className="welcome-header">
        <span className="welcome-chip">
          <span className="welcome-dot" />
          Portal de Registro Oficial
        </span>
      </header>

      <main className="welcome-card">
        <div className="welcome-icon">
          <ClipboardList />
        </div>
        <div className="welcome-kicker">BIENVENIDO/A</div>

        <h1>{schema.nombre}</h1>
        <p>{schema.descripcion}</p>

        <div className="welcome-meta">
          <span className="welcome-badge">
            <Tag /> Versión {schema.version}
          </span>
          <span className="welcome-badge">
            <List /> {total} {total === 1 ? "sección" : "secciones"}
          </span>
        </div>

        <button className="welcome-cta" onClick={onStart}>
          Registrarse <ArrowRight />
        </button>
      </main>
    </div>
  );
}

/* ----------------------------- Formulario ----------------------------- */

function PublicForm({
  schema,
  eventoId,
  onDone,
}: {
  schema: FormSchema;
  eventoId: number;
  onDone: () => void;
}) {
  const [answers, setAnswers] = useState<Record<number, Answer>>({});
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  const sections = useMemo(() => {
    return [...schema.secciones].sort((a, b) => a.orden - b.orden);
  }, [schema]);

  const current = sections[step];

  const visible = (question: Question) =>
    !question.dependeDePreguntaId ||
    answers[question.dependeDePreguntaId]?.opcionId ===
      question.dependeDeOpcionId;

  const questions = current?.preguntas.filter(visible) || [];

  function updateAnswer(id: number, answer: Answer) {
    setAnswers((previous) => ({
      ...previous,
      [id]: { ...previous[id], ...answer },
    }));
    // Limpiamos el error de esa pregunta al cambiar el valor
    setErrors((prev) => {
      if (!prev[id]) return prev;
      const copia = { ...prev };
      delete copia[id];
      return copia;
    });
  }

  /** Valida las preguntas visibles de la sección actual. */
  function validateVisible(): boolean {
    const nuevosErrores: Record<number, string> = {};
    for (const q of questions) {
      const err = validarPregunta(q, answers[q.id]);
      if (err) nuevosErrores[q.id] = err;
    }
    setErrors(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  }

  async function validateAndContinue() {
    if (!validateVisible()) {
      await Swal.fire({
        icon: "warning",
        title: "Revisa los campos",
        text: "Hay campos que necesitan tu atención.",
        confirmButtonColor: "#f45116",
      });
      return;
    }
    setStep((currentStep) => currentStep + 1);
  }

  async function finish() {
    if (!validateVisible()) {
      await Swal.fire({
        icon: "warning",
        title: "Revisa los campos",
        text: "Hay campos que necesitan tu atención.",
        confirmButtonColor: "#f45116",
      });
      return;
    }

    setSaving(true);
    setNotice("");
    try {
      const respuestas = Object.entries(answers).map(
        ([preguntaId, answer]) => ({
          preguntaId: Number(preguntaId),
          ...answer,
        }),
      );
      const payload = { eventoId, respuestas };
      await request(`/registro/publico/${schema.id}`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      await Swal.fire({
        icon: "success",
        title: "Registro guardado",
        text: "Tu registro se guardó correctamente.",
        confirmButtonColor: "#f45116",
      });
      setAnswers({});
      setErrors({});
      setStep(0);
      onDone();
    } catch (error) {
      await Swal.fire({
        icon: "error",
        title: "No se pudo guardar",
        text: error instanceof Error ? error.message : "Intenta nuevamente.",
        confirmButtonColor: "#f45116",
      });
    } finally {
      setSaving(false);
    }
  }

  if (!current) {
    return (
      <main className="empty-state">
        <h1>Formulario no disponible</h1>
        <p>{notice || "No encontramos preguntas para este formulario."}</p>
      </main>
    );
  }

  const percentage = Math.round(((step + 1) / sections.length) * 100);

  return (
    <div className="form-shell">
      <header className="form-header">
        <div className="form-header-info">
          <div className="page-kicker">
            PASO {step + 1} DE {sections.length}
          </div>
          <h1>{current.nombre}</h1>
        </div>
        <span className="percent">{percentage}%</span>
        <div className="progress-track">
          <span style={{ width: `${percentage}%` }} />
        </div>
      </header>

      <main className="form-scroll">
        <div className="form-content">
          <QuestionSection
            section={current}
            answers={answers}
            errors={errors}
            update={updateAnswer}
          />
          {notice && <div className="success-box">{notice}</div>}
        </div>
      </main>

      <footer className="form-footer">
        <button
          className="secondary-button"
          disabled={step === 0}
          onClick={() => setStep(step - 1)}
        >
          <ArrowLeft /> Atrás
        </button>
        {step < sections.length - 1 ? (
          <button className="primary-button" onClick={validateAndContinue}>
            Continuar <ArrowRight />
          </button>
        ) : (
          <button className="primary-button" disabled={saving} onClick={finish}>
            {saving ? <Loader2 className="spin" /> : "Guardar registro"}
            {!saving && <Check />}
          </button>
        )}
      </footer>
    </div>
  );
}

/* --------------------------- Subcomponentes --------------------------- */



function QuestionSection({
  section,
  answers,
  errors,
  update,
}: {
  section: Section;
  answers: Record<number, Answer>;
  errors: Record<number, string>;
  update: (id: number, answer: Answer) => void;
}) {
  return (
    <div className="question-list">
      {section.preguntas.length === 0 ? (
        <div className="empty-questions">
          Esta sección no tiene preguntas visibles.
        </div>
      ) : (
        section.preguntas.map((question) => (
          <QuestionField
            key={question.id}
            question={question}
            answer={answers[question.id] || {}}
            error={errors[question.id]}
            update={(answer) => update(question.id, answer)}
          />
        ))
      )}
    </div>
  );
}

function QuestionField({
  question,
  answer,
  error,
  update,
}: {
  question: Question;
  answer: Answer;
  error?: string;
  update: (answer: Answer) => void;
}) {
  const kind = getKind(question.tipo);
  const reglas = question.reglas ?? {};
  const options = question.opciones || [];
  const inputId = `q-${question.id}`;

  return (
    <div className={`question ${error ? "has-error" : ""}`}>
      <label className="question-label" htmlFor={inputId}>
        <span>{question.enunciado}</span>
        {question.obligatoria && <i aria-label="obligatorio"> *</i>}
      </label>

      {kind === "textarea" ? (
        <textarea
          id={inputId}
          value={answer.valorTexto || ""}
          onChange={(event) =>
            update({ valorTexto: filtrarTexto(event.target.value, reglas) })
          }
          onKeyDown={(event) => {
            if (reglas.permitirEspacios === false && event.key === " ") {
              event.preventDefault();
            }
          }}
          rows={4}
          maxLength={reglas.maxLength}
          placeholder="Escribe tu respuesta..."
        />
      ) : kind === "numero" ? (
        <input
          id={inputId}
          type="number"
          value={answer.valorNumero ?? ""}
          min={reglas.min}
          max={reglas.max}
          step={reglas.esEntero ? 1 : "any"}
          onChange={(event) => {
            const raw = event.target.value;
            if (raw === "") {
              update({ valorNumero: undefined });
              return;
            }
            let num = Number(raw);
            if (Number.isNaN(num)) return;

            // Si excede el máximo, lo recortamos al máximo
            if (reglas.max !== undefined && num > reglas.max) {
              num = reglas.max;
            }
            // Forzar entero si aplica
            if (reglas.esEntero) {
              num = Math.trunc(num);
            }
            update({ valorNumero: num });
          }}
          onKeyDown={(event) => {
            if (reglas.esEntero && (event.key === "." || event.key === ",")) {
              event.preventDefault();
            }
          }}
          placeholder="Ingresa un número"
        />
      ) : kind === "unica" && options.length > 0 ? (
        <div className="options">
          {options.map((option) => (
            <label className="option" key={option.id}>
              <input
                type="radio"
                name={inputId}
                checked={answer.opcionId === option.id}
                onChange={() => update({ opcionId: option.id })}
              />
              <span>{option.texto}</span>
            </label>
          ))}
        </div>
      ) : kind === "multiple" && options.length > 0 ? (
        <div className="options">
          {options.map((option) => {
            const seleccionadas = answer.opciones || [];
            const yaSeleccionada = seleccionadas.includes(option.id);
            const alcanzoMax =
              reglas.maxSeleccion !== undefined &&
              seleccionadas.length >= reglas.maxSeleccion &&
              !yaSeleccionada;

            return (
              <label
                className={`option ${alcanzoMax ? "disabled" : ""}`}
                key={option.id}
              >
                <input
                  type="checkbox"
                  name={inputId}
                  checked={yaSeleccionada}
                  disabled={alcanzoMax}
                  onChange={(event) => {
                    if (event.target.checked) {
                      update({ opciones: [...seleccionadas, option.id] });
                    } else {
                      update({
                        opciones: seleccionadas.filter(
                          (id) => id !== option.id,
                        ),
                      });
                    }
                  }}
                />
                <span>{option.texto}</span>
              </label>
            );
          })}
        </div>
      ) : (
        <input
          id={inputId}
          type="text"
          value={answer.valorTexto || ""}
          maxLength={reglas.maxLength}
          onChange={(event) =>
            update({ valorTexto: filtrarTexto(event.target.value, reglas) })
          }
          onKeyDown={(event) => {
            if (reglas.permitirEspacios === false && event.key === " ") {
              event.preventDefault();
            }
          }}
          placeholder="Escribe tu respuesta..."
        />
      )}

      {error && <span className="field-error">{error}</span>}
    </div>
  );
}

export default PublicRegistrationApp;
