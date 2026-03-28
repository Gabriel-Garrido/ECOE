# Quismart – Plataforma de Evaluaciones Clínicas

Sistema web para gestión de evaluaciones clínicas: ECOE/OSCE, ABP y escenarios simulados. Reemplaza el flujo basado en Excel por una plataforma multi-rol con evaluaciones en línea, cálculo automático de notas y exportaciones a XLSX y PDF.

---

## Decisiones de diseño

| Decisión | Elección | Razón |
|---|---|---|
| Auth | JWT (SimpleJWT) | Stateless, compatible con deploy en Render |
| ORM | Django / PostgreSQL | Integridad referencial, Decimal nativo |
| Cálculo notas | Interpolación lineal + clamp + % exigencia configurable | Fiel al modelo clínico con flexibilidad por estación |
| PDF | ReportLab (Platypus) | Sin dependencias nativas (libcairo, etc.) |
| XLSX import | openpyxl con detección flexible de headers | Tolera archivos Excel con columnas variadas |
| Frontend state | React Query + Context (auth) | Caché automático, simplicidad |
| Mobile-first | TailwindCSS | Inputs grandes para tablet en clínica |
| Deploy backend | Render Web Service (Gunicorn) | Free tier disponible |
| Deploy frontend | Render Static Site (build Vite) | CDN automático |

---

## Stack

**Backend:** Python 3.11 · Django 4.2 · DRF 3.15 · PostgreSQL 16 · SimpleJWT · drf-spectacular
**Frontend:** React 18 · Vite 5 · TypeScript 5 · TailwindCSS 3 · React Query 5 · React Hook Form + Zod
**Tooling:** Docker Compose · ruff · black · isort · pytest · eslint · prettier

---

## Conceptos clave

### Roles
| Código | Nombre en UI | Descripción |
|---|---|---|
| `ADMIN` | **Coordinador** | Crea y administra evaluaciones, estaciones, pautas, escalas, asignaciones y usuarios |
| `EVALUATOR` | **Educador** | Aplica evaluaciones en las estaciones asignadas |

### Tipos de evaluación
| Código | Etiqueta |
|---|---|
| `ECOE` | ECOE/OSCE |
| `ABP` | ABP |
| `SIMULATED` | Escenario Simulado |
| `OTHER` | Otro |

### Variantes de estación
Una estación lógica puede tener múltiples **variantes** con distinta pregunta y, opcionalmente, distinta pauta y/o escala. La evaluación registra qué variante se usó. Los resultados consolidan la nota de la estación independientemente de la variante.

### Porcentaje de exigencia
Cada estación tiene un `passing_score_percent` (default 60%) que define el porcentaje del puntaje máximo necesario para aprobar esa estación. Ejemplo: 60% con 10 pts máximo = 6.0 pts mínimo. Este dato está disponible en la API y en los exports, y la función `is_station_approved(station, total_points)` permite consultar la aprobación por estación.

### Fórmula de cálculo de nota

```
total_points = Σ EvaluationItemScore.points

Si total_points == GradeScalePoint.raw_points → grade directo
Si no → interpolación lineal entre puntos vecinos, con clamp al [min, max] de la escala

nota_final = Σ (grade_estación × weight_percent/100)  [solo estaciones activas]
aprobado = nota_final >= 4.0

Aprobación por estación: total_points >= (max_points_total × passing_score_percent / 100)
```

**Supuestos:**
- La nota final de aprobación (4.0) es fija en el sistema chileno.
- El `passing_score_percent` es por estación y no afecta la nota final (solo reporta pass/fail por estación).
- Si se necesita que el % de exigencia afecte la curva de notas, se requiere una fórmula de escalamiento distinta (no implementada).

---

## Inicio rápido (Docker)

### Requisitos
- Docker Desktop 4.x+
- Git

### 1. Clonar y configurar

```bash
git clone <repo-url> ecoe-mvp
cd ecoe-mvp
cp .env.example .env
```

### 2. Levantar todo

```bash
docker-compose up --build
```

### 3. Cargar datos de demo

