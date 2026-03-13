import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  CalendarDays, Clock, User, Phone, Mail, ChevronRight,
  ChevronLeft, CheckCircle2, Loader2, AlertCircle, Scissors,
} from 'lucide-react';
import { cn } from '../lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────
interface PublicService {
  id: number;
  name: string;
  duration_minutes: number;
  price: number | null;
}

interface PublicBusiness {
  id: number;
  name: string;
  nicho: string;
  booking_slug: string | null;
}

interface BookingInfo {
  business: PublicBusiness;
  services: PublicService[];
}

interface BookingResult {
  appointment: {
    id: number;
    title: string;
    start_time: string;
    end_time: string;
    duration_minutes: number;
    status: string;
  };
  business_name: string;
}

// ─── API helpers (no auth) ────────────────────────────────────────────────────
const BASE = import.meta.env.VITE_API_URL || '/api';

async function fetchBookingInfo(slug: string): Promise<BookingInfo> {
  const r = await fetch(`${BASE}/public/book/${slug}`);
  if (!r.ok) throw new Error((await r.json()).error ?? 'Error');
  return r.json();
}

async function fetchSlots(slug: string, date: string, duration: number): Promise<string[]> {
  const r = await fetch(`${BASE}/public/book/${slug}/slots?date=${date}&duration=${duration}`);
  if (!r.ok) return [];
  return r.json();
}

