# AGENTS.md

## 1) Estado actual del proyecto

- Proyecto backend en TypeScript con Node.js.
- Punto de entrada: `src/index.ts`.
- Se usa Express como framework HTTP.
- Se usa `firebase-admin` para integrar Firestore.
- Existe `src/serviceAccountKey.json` para credenciales de Firebase Admin.
- `index.ts` intenta montar rutas (`/api/auth`, `/api/users`, `/api/orders`, `/api/metrics`) pero actualmente no existen esos módulos en `src/routes`, por lo que la arquitectura está iniciada pero incompleta.

## 2) Stack tecnológico (detectado en `package.json`)

### Runtime y lenguaje
- Node.js
- TypeScript (`typescript`, `ts-node`)

### Backend/API
- Express (`express`)
- CORS (`cors`)

### Base de datos / BaaS
- Firebase Admin SDK (`firebase-admin`)
- Firestore (NoSQL) como persistencia principal

### Testing
- Jest (`jest`, `ts-jest`, `@types/jest`)
- Supertest (`supertest`, `@types/supertest`) para pruebas de endpoints HTTP

### Build y ejecución
- `npm run dev`: `ts-node src/index.ts`
- `npm run build`: compila TypeScript a `dist/`
- `npm start`: ejecuta `dist/index.js`

## 3) Arquitectura objetivo recomendada

Para mantener escalabilidad, separación de responsabilidades y facilitar testing:

- `src/config`: configuración (env, firebase, constantes)
- `src/routes`: definición de rutas Express
- `src/controllers`: capa HTTP (request/response)
- `src/services`: casos de uso/reglas de negocio
- `src/repositories`: acceso a Firestore
- `src/models` o `src/domain`: entidades y tipos de dominio
- `src/middlewares`: auth, validación, manejo de errores
- `src/utils`: utilidades compartidas
- `src/tests`: pruebas unitarias/integración

Flujo recomendado:
`Route -> Controller -> Service (Use Case) -> Repository -> Firestore`

## 4) Integración Firestore (lineamientos)

- Inicializar Firebase Admin una sola vez (singleton en `config/firebase.ts`).
- No acceder a Firestore directamente desde controllers.
- Usar repositories por agregado/módulo (`users.repository.ts`, `orders.repository.ts`, etc.).
- Estandarizar nombres de colecciones y estructura de documentos.
- Manejar errores de Firestore y mapearlos a errores de dominio/API.

## 5) Clean Code para este backend

- Funciones pequeñas y con responsabilidad única (SRP).
- Nombres descriptivos (`createOrder`, `getUserById`, `updateMetrics`).
- Evitar lógica de negocio en routes/controllers.
- Validar entrada en el borde (middleware o DTO validators).
- Usar tipado fuerte en DTOs de entrada/salida.
- Manejo centralizado de errores (`errorHandler` middleware).
- Evitar duplicación (DRY) en validaciones, respuestas y acceso a datos.
- Dependencias hacia adentro: controller depende de service, service depende de interfaces/repositories.

## 6) Metodologías y prácticas de trabajo (backend)

- Arquitectura por capas con orientación Clean Architecture (pragmática).
- Convención de commits semánticos (ej. `feat:`, `fix:`, `refactor:`).
- Desarrollo guiado por pruebas en endpoints críticos (TDD parcial donde aporte valor).
- Definition of Done por feature:
  - endpoint implementado,
  - validaciones,
  - manejo de errores,
  - pruebas mínimas (unit o integración),
  - tipado sin `any` innecesario.
- Revisión de código enfocada en:
  - seguridad,
  - manejo de errores,
  - acoplamiento,
  - cobertura de casos límite.

## 7) Seguridad y configuración

- No versionar credenciales reales (`serviceAccountKey.json`) en repositorio.
- Mover secretos a variables de entorno o secret manager.
- Incluir `.env.example` con variables necesarias (`PORT`, `FIREBASE_PROJECT_ID`, etc.).
- Configurar CORS por lista blanca en ambientes productivos.

## 8) Próximo paso técnico sugerido

Crear estructura base de carpetas y mover inicialización de Firebase a `src/config/firebase.ts`, luego implementar el primer módulo end-to-end (por ejemplo `users`) con patrón Route -> Controller -> Service -> Repository.