```bash
docker-compose exec backend python manage.py seed_demo
```

Crea:
- **Coordinador:** admin@quismart.cl / admin123
- **Educador:** educador@quismart.cl / eval123
- Evaluación ECOE "Demo ECOE 2024" con 2 estaciones, 3 estudiantes, pautas y escala generada
  - Estación 1 – Anamnesis: exigencia 60%, 2 variantes de escenario
  - Estación 2 – Examen Físico: exigencia 70%

### 4. Acceder

| URL | Descripción |
|---|---|
| http://localhost:5173 | Frontend React |
| http://localhost:8000/api/docs/ | Swagger UI (OpenAPI 3) |
| http://localhost:8000/admin/ | Django Admin |

---

## Desarrollo sin Docker

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
cp ../.env.example .env
python manage.py migrate
python manage.py seed_demo
python manage.py runserver
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## Tests

```bash
docker-compose exec backend pytest -v
docker-compose exec backend pytest --cov=apps --cov-report=term-missing
```

Tests incluidos:

**Cálculo de notas:**
- Coincidencia exacta, interpolación lineal, clamp min/max, sin escala → error

**Porcentaje de exigencia:**
- Default 60%, custom, aprobación por estación (pass/fail/exact threshold)
- API expone y permite actualizar `passing_score_percent`

**Roles y naming:**
- ADMIN muestra "Coordinador", EVALUATOR muestra "Educador"
- Tipos de evaluación (ECOE, ABP, SIMULATED, OTHER)

**Variantes de estación:**
- CRUD de variantes, conteo en API, variante con pauta propia

**Importación de pauta:**
- XLSX con descripción + puntaje, headers flexibles, errores parciales

**Permisos:**
- Educador sin asignación → 403; con asignación → 200; Coordinador → 200

**Flujo completo:**
- Crear → puntuar → finalizar → resultados con nota y aprobación

---

## API Reference

Documentación completa en: `http://localhost:8000/api/docs/`

### Endpoints principales

```
POST   /api/v1/auth/login/
POST   /api/v1/auth/refresh/
GET    /api/v1/users/me/

GET    /api/v1/exams/                                    # Lista (filtro ?status=)
POST   /api/v1/exams/                                    # Crear (con exam_type)
GET    /api/v1/exams/{id}/
PATCH  /api/v1/exams/{id}/
POST   /api/v1/exams/{id}/publish/
POST   /api/v1/exams/{id}/close/

GET    /api/v1/exams/{exam_id}/stations/
POST   /api/v1/exams/{exam_id}/stations/                 # Incluye passing_score_percent
PATCH  /api/v1/stations/{id}/
POST   /api/v1/stations/{id}/toggle-active/

GET    /api/v1/stations/{id}/rubric-items/
POST   /api/v1/stations/{id}/rubric-items/
POST   /api/v1/stations/{id}/rubric-items/import-xlsx/   # NUEVO: importar pauta
PATCH  /api/v1/rubric-items/{id}/
DELETE /api/v1/rubric-items/{id}/

GET    /api/v1/stations/{id}/grade-scale/
PUT    /api/v1/stations/{id}/grade-scale/
POST   /api/v1/stations/{id}/grade-scale/generate/

GET    /api/v1/stations/{id}/variants/                   # NUEVO: variantes
POST   /api/v1/stations/{id}/variants/
PATCH  /api/v1/variants/{id}/
DELETE /api/v1/variants/{id}/

GET    /api/v1/exams/{exam_id}/assignments/
POST   /api/v1/exams/{exam_id}/assignments/
DELETE /api/v1/assignments/{id}/

POST   /api/v1/exams/{exam_id}/students/import-xlsx/
GET    /api/v1/exams/{exam_id}/students/
POST   /api/v1/exams/{exam_id}/students/

GET    /api/v1/stations/{id}/evaluations/
POST   /api/v1/stations/{id}/evaluations/
GET    /api/v1/evaluations/{id}/
PATCH  /api/v1/evaluations/{id}/
POST   /api/v1/evaluations/{id}/finalize/
POST   /api/v1/evaluations/{id}/reopen/

GET    /api/v1/exams/{id}/results/
GET    /api/v1/exams/{id}/exports/results.xlsx
GET    /api/v1/evaluations/{id}/exports/evaluation.pdf
```

