"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Calendar,
  Check,
  ClipboardList,
  Clock,
  Gift,
  List,
  Loader2,
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
  minFecha?: string;
  maxFecha?: string;
  fechaNoPasada?: boolean;
  fechaNoFutura?: boolean;
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
  lugar?: string | null;
  fecha?: string | null;
  hora?: string | null;
  participacion?: string | null;
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
):
  | "texto"
  | "textarea"
  | "numero"
  | "unica"
  | "multiple"
  | "fecha"
  | "hora"
  | "fechaHora"
  | "email" {
  const t = String(tipo || "TEXTO")
    .toUpperCase()
    .replace(/[-_ ]/g, "");
  if (t === "TEXTAREA" || t === "TEXTOLARGO") return "textarea";
  if (t === "NUMERO" || t === "NUMBER" || t === "INTEGER" || t === "DECIMAL")
    return "numero";
  if (t === "UNICA" || t === "UNIQUE" || t === "RADIO" || t === "SELECT")
    return "unica";
  if (t === "MULTIPLE" || t === "MULTI" || t === "CHECKBOX") return "multiple";
  if (t === "FECHA" || t === "DATE") return "fecha";
  if (t === "HORA" || t === "TIME") return "hora";
  if (t === "FECHAHORA" || t === "DATETIME") return "fechaHora";
  if (t === "EMAIL" || t === "CORREO") return "email";
  return "texto";
}

/**
 * Abre el selector nativo del input (date / time / datetime-local)
 * al hacer click o focus sobre cualquier parte del campo.
 * Usa showPicker() cuando está disponible; si no, no hace nada
 * y el usuario sigue pudiendo usar el icono del navegador.
 */
