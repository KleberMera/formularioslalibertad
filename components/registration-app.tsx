'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, ClipboardList, FileText, Loader2, LockKeyhole, LogOut, MapPin, UsersRound } from 'lucide-react'
import Swal from 'sweetalert2'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://lalibertadendatos.com/formularioglobal/api'

type Option = { id: number; orden: number; texto: string; valor: string }
type Question = { id: number; orden: number; codigo: string; enunciado: string; tipo: string; obligatoria: boolean; dependeDePreguntaId: number | null; dependeDeOpcionId: number | null; opciones?: Option[] }
type Section = { nombre: string; orden: number; preguntas: Question[] }
type FormSummary = { id: number; nombre: string; descripcion: string; version: number; eventoId: number | null; eventoNombre: string | null; capturaDatosPersonales?: boolean }
type User = { id: number; nombres: string; apellidos: string; cedula: string; celular: string; rolId: number; rol?: { nombre: string }; formularios?: FormSummary[] }
type FormSchema = { id: number; nombre: string; descripcion: string; version: number; secciones: Section[] }
type Answer = { valorTexto?: string; valorNumero?: number; opcionId?: number; opciones?: number[] }
type PersonalData = { nombres: string; apellidos: string; edad: string; telefono: string; observacion: string }

const emptyPersonal: PersonalData = { nombres: '', apellidos: '', edad: '', telefono: '', observacion: '' }

