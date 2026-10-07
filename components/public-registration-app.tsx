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
  PartyPopper,
  Tag,
} from "lucide-react";
import Swal from "sweetalert2";

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const EVENTO_ID = Number(process.env.NEXT_PUBLIC_FIRMES_EVENTO_ID);
const FORMULARIO_ID = Number(process.env.NEXT_PUBLIC_FIRMES_FORMULARIO_ID);

type Option = { id: number; orden: number; texto: string; valor: string };
type Question = {
  id: number;
  orden: number;
  codigo: string;
  enunciado: string;
  tipo: string;
  obligatoria: boolean;
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
      <main className="empty-state">
        <div className="empty-icon">
          <PartyPopper />
        </div>
        <div className="page-kicker">GRACIAS</div>
        <h1>¡Registro completado!</h1>
        <p>
          Tu información fue enviada correctamente. ¡Nos vemos en la pista! 💃🕺
        </p>
        <button
          className="primary-button"
          onClick={() => {
            setDone(false);
            setStarted(false);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          Registrar otra persona
        </button>
      </main>
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
  }

  function missingFields() {
    return questions.flatMap((question) => {
      if (!question.obligatoria) return [];
      const answer = answers[question.id];
      const type = String(question.tipo || "TEXTO")
        .toUpperCase()
        .replace(/[-_ ]/g, "");
      const empty =
        !answer ||
        (type === "MULTIPLE" || type === "MULTI" || type === "CHECKBOX"
          ? !answer.opciones?.length
          : type === "UNICA" ||
              type === "UNIQUE" ||
              type === "RADIO" ||
              type === "SELECT"
            ? !answer.opcionId
            : !answer.valorTexto?.trim() && answer.valorNumero === undefined);
      return empty ? [question.enunciado] : [];
    });
  }

  async function validateAndContinue() {
    const missing = missingFields();
    if (missing.length) {
      await Swal.fire({
        icon: "warning",
        title: "Campos obligatorios",
        html: `Completa: <strong>${missing.join(", ")}</strong>`,
        confirmButtonColor: "#f45116",
      });
      return;
    }
    setStep((currentStep) => currentStep + 1);
  }

  async function finish() {
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
    <main className="registration-layout">
      <Progress steps={sections} current={step} onSelect={setStep} />
      <section className="form-card">
        <div className="form-card-header">
          <div>
            <div className="page-kicker">
              PASO {step + 1} DE {sections.length}
            </div>
            <h1>{current.nombre}</h1>
          </div>
          <span className="percent">{percentage}%</span>
          <div className="progress-track">
            <span style={{ width: `${percentage}%` }} />
          </div>
        </div>
        <div className="form-content">
          <QuestionSection
            section={current}
            answers={answers}
            update={updateAnswer}
          />
          {notice && <div className="success-box">{notice}</div>}
        </div>
        <div className="form-actions">
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
            <button
              className="primary-button"
              disabled={saving}
              onClick={async () => {
                const missing = missingFields();
                if (missing.length) {
                  await Swal.fire({
                    icon: "warning",
                    title: "Campos obligatorios",
                    html: `Completa: <strong>${missing.join(", ")}</strong>`,
                    confirmButtonColor: "#f45116",
                  });
                  return;
                }
                finish();
              }}
            >
              {saving ? <Loader2 className="spin" /> : "Guardar registro"}
              {!saving && <Check />}
            </button>
          )}
        </div>
      </section>
    </main>
  );
}

// ---------------- Subcomponentes ----------------

function Progress({
  steps,
  current,
  onSelect,
}: {
  steps: Section[];
  current: number;
  onSelect: (step: number) => void;
}) {
  return (
    <aside className="progress-card">
      <span className="progress-title">PROGRESO</span>
      <div className="progress-steps">
        {steps.map((section, index) => (
          <button
            key={`${section.nombre}-${index}`}
            className={
              index === current ? "current" : index < current ? "done" : ""
            }
            onClick={() => index <= current && onSelect(index)}
          >
            <span className="step-icon">
              <span className="step-number">{index + 1}</span>
              <span className="step-symbol">
                {index < current ? (
                  <Check />
                ) : index === 0 ? (
                  <MapPin />
                ) : (
                  <FileText />
                )}
              </span>
            </span>
            <span>{section.nombre}</span>
          </button>
        ))}
      </div>
      <div className="protected">
        <LockKeyhole /> La información se utilizará únicamente para este
        registro.
      </div>
    </aside>
  );
}

function QuestionSection({
  section,
  answers,
  update,
}: {
  section: Section;
  answers: Record<number, Answer>;
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
  update,
}: {
  question: Question;
  answer: Answer;
  update: (answer: Answer) => void;
}) {
  const type = String(question.tipo || "TEXTO")
    .toUpperCase()
    .replace(/[-_ ]/g, "");
  const options = question.opciones || [];
  const isLongText =
    type === "TEXTAREA" || type === "TEXTO_LARGO" || type === "TEXTOLARGO";
  const isNumber =
    type === "NUMERO" ||
    type === "NUMBER" ||
    type === "INTEGER" ||
    type === "DECIMAL";
  const isSingle =
    type === "UNICA" ||
    type === "UNIQUE" ||
    type === "RADIO" ||
    type === "SELECT";
  const isMultiple =
    type === "MULTIPLE" || type === "MULTI" || type === "CHECKBOX";

  return (
    <div className="question">
      <label className="question-label">
        <span>{question.enunciado}</span>
        {question.obligatoria && <i aria-label="obligatorio"> *</i>}
      </label>
      {isLongText ? (
        <textarea
          value={answer.valorTexto || ""}
          onChange={(event) => update({ valorTexto: event.target.value })}
          rows={4}
          placeholder="Escribe tu respuesta..."
        />
      ) : isNumber ? (
        <input
          type="number"
          value={answer.valorNumero ?? ""}
          onChange={(event) =>
            update({
              valorNumero: event.target.value
                ? Number(event.target.value)
                : undefined,
            })
          }
          placeholder="Ingresa un número"
        />
      ) : (isSingle || isMultiple) && options.length > 0 ? (
        <div className="options">
          {options.map((option) => (
            <label className="option" key={option.id}>
              <input
                type={isSingle ? "radio" : "checkbox"}
                name={`q-${question.id}`}
                checked={
                  isSingle
                    ? answer.opcionId === option.id
                    : answer.opciones?.includes(option.id) || false
                }
                onChange={(event) =>
                  isSingle
                    ? update({ opcionId: option.id })
                    : update({
                        opciones: event.target.checked
                          ? [...(answer.opciones || []), option.id]
                          : (answer.opciones || []).filter(
                              (id) => id !== option.id,
                            ),
                      })
                }
              />
              <span>{option.texto}</span>
            </label>
          ))}
        </div>
      ) : (
        <input
          type="text"
          value={answer.valorTexto || ""}
          onChange={(event) => update({ valorTexto: event.target.value })}
          placeholder="Escribe tu respuesta..."
        />
      )}
    </div>
  );
}

export default PublicRegistrationApp;