function abrirPicker(
  event: MouseEvent<HTMLInputElement> | FocusEvent<HTMLInputElement>,
) {
  const input = event.currentTarget;
  if ("showPicker" in input) {
    try {
      input.showPicker();
    } catch {
      /* Algunos navegadores lo bloquean si no es gesto directo del usuario */
    }
  }
}

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
      while (resultado.length > 0 && !re.test(resultado)) {
        resultado = resultado.slice(0, -1);
      }
    } catch {
      /* regex inválida */
    }
  }
  if (reglas.maxLength !== undefined && resultado.length > reglas.maxLength) {
    resultado = resultado.slice(0, reglas.maxLength);
  }
  return resultado;
}

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
        /* ignorar */
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

  if (kind === "fecha") {
    const valor = answer?.valorTexto?.trim() ?? "";
    if (!valor) return req ? "Este campo es obligatorio" : null;
    if (reglas.minFecha && valor < reglas.minFecha) {
      return `La fecha no puede ser anterior a ${reglas.minFecha}`;
    }
    if (reglas.maxFecha && valor > reglas.maxFecha) {
      return `La fecha no puede ser posterior a ${reglas.maxFecha}`;
    }
    if (reglas.fechaNoPasada) {
      const hoy = new Date().toISOString().slice(0, 10);
      if (valor < hoy) return "La fecha no puede ser anterior a hoy";
    }
    if (reglas.fechaNoFutura) {
      const hoy = new Date().toISOString().slice(0, 10);
      if (valor > hoy) return "La fecha no puede ser posterior a hoy";
    }
    return null;
  }

  if (kind === "hora") {
    const valor = answer?.valorTexto?.trim() ?? "";
    if (!valor) return req ? "Este campo es obligatorio" : null;
    if (!/^\d{2}:\d{2}(:\d{2})?$/.test(valor)) {
      return "Formato de hora inválido";
    }
    return null;
  }

  if (kind === "fechaHora") {
    const valor = answer?.valorTexto?.trim() ?? "";
    if (!valor) return req ? "Este campo es obligatorio" : null;
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(valor)) {
      return "Formato de fecha y hora inválido";
    }
    if (reglas.minFecha && valor.slice(0, 10) < reglas.minFecha) {
      return `La fecha no puede ser anterior a ${reglas.minFecha}`;
    }
    if (reglas.maxFecha && valor.slice(0, 10) > reglas.maxFecha) {
      return `La fecha no puede ser posterior a ${reglas.maxFecha}`;
    }
    return null;
  }

  if (kind === "email") {
    const valor = answer?.valorTexto?.trim() ?? "";
    if (!valor) return req ? "Este campo es obligatorio" : null;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor)) {
      return "Correo electrónico inválido";
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

  const hasEventInfo =
    schema.lugar || schema.fecha || schema.hora || schema.participacion;

  return (
    <div className="welcome-page">
      <div className="welcome-bg" aria-hidden="true">
        <span className="blob blob-orange" />
        <span className="blob blob-teal" />
        <span className="blob blob-yellow" />
        <span className="blob blob-blue" />
      </div>

      <main className="welcome-card">
        <div className="welcome-icon">
          <ClipboardList />
        </div>
        <div className="welcome-kicker">BIENVENIDO/A</div>

        <h1>{schema.nombre}</h1>
        <p className="whitespace-pre-line text-left">{schema.descripcion}</p>

        {hasEventInfo && (
          <div className="welcome-info">
            {schema.lugar && (
              <div className="welcome-info-row">
                <span className="welcome-info-icon">
                  <MapPin className="h-4 w-4" />
                </span>
                <span>
                  <strong>Lugar:</strong> {schema.lugar}
                </span>
              </div>
            )}
            {schema.fecha && (
              <div className="welcome-info-row">
                <span className="welcome-info-icon">
                  <Calendar className="h-4 w-4" />
                </span>
                <span>
                  <strong>Fecha:</strong>{" "}
                  {new Date(schema.fecha + "T00:00:00").toLocaleDateString(
                    "es-EC",
                    { day: "numeric", month: "long", year: "numeric" },
                  )}
                </span>
              </div>
            )}
            {schema.hora && (
              <div className="welcome-info-row">
                <span className="welcome-info-icon">
                  <Clock className="h-4 w-4" />
                </span>
                <span>
                  <strong>Hora:</strong> {schema.hora}
                </span>
              </div>
            )}
            {schema.participacion && (
              <div className="welcome-info-row">
                <span className="welcome-info-icon">
                  <Gift className="h-4 w-4" />
                </span>
                <span>
                  <strong>Participación:</strong> {schema.participacion}
                </span>
              </div>
            )}
          </div>
        )}

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
  const scrollRef = useRef<HTMLElement>(null);

  const sections = useMemo(() => {
    return [...schema.secciones].sort((a, b) => a.orden - b.orden);
  }, [schema]);

  const current = sections[step];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

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
    setErrors((prev) => {
      if (!prev[id]) return prev;
      const copia = { ...prev };
      delete copia[id];
      return copia;
    });
  }

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
    <div className="flex h-dvh min-h-0 justify-center overflow-hidden bg-slate-100 sm:items-center sm:p-6">
      <div className="relative h-dvh min-h-0 w-full max-w-lg overflow-hidden bg-white sm:h-[min(52rem,calc(100dvh-3rem))] sm:rounded-3xl sm:border sm:border-slate-200/80 sm:shadow-xl sm:shadow-slate-900/10">
        {/* Header */}
        <header className="absolute inset-x-0 top-0 z-10 border-b border-brand-200/60 bg-gradient-to-b from-brand-50 via-white to-white px-6 pb-4 pt-6">
          <div className="mb-3 flex flex-col items-center text-center">
            <div className="mb-1.5 flex max-w-full items-center gap-2">
              <span className="shrink-0 rounded-full bg-brand-500 px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-white">
                Formulario
              </span>
              <span className="truncate rounded-full bg-brand-100/80 px-2.5 py-0.5 text-xs font-extrabold uppercase tracking-wide text-brand-600">
                {schema.nombre}
              </span>
            </div>
            <h1 className="mt-1 text-xl font-extrabold uppercase tracking-tight text-slate-900 sm:text-2xl">
              {current.nombre}
            </h1>
          </div>

          <div className="mb-2 flex items-center justify-between px-0.5">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Paso {step + 1} de {sections.length}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-slate-400">
                Campos obligatorios (*)
              </span>
              <span className="rounded-md border border-brand-200/60 bg-brand-50 px-2 py-0.5 text-xs font-extrabold text-brand-600">
                {percentage}%
              </span>
            </div>
          </div>

          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 shadow-inner">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-500 transition-all duration-500 ease-out"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </header>

        {/* Contenido */}
        <main
          ref={scrollRef}
          className="absolute inset-0 overflow-y-auto overscroll-contain px-6 pb-28 pt-48"
        >
          <QuestionSection
            section={current}
            answers={answers}
            errors={errors}
            update={updateAnswer}
            visible={visible}
          />
          {notice && (
            <div className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {notice}
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="absolute inset-x-0 bottom-0 z-10 flex items-center gap-3 border-t border-slate-100 bg-white/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] backdrop-blur-md sm:px-6">
          <button
            type="button"
            disabled={step === 0}
            onClick={() => setStep(step - 1)}
            className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3.5 text-sm font-bold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ArrowLeft className="h-4 w-4" /> Atrás
          </button>

          {step < sections.length - 1 ? (
            <button
              type="button"
              onClick={validateAndContinue}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-brand-500 px-6 py-3.5 text-base font-bold text-white shadow-lg shadow-brand-500/30 transition hover:bg-brand-600 focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/25 active:scale-[0.99]"
            >
              Continuar <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={saving}
              onClick={finish}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-brand-500 px-6 py-3.5 text-base font-bold text-white shadow-lg shadow-brand-500/30 transition hover:bg-brand-600 focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/25 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Guardar registro <Check className="h-4 w-4" />
                </>
              )}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

/* --------------------------- Subcomponentes --------------------------- */

function QuestionSection({
  section,
  answers,
  errors,
  update,
  visible,
}: {
  section: Section;
  answers: Record<number, Answer>;
  errors: Record<number, string>;
  update: (id: number, answer: Answer) => void;
  visible: (question: Question) => boolean;
}) {
  const preguntas = section.preguntas.filter(visible);

  return (
    <div className="space-y-6">
      {preguntas.length === 0 ? (
        <div className="rounded-2xl bg-brand-50 p-5 text-sm text-slate-500">
          Esta sección no tiene preguntas visibles.
        </div>
      ) : (
        preguntas.map((question) => (
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

const inputBase =
  "block w-full rounded-2xl border bg-white px-4 py-3.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none transition focus:ring-4";
const inputOk =
  "border-slate-200 focus:border-brand-500 focus:ring-brand-500/10";
const inputErr =
  "border-rose-400 bg-rose-50 focus:border-rose-500 focus:ring-rose-500/10";

const optionCard =
  "group flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 transition hover:border-slate-300 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50 has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-brand-500/15 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50 has-[:disabled]:hover:border-slate-200";
const optionText =
  "text-sm font-medium text-slate-700 group-has-[:checked]:font-semibold group-has-[:checked]:text-slate-900";

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
  const isGroup =
    (kind === "unica" || kind === "multiple") && options.length > 0;
  const inputClass = `${inputBase} ${error ? inputErr : inputOk}`;

  const textHandlers = {
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      update({ valorTexto: filtrarTexto(event.target.value, reglas) }),
    onKeyDown: (event: KeyboardEvent) => {
      if (reglas.permitirEspacios === false && event.key === " ") {
        event.preventDefault();
      }
    },
  };

  return (
    <div className="space-y-2.5">
      <label
        htmlFor={isGroup ? undefined : inputId}
        className="block text-xs font-extrabold uppercase leading-snug tracking-wider text-slate-800"
      >
        {question.enunciado}
        {question.obligatoria && (
          <span className="ml-0.5 text-brand-500" aria-label="obligatorio">
            {" "}
            *
          </span>
        )}
      </label>

      {kind === "multiple" && isGroup && (
        <p className="text-[11px] font-medium text-slate-500">
          {reglas.maxSeleccion
            ? `Selecciona hasta ${reglas.maxSeleccion} opciones`
            : "Puedes seleccionar más de una opción"}
        </p>
      )}

      {kind === "textarea" ? (
        <>
          <textarea
            id={inputId}
            value={answer.valorTexto || ""}
            rows={4}
            maxLength={reglas.maxLength}
            placeholder="Escribe tu respuesta..."
            aria-invalid={!!error}
            className={`${inputClass} resize-y`}
            {...textHandlers}
          />
          {reglas.maxLength !== undefined && (
            <p className="text-right text-[11px] text-slate-400">
              {(answer.valorTexto || "").length}/{reglas.maxLength}
            </p>
          )}
        </>
      ) : kind === "numero" ? (
        <input
          id={inputId}
          type="number"
          inputMode={reglas.esEntero ? "numeric" : "decimal"}
          value={answer.valorNumero ?? ""}
          min={reglas.min}
          max={reglas.max}
          step={reglas.esEntero ? 1 : "any"}
          placeholder="Ingresa un número"
          aria-invalid={!!error}
          className={inputClass}
          onChange={(event) => {
            const raw = event.target.value;
            if (raw === "") {
              update({ valorNumero: undefined });
              return;
            }
            let num = Number(raw);
            if (Number.isNaN(num)) return;
            if (reglas.max !== undefined && num > reglas.max) num = reglas.max;
            if (reglas.esEntero) num = Math.trunc(num);
            update({ valorNumero: num });
          }}
          onKeyDown={(event) => {
            if (reglas.esEntero && (event.key === "." || event.key === ",")) {
              event.preventDefault();
            }
          }}
        />
      ) : kind === "unica" && options.length > 0 ? (
        <div className="space-y-2.5">
          {options.map((option) => (
            <label className={optionCard} key={option.id}>
              <span className={optionText}>{option.texto}</span>
              <input
                type="radio"
                name={inputId}
                className="peer sr-only"
                checked={answer.opcionId === option.id}
                onChange={() => update({ opcionId: option.id })}
              />
              <span className="h-4 w-4 shrink-0 rounded-full border border-slate-300 bg-white transition peer-checked:border-brand-500 peer-checked:bg-brand-500 peer-checked:ring-4 peer-checked:ring-brand-100" />
            </label>
          ))}
        </div>
      ) : kind === "multiple" && options.length > 0 ? (
        <div className="space-y-2.5">
          {options.map((option) => {
            const seleccionadas = answer.opciones || [];
            const yaSeleccionada = seleccionadas.includes(option.id);
            const alcanzoMax =
              reglas.maxSeleccion !== undefined &&
              seleccionadas.length >= reglas.maxSeleccion &&
              !yaSeleccionada;

            return (
              <label className={optionCard} key={option.id}>
                <span className={optionText}>{option.texto}</span>
                <input
                  type="checkbox"
                  name={inputId}
                  className="peer sr-only"
                  checked={yaSeleccionada}
                  disabled={alcanzoMax}
                  onChange={(event) =>
                    update({
                      opciones: event.target.checked
                        ? [...seleccionadas, option.id]
                        : seleccionadas.filter((id) => id !== option.id),
                    })
                  }
                />
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white text-white transition peer-checked:border-brand-500 peer-checked:bg-brand-500">
                  <Check
                    className="h-3.5 w-3.5 opacity-0 transition group-has-[:checked]:opacity-100"
                    strokeWidth={3}
                  />
                </span>
              </label>
            );
          })}
        </div>
      ) : kind === "fecha" ? (
        <input
          id={inputId}
          type="date"
          value={answer.valorTexto || ""}
          min={reglas.minFecha}
          max={reglas.maxFecha}
          aria-invalid={!!error}
          className={inputClass}
          onChange={(event) => update({ valorTexto: event.target.value })}
          onClick={abrirPicker}
          onFocus={abrirPicker}
        />
      ) : kind === "hora" ? (
        <input
          id={inputId}
          type="time"
          value={answer.valorTexto || ""}
          aria-invalid={!!error}
          className={inputClass}
          onChange={(event) => update({ valorTexto: event.target.value })}
          onClick={abrirPicker}
          onFocus={abrirPicker}
        />
      ) : kind === "fechaHora" ? (
        <input
          id={inputId}
          type="datetime-local"
          value={answer.valorTexto || ""}
          min={reglas.minFecha ? `${reglas.minFecha}T00:00` : undefined}
          max={reglas.maxFecha ? `${reglas.maxFecha}T23:59` : undefined}
          aria-invalid={!!error}
          className={inputClass}
          onChange={(event) => update({ valorTexto: event.target.value })}
          onClick={abrirPicker}
          onFocus={abrirPicker}
        />
      ) : kind === "email" ? (
        <input
          id={inputId}
          type="email"
          value={answer.valorTexto || ""}
          maxLength={reglas.maxLength}
          placeholder="correo@ejemplo.com"
          aria-invalid={!!error}
          className={inputClass}
          onChange={(event) =>
            update({ valorTexto: event.target.value.trim() })
          }
        />
      ) : (
        <input
          id={inputId}
          type="text"
          value={answer.valorTexto || ""}
          maxLength={reglas.maxLength}
          placeholder="Escribe tu respuesta..."
          aria-invalid={!!error}
          className={inputClass}
          {...textHandlers}
        />
      )}

      {error && (
        <p className="flex items-center gap-1.5 text-xs font-medium text-rose-600">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

export default PublicRegistrationApp;
