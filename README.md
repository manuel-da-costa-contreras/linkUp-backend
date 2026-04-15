# SaaS Dashboard Backend

Backend API en Node.js + TypeScript para un dashboard SaaS con arquitectura por capas, Firestore (NoSQL), autenticacion con Firebase y notificaciones en tiempo real via SSE.

## Stack Tecnologico

- Runtime: Node.js
- Lenguaje: TypeScript
- Framework HTTP: Express
- Base de datos: Google Firestore (NoSQL)
- Auth/Identity: Firebase Admin SDK
- Validaciones: Zod
- Testing: Jest + Supertest

## Arquitectura

Se usa una arquitectura por capas con separacion de responsabilidades:

- `src/routes`: definicion de endpoints
- `src/controllers`: capa HTTP (request/response)
- `src/services`: casos de uso y reglas de negocio
- `src/repositories`: acceso a Firestore y Firebase
- `src/middlewares`: validacion, errores, authn/authz
- `src/projections`: consumo de eventos y proyecciones (event-driven)
- `src/events`: contrato de eventos y publicadores
- `src/scripts`: seed y utilidades operativas
- `src/config`: inicializacion y configuracion (env/firebase)

Flujo principal:

`Route -> Controller -> Service -> Repository -> Firestore`

## Firestore (NoSQL)

Firestore es la persistencia principal del proyecto.

Colecciones relevantes:

- `clients`
- `jobs`
- `notifications`
- `organization_memberships`
- `event_outbox`
- `processed_events`

Patrones usados:

- Denormalizacion de contadores para lecturas rapidas
- Consistencia eventual con outbox + consumer
- Proyecciones para notificaciones y contadores de jobs

## Event-Driven (Outbox)

Para desacoplar escritura transaccional y proyecciones:

1. La API publica eventos de dominio en `event_outbox`.
2. Un consumer procesa eventos y aplica proyecciones.
3. Se marca idempotencia en `processed_events`.

Scripts:

- `npm run dev:ed:api`: API con publicacion a outbox
- `npm run dev:ed:consumer`: consumer en modo apply
- `npm run dev:ed`: levanta ambos (segun entorno PowerShell)

## Autenticacion y Autorizacion

### Fase actual implementada

- Verificacion de Firebase ID Token (`Bearer`) en `/organizations/*`
- Autorizacion multi-org por:
  - claims del token (`orgId`, `role`) o
  - `organization_memberships` en Firestore
- Roles operativos: `OWNER | ADMIN | MANAGER | MEMBER | VIEWER`
- Mutaciones protegidas por rol en endpoints sensibles

### SSE seguro

- Endpoint para token corto: `POST /api/auth/sse-token`
- Stream: `GET /organizations/:orgId/notifications/stream?token=...`
- Heartbeat, retry y reconexion soportados

## Requisitos

- Node.js 18+
- Proyecto Firebase con Firestore habilitado
- Credenciales de servicio (Firebase Admin)

## Instalacion

```bash
npm install
```

## Configuracion

1. Crear archivo `.env` (puedes partir de `.env.example`)
2. Configurar credenciales Firebase:
   - recomendado: variables de entorno/secret manager
   - desarrollo local actual: `src/serviceAccountKey.json`

## Ejecucion

Modo normal:

```bash
npm run dev
```

Modo event-driven recomendado:

```bash
npm run dev:ed:api
npm run dev:ed:consumer
```

Build de produccion:

```bash
npm run build
npm start
```

## Principios de codigo

- Clean Code pragmatica
- SRP y separacion por capas
- Validacion en bordes (DTO/schema)
- Manejo centralizado de errores
- Tipado estricto en TypeScript

## Estado del API (alto nivel)

- Dashboard overview
- CRUD de Clients
- CRUD + transiciones de estado de Jobs
- Notificaciones (listado, dismiss, dismiss-all)
- Notificaciones en tiempo real via SSE
- Auth (register real, sse-token, middleware authn/authz)

