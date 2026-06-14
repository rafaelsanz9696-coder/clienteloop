# Estado del Arte y Actualidad Tecnológica (2026)

Este documento sirve como referencia global de memoria para evitar tener que recordar en cada sesión de chat las realidades del mercado de inteligencia artificial actual.

---

## 1. Modelos de Lenguaje Disponibles

### Anthropic Claude
- **Claude 4.6 Sonnet:** Ya se encuentra disponible y es el estándar de rendimiento en tareas de codificación, razonamiento lógico y procesamiento de lenguaje.
- **Claude 4.7 Opus:** Es el modelo insignia de Anthropic, con capacidades de razonamiento profundo ultra avanzadas.

### Google Gemini
- **Gemini 2.5 / 2.0 (Pro y Flash):** Son los modelos líderes en rentabilidad, ventanas de contexto masivas (de hasta 2 millones de tokens) y velocidad de respuesta. Son idóneos para automatizaciones en tiempo real como responder mensajes de WhatsApp de forma masiva y económica.

---

## 2. Decisiones de Arquitectura de ClienteLoop

- **Transición a Gemini API:** Por motivos de optimización de costos y velocidad, la inteligencia que controla ClienteLoop (tanto el auto-reply de WhatsApp en `nicho-engine.ts` como el Copilot de administración en `copilot.ts` y el asistente de configuración `setupAssistant.ts`) será controlada por la API oficial de **Google Gemini** (usando el modelo `gemini-1.5-flash` para auto-respuestas veloces y `gemini-1.5-pro` para tareas analíticas y copilotaje interactivo).
- **Mantenimiento y Estabilidad:** Todos los componentes se actualizan preservando la estabilidad, evitando retroceder a dependencias obsoletas y garantizando un código robusto, escalable y limpio.