async function submitBooking(slug: string, payload: object): Promise<BookingResult> {
  const r = await fetch(`${BASE}/public/book/${slug}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error ?? 'Error al reservar');
  return data;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function toDateStr(d: Date) {
  return d.toISOString().split('T')[0];
}

function formatCurrency(n: number | null) {
  if (!n) return null;
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    + ' · ' + d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });
}

// ─── Step components ──────────────────────────────────────────────────────────

interface StepIndicatorProps {
  current: number; // 1-based
  total: number;
}
function StepIndicator({ current, total }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={cn(
            'h-1.5 rounded-full transition-all duration-300',
            i + 1 < current ? 'w-6 bg-blue-600' :
            i + 1 === current ? 'w-8 bg-blue-600' :
            'w-4 bg-slate-200'
          )}
        />
      ))}
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function BookingPage() {
  const { slug } = useParams<{ slug: string }>();

  const [info, setInfo]         = useState<BookingInfo | null>(null);
  const [loadError, setLoadError] = useState('');
  const [step, setStep]         = useState(1); // 1: service, 2: datetime, 3: contact, 4: done

  // Step 1 — service
  const [selectedService, setSelectedService] = useState<PublicService | null>(null);

  // Step 2 — datetime
  const [date, setDate]         = useState(toDateStr(new Date()));
  const [slots, setSlots]       = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedTime, setSelectedTime] = useState('');

  // Step 3 — contact info
  const [clientName, setClientName]   = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [notes, setNotes]             = useState('');
  const [submitting, setSubmitting]   = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Step 4 — confirmation
  const [result, setResult] = useState<BookingResult | null>(null);

  // Load business info
  useEffect(() => {
    if (!slug) return;
    fetchBookingInfo(slug)
      .then(setInfo)
      .catch((e) => setLoadError(e.message ?? 'Negocio no encontrado'));
  }, [slug]);

  // Load slots when date or service changes (step 2)
  useEffect(() => {
    if (step !== 2 || !slug || !date) return;
    const duration = selectedService?.duration_minutes ?? 60;
    setLoadingSlots(true);
    setSelectedTime('');
    fetchSlots(slug, date, duration)
      .then(setSlots)
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [step, date, selectedService, slug]);

  async function handleSubmit() {
    if (!clientName.trim() || !selectedTime || !slug) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await submitBooking(slug, {
        service_id: selectedService?.id ?? null,
        start_time: `${date}T${selectedTime}:00`,
        duration_minutes: selectedService?.duration_minutes ?? 60,
        client_name: clientName.trim(),
        client_phone: clientPhone.trim(),
        client_email: clientEmail.trim(),
        notes: notes.trim(),
      });
      setResult(res);
      setStep(4);
    } catch (e: any) {
      setSubmitError(e.message ?? 'Error al reservar. Intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Loading / Error ────────────────────────────────────────────────────────
  if (!info && !loadError) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <h2 className="font-bold text-slate-700 text-lg mb-1">Página no encontrada</h2>
          <p className="text-sm text-slate-400">{loadError}</p>
        </div>
      </div>
    );
  }

  const business = info!.business;
  const services = info!.services;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col">
      {/* ── Header ── */}
      <header className="bg-white border-b border-slate-200 py-4 px-6 flex items-center gap-3 shadow-sm">
        <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center font-bold text-white text-sm shrink-0">
          {business.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <h1 className="font-bold text-slate-800 leading-tight">{business.name}</h1>
          <p className="text-[11px] text-slate-400 capitalize">{business.nicho.replace(/_/g, ' ')}</p>
        </div>
        <div className="ml-auto">
          <span className="text-[10px] bg-emerald-100 text-emerald-700 font-medium px-2 py-0.5 rounded-full">
            Reserva en línea
          </span>
        </div>
      </header>

      {/* ── Content ── */}
      <div className="flex-1 flex items-start justify-center p-4 sm:p-8">
        <div className="w-full max-w-md">

          {/* ── STEP 1: Service ─────────────────────────────────────────────── */}
          {step === 1 && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <StepIndicator current={1} total={3} />
              <h2 className="text-base font-bold text-slate-800 mb-1">¿Qué servicio necesitas?</h2>
              <p className="text-xs text-slate-400 mb-5">Elige el servicio para ver disponibilidad</p>

              {services.length === 0 ? (
                <div className="text-center py-8">
                  <Scissors className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">Sin servicios disponibles por el momento.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {services.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => { setSelectedService(s); setStep(2); }}
                      className={cn(
                        'w-full text-left px-4 py-3.5 rounded-xl border transition-all flex items-center gap-3',
                        'hover:border-blue-400 hover:shadow-sm',
                        selectedService?.id === s.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-slate-200 bg-white'
                      )}
                    >
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                        <Scissors className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm text-slate-800">{s.name}</div>
                        <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <Clock className="w-3 h-3" />
                          {s.duration_minutes} min
                          {s.price && (
                            <> · <span className="text-emerald-600 font-medium">{formatCurrency(s.price)}</span></>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                    </button>
                  ))}

                  {/* No specific service option */}
                  <button
                    onClick={() => { setSelectedService(null); setStep(2); }}
                    className="w-full text-left px-4 py-3 rounded-xl border border-dashed border-slate-300 text-slate-500 hover:border-blue-400 hover:text-blue-600 transition-colors text-sm flex items-center gap-2"
                  >
                    <ChevronRight className="w-4 h-4" />
                    Solo quiero reservar una hora
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 2: Date & Time ─────────────────────────────────────────── */}
          {step === 2 && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <StepIndicator current={2} total={3} />

              {/* Back */}
              <button onClick={() => setStep(1)} className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 mb-4 transition-colors">
                <ChevronLeft className="w-3.5 h-3.5" /> Cambiar servicio
              </button>

              {/* Selected service chip */}
              {selectedService && (
                <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 mb-4">
                  <Scissors className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <span className="text-xs font-medium text-blue-700">{selectedService.name}</span>
                  <span className="text-xs text-blue-400 ml-auto">{selectedService.duration_minutes} min</span>
                </div>
              )}

              <h2 className="text-base font-bold text-slate-800 mb-1">Elige fecha y hora</h2>
              <p className="text-xs text-slate-400 mb-4">Solo se muestran los horarios disponibles</p>

              {/* Date picker */}
              <div className="mb-4">
                <label className="text-xs font-medium text-slate-600 mb-1.5 block flex items-center gap-1">
                  <CalendarDays className="w-3.5 h-3.5" /> Fecha
                </label>
                <input
                  type="date"
                  value={date}
                  min={toDateStr(new Date())}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Time slots grid */}
              <div>
                <label className="text-xs font-medium text-slate-600 mb-2 block flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  Horarios disponibles
                  {loadingSlots && <Loader2 className="w-3 h-3 animate-spin ml-1" />}
                </label>

                {!loadingSlots && slots.length === 0 ? (
                  <p className="text-xs text-slate-400 bg-slate-50 rounded-xl px-4 py-4 text-center">
                    Sin disponibilidad para este día.<br />Prueba con otra fecha.
                  </p>
                ) : (
                  <div className="grid grid-cols-4 gap-1.5 max-h-48 overflow-y-auto pr-1">
                    {slots.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSelectedTime(s)}
                        className={cn(
                          'px-2 py-2 text-xs font-medium rounded-lg border transition-all',
                          selectedTime === s
                            ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                            : 'border-slate-200 text-slate-700 hover:border-blue-400 hover:bg-blue-50'
                        )}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={() => setStep(3)}
                disabled={!selectedTime}
                className="mt-5 w-full py-3 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                Continuar <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ── STEP 3: Contact info ────────────────────────────────────────── */}
          {step === 3 && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <StepIndicator current={3} total={3} />

              <button onClick={() => setStep(2)} className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 mb-4 transition-colors">
                <ChevronLeft className="w-3.5 h-3.5" /> Cambiar horario
              </button>

              {/* Summary chip */}
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 mb-4">
                <CalendarDays className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span className="text-xs font-medium text-emerald-700">
                  {new Date(date).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })} · {selectedTime}
                </span>
                {selectedService && (
                  <span className="text-xs text-emerald-500 ml-auto">{selectedService.name}</span>
                )}
              </div>

              <h2 className="text-base font-bold text-slate-800 mb-1">Tus datos</h2>
              <p className="text-xs text-slate-400 mb-4">Solo necesitamos tu nombre para confirmar</p>

              <div className="space-y-3">
                {/* Name */}
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block flex items-center gap-1">
                    <User className="w-3.5 h-3.5" /> Nombre *
                  </label>
                  <input
                    type="text"
                    required
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Tu nombre completo"
                    autoFocus
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5" /> WhatsApp / Teléfono
                  </label>
                  <input
                    type="tel"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    placeholder="+52 55 1234 5678"
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5" /> Email <span className="text-slate-300">(opcional)</span>
                  </label>
                  <input
                    type="email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    placeholder="tu@correo.com"
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">
                    Notas (opcional)
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Preferencias, instrucciones especiales..."
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>
              </div>

              {submitError && (
                <div className="mt-3 flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {submitError}
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={submitting || !clientName.trim()}
                className="mt-5 w-full py-3 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Reservando...</>
                ) : (
                  <><CheckCircle2 className="w-4 h-4" /> Confirmar cita</>
                )}
              </button>

              <p className="text-[10px] text-slate-300 text-center mt-3">
                Tus datos están seguros y solo se usarán para gestionar tu cita.
              </p>
            </div>
          )}

          {/* ── STEP 4: Confirmation ────────────────────────────────────────── */}
          {step === 4 && result && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 text-center">
              {/* Checkmark animation */}
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-9 h-9 text-emerald-500" />
              </div>

              <h2 className="text-lg font-bold text-slate-800 mb-1">¡Cita confirmada!</h2>
              <p className="text-sm text-slate-400 mb-5">Te esperamos en {result.business_name}</p>

              {/* Appointment details */}
              <div className="bg-slate-50 rounded-xl p-4 text-left space-y-2 mb-5">
                <div className="flex items-center gap-2 text-sm text-slate-700">
                  <Scissors className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="font-medium">{result.appointment.title}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <CalendarDays className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>{formatDateTime(result.appointment.start_time)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>{result.appointment.duration_minutes} minutos</span>
                </div>
              </div>

              <p className="text-xs text-slate-400">
                Si necesitas cancelar o reprogramar, comunícate directamente con el negocio.
              </p>

              {/* Powered by */}
              <div className="mt-6 pt-4 border-t border-slate-100">
                <p className="text-[10px] text-slate-300">
                  Reserva gestionada con{' '}
                  <a href="https://clienteloop.com" target="_blank" rel="noopener" className="text-blue-400 hover:text-blue-500">
                    ClienteLoop
                  </a>
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