async function request(path: string, options: RequestInit = {}) {
  const response = await fetch(`${API_URL}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } })
  const body = await response.json()
  if (!response.ok || body.status >= 400) throw new Error(body.message || 'No se pudo completar la solicitud')
  return body.data
}

export function RegistrationApp() {
  const [user, setUser] = useState<User | null>(null)
  const [view, setView] = useState<'login' | 'form' | 'select' | 'access'>('login')
  const [formId, setFormId] = useState<number | null>(null)

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('user') || 'null') as User | null
      if (saved) { setUser(saved); setFormId(saved.formularios?.[0]?.id || null); setView(saved.rolId === 2 ? (saved.formularios?.length === 1 ? 'form' : 'select') : 'access') }
    } catch { /* empty session */ }
  }, [])

  function login(nextUser: User) { localStorage.setItem('user', JSON.stringify(nextUser)); setUser(nextUser); setFormId(nextUser.formularios?.[0]?.id || null); setView(nextUser.rolId === 2 ? (nextUser.formularios?.length === 1 ? 'form' : 'select') : 'access') }
  function logout() { localStorage.removeItem('user'); setUser(null); setView('login') }
  if (view === 'login') return <Login onLogin={login} />
  return <div className="app-shell"><Header user={user!} onLogout={logout} />{view === 'form' && formId ? <DynamicForm user={user!} formId={formId} /> : view === 'select' ? <FormSelection user={user!} onSelect={(id) => { setFormId(id); setView('form') }} /> : <ComingSoon title="Rol sin acceso" copy="Tu usuario todavía no tiene un formulario asignado." />}</div>
}

function Login({ onLogin }: { onLogin: (user: User) => void }) {
  const [cedula, setCedula] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(false)
  async function submit(event: FormEvent) { event.preventDefault(); setLoading(true); setError(''); try { onLogin(await request('/auth/login', { method: 'POST', body: JSON.stringify({ cedula, password }) })) } catch (error) { setError(error instanceof Error ? error.message : 'Verifica tus credenciales.') } finally { setLoading(false) } }
  return <main className="login-shell"><section className="login-art"><div className="sun-glow" /><div className="art-content"><span className="eyebrow">SANTA ELENA · ECUADOR</span><h1>Registros<br /><em>que conectan.</em></h1><p>Una plataforma clara y sencilla para gestionar formularios de participación ciudadana.</p></div><div className="orange-ribbon" /></section><section className="login-panel"><div className="login-card"><Brand /><div className="login-heading"><span className="eyebrow dark">ACCESO SEGURO</span><h2>Bienvenido de vuelta</h2><p>Ingresa tus datos para continuar.</p></div><form onSubmit={submit} className="login-form"><Field label="Cédula" value={cedula} onChange={setCedula} required /><Field label="Contraseña" type="password" value={password} onChange={setPassword} required />{error && <div className="error-box">{error}</div>}<button className="primary-button" disabled={loading}>{loading ? <Loader2 className="spin" /> : 'Iniciar sesión'}{!loading && <ArrowRight />}</button></form></div></section></main>
}

function Brand() { return <div className="brand"><div className="brand-icon"><ClipboardList /></div><div><strong>La Libertad</strong><span>Registro de formularios</span></div></div> }
function Header({ user, onLogout }: { user: User; onLogout: () => void }) { return <header className="app-header"><Brand /><div className="user-menu"><div className="avatar">{user.nombres?.[0]}{user.apellidos?.[0]}</div><div className="user-meta"><strong>{user.nombres} {user.apellidos}</strong><span>{user.rol?.nombre || 'REGISTRADOR'}</span></div><button onClick={onLogout} aria-label="Cerrar sesión"><LogOut /></button></div></header> }
function FormSelection({ user, onSelect }: { user: User; onSelect: (id: number) => void }) { return <main className="page-wrap narrow"><div className="page-kicker">HOLA, {user.nombres.toUpperCase()}</div><h1>Selecciona un formulario</h1><p className="lead">Elige el registro que deseas gestionar hoy.</p><div className="form-grid">{user.formularios?.map((form) => <button className="form-option" key={form.id} onClick={() => onSelect(form.id)}><div className="option-icon"><ClipboardList /></div><div><strong>{form.nombre}</strong><span>{form.descripcion || 'Formulario de registro'}</span></div><ArrowRight /></button>)}</div></main> }

function DynamicForm({ user, formId }: { user: User; formId: number }) {
  const [schema, setSchema] = useState<FormSchema | null>(null); const [answers, setAnswers] = useState<Record<number, Answer>>({}); const [personal, setPersonal] = useState(emptyPersonal); const [step, setStep] = useState(0); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [notice, setNotice] = useState('')
  const capturePersonal = user.formularios?.find((form) => form.id === formId)?.capturaDatosPersonales === true
  useEffect(() => { setLoading(true); request(`/formulario/${formId}`).then(setSchema).catch((error) => setNotice(error.message)).finally(() => setLoading(false)) }, [formId])
  const sections = useMemo(() => { if (!schema) return []; const dynamic = [...schema.secciones].sort((a, b) => a.orden - b.orden); return capturePersonal ? [{ nombre: 'Datos personales', orden: 0, preguntas: [] }, ...dynamic] : dynamic }, [schema, capturePersonal])
  const current = sections[step]; const visible = (question: Question) => !question.dependeDePreguntaId || answers[question.dependeDePreguntaId]?.opcionId === question.dependeDeOpcionId; const questions = current?.preguntas.filter(visible) || []
  function updateAnswer(id: number, answer: Answer) { setAnswers((previous) => ({ ...previous, [id]: { ...previous[id], ...answer } })) }
  function missingFields() {
    if (capturePersonal && step === 0) {
      const missing = []
      if (!personal.nombres.trim()) missing.push('Nombres')
      if (!personal.apellidos.trim()) missing.push('Apellidos')
      if (!personal.edad) missing.push('Edad')
      if (!/^\d{7,10}$/.test(personal.telefono)) missing.push('Teléfono celular (7 a 10 dígitos)')
      return missing
    }
    return questions.flatMap((question) => {
      if (!question.obligatoria) return []
      const answer = answers[question.id]
      const type = String(question.tipo || 'TEXTO').toUpperCase().replace(/[-_ ]/g, '')
      const empty = !answer || (type === 'MULTIPLE' || type === 'MULTI' || type === 'CHECKBOX' ? !answer.opciones?.length : type === 'UNICA' || type === 'UNIQUE' || type === 'RADIO' || type === 'SELECT' ? !answer.opcionId : !answer.valorTexto?.trim() && answer.valorNumero === undefined)
      return empty ? [question.enunciado] : []
    })
  }
  function valid() { return missingFields().length === 0 }
  async function validateAndContinue() {
    const missing = missingFields()
    if (missing.length) { await Swal.fire({ icon: 'warning', title: 'Campos obligatorios', html: `Completa: <strong>${missing.join(', ')}</strong>`, confirmButtonColor: '#f45116' }); return }
    setStep((currentStep) => currentStep + 1)
  }
  async function finish() {
    setSaving(true)
    setNotice('')
    try {
      const form = user.formularios?.find((item) => item.id === formId)
      const respuestas = Object.entries(answers).map(([preguntaId, answer]) => ({ preguntaId: Number(preguntaId), ...answer }))
      const payload = {
        eventoId: form?.eventoId,
        registradorId: user.id,
        nombres: personal.nombres || undefined,
        apellidos: personal.apellidos || undefined,
        edad: personal.edad ? Number(personal.edad) : undefined,
        telefono: personal.telefono || undefined,
        observacion: personal.observacion || undefined,
        respuestas,
      }
      if (!payload.eventoId) throw new Error('El formulario no tiene un evento asignado.')
      await request(`/registro/${formId}`, { method: 'POST', body: JSON.stringify(payload) })
      await Swal.fire({ icon: 'success', title: 'Registro guardado', text: 'El registro se guardó correctamente.', confirmButtonColor: '#f45116' })
      setNotice(''); setAnswers({}); setPersonal(emptyPersonal); setStep(0)
    } catch (error) { await Swal.fire({ icon: 'error', title: 'No se pudo guardar', text: error instanceof Error ? error.message : 'Intenta nuevamente.', confirmButtonColor: '#f45116' }) } finally { setSaving(false) }
  }
  if (loading) return <main className="empty-state"><Loader2 className="spin" /><p>Cargando formulario...</p></main>
  if (!schema || !current) return <main className="empty-state"><h1>Formulario no disponible</h1><p>{notice || 'No encontramos preguntas para este formulario.'}</p></main>
  const percentage = Math.round(((step + 1) / sections.length) * 100)
  return <main className="registration-layout"><Progress steps={sections} current={step} onSelect={setStep} /><section className="form-card"><div className="form-card-header"><div><div className="page-kicker">PASO {step + 1} DE {sections.length}</div><h1>{current.nombre}</h1></div><span className="percent">{percentage}%</span><div className="progress-track"><span style={{ width: `${percentage}%` }} /></div></div><div className="form-content">{capturePersonal && step === 0 ? <PersonalFields value={personal} onChange={setPersonal} /> : <QuestionSection section={current} answers={answers} update={updateAnswer} />}{notice && <div className="success-box">{notice}</div>}</div><div className="form-actions"><button className="secondary-button" disabled={step === 0} onClick={() => setStep(step - 1)}><ArrowLeft /> Atrás</button>{step < sections.length - 1 ? <button className="primary-button" onClick={validateAndContinue}>Continuar <ArrowRight /></button> : <button className="primary-button" disabled={saving} onClick={async () => { if (!valid()) { const missing = missingFields(); await Swal.fire({ icon: 'warning', title: 'Campos obligatorios', html: `Completa: <strong>${missing.join(', ')}</strong>`, confirmButtonColor: '#f45116' }); return } finish() }}>{saving ? <Loader2 className="spin" /> : 'Guardar registro'}{!saving && <Check />}</button>}</div></section></main>
}

function Progress({ steps, current, onSelect }: { steps: Section[]; current: number; onSelect: (step: number) => void }) { return <aside className="progress-card"><span className="progress-title">PROGRESO</span><div className="progress-steps">{steps.map((section, index) => <button key={`${section.nombre}-${index}`} className={index === current ? 'current' : index < current ? 'done' : ''} onClick={() => index <= current && onSelect(index)}><span className="step-icon"><span className="step-number">{index + 1}</span><span className="step-symbol">{index < current ? <Check /> : index === 0 ? <UsersRound /> : index === 1 ? <MapPin /> : <FileText />}</span></span><span>{section.nombre}</span></button>)}</div><div className="protected"><LockKeyhole /> La información se utilizará únicamente para este registro.</div></aside> }
function PersonalFields({ value, onChange }: { value: PersonalData; onChange: (value: PersonalData) => void }) { const update = (key: keyof PersonalData, next: string) => onChange({ ...value, [key]: next }); return <div className="question-list"><div className="field-grid"><Field label="Nombres" required value={value.nombres} onChange={(next) => update('nombres', next)} /><Field label="Apellidos" required value={value.apellidos} onChange={(next) => update('apellidos', next)} /><Field label="Edad" required type="number" value={value.edad} onChange={(next) => update('edad', next)} /><Field label="Teléfono celular" required placeholder="7 a 10 dígitos" value={value.telefono} onChange={(next) => update('telefono', next)} /></div><label className="textarea-field">Observación<textarea value={value.observacion} onChange={(event) => update('observacion', event.target.value)} placeholder="Añade una observación si es necesario..." rows={4} /></label></div> }
function QuestionSection({ section, answers, update }: { section: Section; answers: Record<number, Answer>; update: (id: number, answer: Answer) => void }) { return <div className="question-list">{section.preguntas.length === 0 ? <div className="empty-questions">Esta sección no tiene preguntas visibles.</div> : section.preguntas.map((question) => <QuestionField key={question.id} question={question} answer={answers[question.id] || {}} update={(answer) => update(question.id, answer)} />)}</div> }
function QuestionField({ question, answer, update }: { question: Question; answer: Answer; update: (answer: Answer) => void }) {
  const type = String(question.tipo || 'TEXTO').toUpperCase().replace(/[-_ ]/g, '')
  const options = question.opciones || []
  const isLongText = type === 'TEXTAREA' || type === 'TEXTO_LARGO' || type === 'TEXTOLARGO'
  const isNumber = type === 'NUMERO' || type === 'NUMBER' || type === 'INTEGER' || type === 'DECIMAL'
  const isSingle = type === 'UNICA' || type === 'UNIQUE' || type === 'RADIO' || type === 'SELECT'
  const isMultiple = type === 'MULTIPLE' || type === 'MULTI' || type === 'CHECKBOX'

  return <div className="question">
    <label className="question-label"><span>{question.enunciado}</span>{question.obligatoria && <i aria-label="obligatorio"> *</i>}</label>
    {isLongText ? <textarea value={answer.valorTexto || ''} onChange={(event) => update({ valorTexto: event.target.value })} rows={4} placeholder="Escribe tu respuesta..." />
      : isNumber ? <input type="number" value={answer.valorNumero ?? ''} onChange={(event) => update({ valorNumero: event.target.value ? Number(event.target.value) : undefined })} placeholder="Ingresa un número" />
      : (isSingle || isMultiple) && options.length > 0 ? <div className="options">{options.map((option) => <label className="option" key={option.id}><input type={isSingle ? 'radio' : 'checkbox'} name={`q-${question.id}`} checked={isSingle ? answer.opcionId === option.id : answer.opciones?.includes(option.id) || false} onChange={(event) => isSingle ? update({ opcionId: option.id }) : update({ opciones: event.target.checked ? [...(answer.opciones || []), option.id] : (answer.opciones || []).filter((id) => id !== option.id) })} /><span>{option.texto}</span></label>)}</div>
      : <input type="text" value={answer.valorTexto || ''} onChange={(event) => update({ valorTexto: event.target.value })} placeholder="Escribe tu respuesta..." />}
  </div>
}
function Field({ label, required, value, onChange, type = 'text', placeholder }: { label: string; required?: boolean; value: string; onChange: (value: string) => void; type?: string; placeholder?: string }) { return <label><span>{label}{required && <i aria-label="obligatorio"> *</i>}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></label> }
function ComingSoon({ title, copy }: { title: string; copy: string }) { return <main className="empty-state"><div className="empty-icon"><ClipboardList /></div><div className="page-kicker">PRÓXIMAMENTE</div><h1>{title}</h1><p>{copy}</p></main> }

export type { User }

export default RegistrationApp
