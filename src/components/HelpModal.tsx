import { useState } from 'react';
import { X, Zap, LayoutGrid, Radio } from 'lucide-react';
import { cn } from '../lib/utils';

interface HelpModalProps {
  onClose: () => void;
}

type Tab = 'copilot' | 'crm' | 'canales';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'copilot', label: 'Copilot', icon: <Zap className="w-3.5 h-3.5" /> },
  { id: 'crm', label: 'CRM', icon: <LayoutGrid className="w-3.5 h-3.5" /> },
  { id: 'canales', label: 'Canales', icon: <Radio className="w-3.5 h-3.5" /> },
];

// Chips for example commands
function CommandChip({ text, onCopy }: { text: string; onCopy?: (t: string) => void }) {
  return (
    <button
      onClick={() => onCopy?.(text)}
      title="Copiar al portapapeles"
      className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-purple-100 hover:text-purple-700 text-slate-600 text-xs rounded-full transition-colors cursor-pointer border border-transparent hover:border-purple-200"
    >
      "{text}"
    </button>
  );
}

// Section heading inside modal
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 mt-5 first:mt-0">
      {children}
    </h3>
  );
}

export default function HelpModal({ onClose }: HelpModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('copilot');
  const [copied, setCopied] = useState<string | null>(null);

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(text);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Card */}
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-500 rounded-t-2xl px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-white font-bold text-lg">📖 Guía de ClienteLoop</h2>
            <p className="text-purple-100 text-xs mt-0.5">Todo lo que puedes hacer con tu CRM</p>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 py-3 border-b border-slate-100 shrink-0 bg-slate-50 rounded-none">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all',
                activeTab === tab.id
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100',
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Copy toast */}
        {copied && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs px-3 py-1.5 rounded-full shadow-lg z-10 pointer-events-none">
            ✓ Copiado al portapapeles
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* ─── TAB: COPILOT ─── */}
          {activeTab === 'copilot' && (
            <div>
              <p className="text-sm text-slate-600 mb-4 leading-relaxed">
                El <span className="font-semibold text-purple-700">Copilot</span> es tu empleado virtual. Habla con él en lenguaje natural — como si fuera WhatsApp — y accederá a los datos reales de tu negocio, creará cosas y enviará mensajes. Haz clic en cualquier ejemplo para copiarlo.
              </p>

              <SectionTitle>Consultar datos</SectionTitle>
              <div className="flex flex-wrap gap-2 mb-1">
                {[
                  '¿Cuántos leads nuevos tengo hoy?',
                  '¿Quién no ha respondido en 3 días?',
                  'Resumen del pipeline esta semana',
                  'Busca conversaciones sobre precios',
                  '¿Cuántas citas tengo mañana?',
                  '¿Cuál es el deal más valioso en proceso?',
                ].map((t) => <CommandChip key={t} text={t} onCopy={handleCopy} />)}
              </div>

              <SectionTitle>Crear o modificar</SectionTitle>
              <div className="flex flex-wrap gap-2 mb-1">
                {[
                  'Crea respuesta rápida para cotizaciones',
                  'Agrega a Juan Pérez como contacto de WhatsApp',
                  'Actualiza mi IA para que sepa el horario',
                  'Guarda que mis precios incluyen IVA',
                  'Crea tarea: llamar a María mañana a las 10am',
                  'Mueve a Carlos a la etapa "Propuesta enviada"',
                ].map((t) => <CommandChip key={t} text={t} onCopy={handleCopy} />)}
              </div>

              <SectionTitle>Seguimientos</SectionTitle>
              <div className="flex flex-wrap gap-2 mb-1">
                {[
                  'Manda seguimiento a Carlos que lleva 3 días sin responder',
                  'Genera mensaje de seguimiento para cliente con cotización enviada',
                  'Lista leads sin respuesta hace más de 5 días',
                ].map((t) => <CommandChip key={t} text={t} onCopy={handleCopy} />)}
              </div>

              <SectionTitle>Automático vs Confirmación</SectionTitle>
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-green-700 border-r border-slate-200">
                        ✅ Hace solo (automático)
                      </th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-amber-700">
                        🔔 Pide tu aprobación primero
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[
                      ['Consultar estadísticas', 'Crear tarea'],
                      ['Ver contactos y pipeline', 'Crear respuesta rápida'],
                      ['Buscar conversaciones', 'Actualizar contexto IA'],
                      ['Guardar memorias del negocio', 'Agregar contacto'],
                      ['', 'Enviar mensaje de seguimiento'],
                    ].map(([auto, confirm], i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-4 py-2 text-slate-600 border-r border-slate-100 text-xs">{auto || '—'}</td>
                        <td className="px-4 py-2 text-slate-600 text-xs">{confirm}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 p-3 bg-purple-50 rounded-xl border border-purple-100">
                <p className="text-xs text-purple-700">
                  💡 <span className="font-semibold">Tip:</span> Si el Copilot no puede hacer algo (como enviar emails o acceder a otros sistemas), te lo dirá al instante en lugar de inventarse una respuesta.
                </p>
              </div>
            </div>
          )}

          {/* ─── TAB: CRM ─── */}
          {activeTab === 'crm' && (
            <div>
              <p className="text-sm text-slate-600 mb-4 leading-relaxed">
                Cada sección del menú lateral tiene una función específica. Aquí un resumen rápido.
              </p>
              <div className="space-y-2">
                {[
                  { icon: '📊', name: 'Dashboard', desc: 'Métricas del negocio al día: leads nuevos, conversaciones abiertas, tareas y citas pendientes.' },
                  { icon: '💬', name: 'Inbox', desc: 'Todos los mensajes de WhatsApp e Instagram en un solo lugar. Responde, usa plantillas y asigna conversaciones.' },
                  { icon: '👥', name: 'Contactos', desc: 'Tu base de clientes y leads con etiquetas, etapa del pipeline, canal y notas.' },
                  { icon: '🎯', name: 'Pipeline', desc: 'Vista Kanban del embudo de ventas. Arrastra tarjetas entre etapas para actualizar el estado de cada deal.' },
                  { icon: '✅', name: 'Tareas', desc: 'Recordatorios y seguimientos con fecha y hora. El Copilot puede crearlas por ti.' },
                  { icon: '📅', name: 'Citas', desc: 'Agenda de citas. Tus clientes pueden reservar directamente desde tu link público.' },
                  { icon: '📢', name: 'Difusión', desc: 'Envía mensajes masivos de WhatsApp a segmentos de contactos. Ideal para promociones y anuncios.' },
                  { icon: '📈', name: 'Reportes', desc: 'Estadísticas de mensajes enviados, tasa de respuesta, conversiones y rendimiento del equipo.' },
                  { icon: '⚙️', name: 'Ajustes', desc: 'Configura canales (WhatsApp), plantillas de mensajes, la IA del negocio, tu equipo y la facturación.' },
                ].map(({ icon, name, desc }) => (
                  <div key={name} className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all">
                    <span className="text-xl shrink-0 mt-0.5">{icon}</span>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{name}</p>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 p-3 bg-blue-50 rounded-xl border border-blue-100">
                <p className="text-xs text-blue-700">
                  💡 <span className="font-semibold">Tip:</span> Puedes usar el Copilot para operar cualquier sección con lenguaje natural, o hacerlo manualmente — ambas formas coexisten.
                </p>
              </div>
            </div>
          )}

          {/* ─── TAB: CANALES ─── */}
          {activeTab === 'canales' && (
            <div className="space-y-6">
              {/* WhatsApp */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">💬</span>
                  <h3 className="font-bold text-slate-800">WhatsApp Business</h3>
                </div>
                <div className="space-y-1.5 text-sm text-slate-600 pl-7">
                  <p>• Requiere cuenta Meta Business y número de teléfono verificado.</p>
                  <p>• Actívalo en <span className="font-medium text-purple-700">Ajustes → Canales → WhatsApp</span>.</p>
                  <p>• Cuando está activo (<code className="text-xs bg-slate-100 px-1 py-0.5 rounded">ENABLE_CHANNELS=true</code>), los mensajes reales se envían a tus clientes.</p>
                  <p>• El Copilot puede redactar y proponer mensajes, pero siempre pide confirmación antes de enviar.</p>
                </div>
              </div>

              {/* Respuestas Rápidas */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">⚡</span>
                  <h3 className="font-bold text-slate-800">Respuestas Rápidas</h3>
                </div>
                <div className="space-y-1.5 text-sm text-slate-600 pl-7">
                  <p>• Plantillas de mensaje reutilizables que se insertan en el Inbox con un clic.</p>
                  <p>• Créalas manualmente en <span className="font-medium text-purple-700">Ajustes → Plantillas</span>.</p>
                  <p>• O dile al Copilot:</p>
                  <CommandChip text="Crea respuesta rápida para confirmar citas" onCopy={handleCopy} />
                  <p className="mt-1">• En el Inbox, usa el botón <span className="font-medium">⚡</span> en el compositor para insertarlas.</p>
                </div>
              </div>

              {/* IA del negocio */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">🧠</span>
                  <h3 className="font-bold text-slate-800">IA del Negocio</h3>
                </div>
                <div className="space-y-1.5 text-sm text-slate-600 pl-7">
                  <p>• La IA responde en piloto automático cuando <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">ENABLE_AUTO_REPLY=true</code>.</p>
                  <p>• Su personalidad y conocimiento del negocio se definen en <span className="font-medium text-purple-700">Ajustes → IA del Negocio</span>.</p>
                  <p>• Puedes actualizarla desde el Copilot con lenguaje natural:</p>
                  <CommandChip text="Actualiza la IA para que sepa que ya no abrimos los domingos" onCopy={handleCopy} />
                  <p className="mt-1">• La IA también aprende automáticamente cada vez que el Copilot guarda una memoria nueva.</p>
                </div>
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                <p className="text-xs text-amber-700">
                  ⚠️ <span className="font-semibold">Importante:</span> Los mensajes de WhatsApp solo se envían realmente cuando el canal está configurado y activo. Sin configuración, todo funciona en modo simulación.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 text-center shrink-0">
          <p className="text-[11px] text-slate-400">
            ClienteLoop · Powered by Claude Sonnet · <span className="text-purple-500 font-medium">Haz clic en cualquier ejemplo para copiarlo</span>
          </p>
        </div>
      </div>
    </div>
  );
}