---

## Importar pauta desde Excel (NUEVO)

`POST /api/v1/stations/{id}/rubric-items/import-xlsx/`

El sistema detecta headers automáticamente:

| Campo | Headers aceptados |
|---|---|
| Descripción | descripcion, description, item, criterio, indicador, nombre, pregunta |
| Puntaje máximo | puntaje, max_points, puntaje_maximo, max_pts, puntos, score |
| Orden (opcional) | orden, order, nro, numero, # |

Comportamiento: crea nuevos ítems sin borrar los existentes. Seguro importar varias veces.

---

## Importar estudiantes (XLSX)

`POST /api/v1/exams/{exam_id}/students/import-xlsx/`

| Campo | Headers aceptados |
|---|---|
| RUT | rut, RUT, run, RUN |
| Nombre | nombre, full_name, nombre completo, apellido y nombre |
| Correo | correo, email, correo electrónico, e-mail |

Comportamiento: `update_or_create` por RUT → sin duplicados, seguro importar varias veces.

---

## Modelo de Datos

```
User ─── Exam ─────── Station ─── RubricItem
         (exam_type)  │ (passing_score_percent)
                      ├── GradeScalePoint
                      ├── StationVariant ─── RubricItem (propia)
                      │                  └── GradeScalePoint (propia)
                      └── StationAssignment

Exam ─── ExamStudent ─── Student

Evaluation ─── EvaluationItemScore
(variant FK opcional)

AuditLog (FINALIZE, REOPEN, IMPORT_STUDENTS, IMPORT_RUBRIC, PUBLISH, CLOSE)
```

---

## Deploy en Render

Configuración completa en `render.yaml`.

### Backend (Web Service)

Variables requeridas: `DJANGO_SETTINGS_MODULE`, `SECRET_KEY`, `DATABASE_URL`, `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`

### Frontend (Static Site)

Variable requerida: `VITE_API_URL`

---

## Variables de entorno

| Variable | Descripción | Ejemplo |
|---|---|---|
| `SECRET_KEY` | Django secret key | `python -c "import secrets; print(secrets.token_urlsafe(50))"` |
| `DATABASE_URL` | URL PostgreSQL | `postgres://user:pass@host:5432/db` |
| `ALLOWED_HOSTS` | Hosts Django | `mi-app.onrender.com` |
| `CORS_ALLOWED_ORIGINS` | Origins CORS | `https://mi-frontend.onrender.com` |
| `DJANGO_SETTINGS_MODULE` | Módulo settings | `config.settings.prod` |
| `VITE_API_URL` | URL backend API | `https://mi-backend.onrender.com/api/v1` |

---

## Estructura del repositorio

```
ecoe-mvp/
├── backend/
│   ├── config/settings/{base,dev,prod}.py
│   ├── apps/
│   │   ├── users/          # Auth, roles (Coordinador/Educador)
│   │   ├── exams/          # Evaluaciones, Estaciones, Pautas, Escalas, Variantes, Asignaciones
│   │   ├── students/       # Estudiantes, importación XLSX
│   │   ├── evaluations/    # Evaluaciones, puntajes, cálculo, % exigencia
│   │   ├── exports/        # XLSX y PDF
│   │   └── audit/          # Auditoría
│   └── pytest.ini
├── frontend/
│   └── src/
│       ├── api/            # Cliente axios + endpoints (exams, stations, variants, evaluations, exports)
│       ├── components/ui/  # Button, Badge, Card, Input, Modal, Spinner
│       ├── context/        # AuthContext (JWT)
│       ├── layouts/        # AdminLayout, EvaluatorLayout
│       ├── pages/          # Vistas por rol
│       └── types/          # TypeScript interfaces
├── docker-compose.yml
├── render.yaml
└── README.md
```

---

## Licencia

MIT — Proyecto académico/educativo.
