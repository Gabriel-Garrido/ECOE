# ECOE MVP

Sistema web para gestión de exámenes ECOE/OSCE. Reemplaza el flujo basado en Excel por una plataforma multi-rol con evaluaciones en línea, cálculo automático de notas y exportaciones a XLSX y PDF.

---

## Decisiones de diseño

| Decisión | Elección | Razón |
|---|---|---|
| Auth | JWT (SimpleJWT) | Stateless, compatible con deploy en Render |
| ORM | Django / PostgreSQL | Integridad referencial, Decimal nativo |
| Cálculo notas | Interpolación lineal + clamp | Fiel al Excel original de ECOE |
| PDF | ReportLab (Platypus) | Sin dependencias nativas (libcairo, etc.) |
| XLSX import | openpyxl con detección flexible de headers | Tolera archivos Excel con columnas variadas |
| Frontend state | React Query + Zustand (auth) | Caché automático, simplicidad |
| Mobile-first | TailwindCSS | Inputs grandes para tablet en clínica |
| Deploy backend | Render Web Service (Gunicorn) | Free tier disponible |
| Deploy frontend | Render Static Site (build Vite) | CDN automático |

---

## Stack

**Backend:** Python 3.11 · Django 4.2 · DRF 3.15 · PostgreSQL 16 · SimpleJWT · drf-spectacular
**Frontend:** React 18 · Vite 5 · TypeScript 5 · TailwindCSS 3 · React Query 5 · React Hook Form + Zod
**Tooling:** Docker Compose · ruff · black · isort · pytest · eslint · prettier

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
# Editar .env si necesitas cambiar puertos o contraseñas
```

### 2. Levantar todo

```bash
docker-compose up --build
```

Esto ejecuta automáticamente:
- Migraciones de base de datos (`python manage.py migrate`)
- Servidor Django en `http://localhost:8000`
- Servidor Vite en `http://localhost:5173`

### 3. Cargar datos de demo (recomendado)

En otra terminal, mientras el stack está corriendo:

```bash
docker-compose exec backend python manage.py seed_demo
```

Esto crea:
- **Admin:** admin@ecoe.cl / admin123
- **Evaluador:** evaluador@ecoe.cl / eval123
- ECOE "Demo 2024" con 2 estaciones, 3 estudiantes, pautas y escala generada
- Asignación del evaluador a ambas estaciones

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

# Crear virtualenv
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# Instalar dependencias
pip install -r requirements-dev.txt

# Variables de entorno (copia y edita)
cp ../.env.example .env

# Base de datos local (requiere PostgreSQL instalado)
createdb ecoe_db

# Migraciones
python manage.py migrate

# Seed demo
python manage.py seed_demo

# Servidor
python manage.py runserver
```

### Frontend

```bash
cd frontend
npm install
cp ../.env.example .env  # ajustar VITE_API_URL=http://localhost:8000/api/v1
npm run dev
```

---

## Tests

```bash
# Backend
docker-compose exec backend pytest -v

# Tests específicos
docker-compose exec backend pytest apps/evaluations/tests.py -v

# Con coverage
docker-compose exec backend pytest --cov=apps --cov-report=term-missing
```

Tests incluidos:
- `test_grade_calculation_exact_match` – Coincidencia exacta en escala
- `test_grade_calculation_interpolation` – Interpolación lineal entre puntos
- `test_grade_calculation_below_min` – Clamp al mínimo de escala
- `test_grade_calculation_above_max` – Clamp al máximo de escala
- `test_evaluator_cannot_see_unassigned_station` – RBAC evaluador
- `test_evaluator_can_see_assigned_station` – RBAC evaluador asignado
- `test_finalize_fails_incomplete` – Finalizar requiere todos los ítems
- `test_finalize_success` – Flujo completo de finalización

---

## Flujo de uso

### Como Admin:
1. Login → `/admin/exams` → **Nuevo ECOE**
2. Entrar al ECOE → Tab **Estaciones** → agregar estaciones, configurar ponderaciones (deben sumar 100%)
3. Por cada estación → **Pauta y Escala** → agregar ítems, generar escala lineal
4. Tab **Estudiantes** → importar XLSX (columnas: rut, nombre, correo – headers flexibles)
5. Tab **Asignaciones** → asignar evaluadores a estaciones
6. **Publicar ECOE** (valida que todo esté completo)
7. Tab **Resultados** → ver notas consolidadas → **Exportar XLSX**

### Como Evaluador:
1. Login → `/evaluador/mis-estaciones` → ver estaciones asignadas
2. Seleccionar estación → lista de estudiantes con estado
3. Por cada estudiante → formulario de evaluación:
   - Ingresar puntaje por ítem (con decimales) + comentario opcional
   - Auto-guardado cada 1.5s
   - **Finalizar** (solo si todos los ítems tienen puntaje)
4. Al finalizar → ver nota calculada + descargar PDF

---

## API Reference

Documentación completa en: `http://localhost:8000/api/docs/`

### Endpoints principales

```
POST   /api/v1/auth/login/
POST   /api/v1/auth/refresh/
GET    /api/v1/users/me/

GET    /api/v1/exams/
POST   /api/v1/exams/
GET    /api/v1/exams/{id}/
PATCH  /api/v1/exams/{id}/
POST   /api/v1/exams/{id}/publish/
POST   /api/v1/exams/{id}/close/

GET    /api/v1/exams/{exam_id}/stations/
POST   /api/v1/exams/{exam_id}/stations/
PATCH  /api/v1/stations/{id}/
POST   /api/v1/stations/{id}/toggle-active/

GET    /api/v1/stations/{id}/rubric-items/
POST   /api/v1/stations/{id}/rubric-items/
PUT    /api/v1/stations/{id}/grade-scale/
POST   /api/v1/stations/{id}/grade-scale/generate/

POST   /api/v1/exams/{exam_id}/students/import-xlsx/

GET    /api/v1/stations/{id}/evaluations/
POST   /api/v1/stations/{id}/evaluations/
PATCH  /api/v1/evaluations/{id}/
POST   /api/v1/evaluations/{id}/finalize/
POST   /api/v1/evaluations/{id}/reopen/

GET    /api/v1/exams/{id}/results/
GET    /api/v1/exams/{id}/exports/results.xlsx
GET    /api/v1/evaluations/{id}/exports/evaluation.pdf
```

---

## Modelo de Datos (resumen)

```
User ─── Exam ─── Station ─── RubricItem
                │           └── GradeScalePoint
                ├── ExamStudent ─── Student
                ├── StationAssignment
                └── Evaluation ─── EvaluationItemScore

AuditLog (registra: FINALIZE, REOPEN, IMPORT, PUBLISH, CLOSE)
```

### Cálculo de nota

```
total_points = Σ EvaluationItemScore.points

Si total_points == GradeScalePoint.raw_points → grade directo
Si no → interpolación lineal entre puntos vecinos, con clamp al [min, max] de la escala

nota_final_ECOE = Σ (grade_estación × weight_percent/100)  [solo estaciones activas]
aprobado = nota_final >= 4.0
```

---

## Importar estudiantes (XLSX)

El sistema detecta headers automáticamente (case-insensitive, con variaciones españolas):

| Campo | Headers aceptados |
|---|---|
| RUT | rut, RUT, Rut, run, RUN |
| Nombre | nombre, Nombre, full_name, nombre completo, apellido y nombre |
| Correo | correo, email, Email, correo electrónico, e-mail |

Comportamiento: `update_or_create` por RUT → sin duplicados, seguro importar varias veces.

---

## Deploy en Render

### Backend (Web Service)

1. Conectar repositorio en Render
2. **Root Directory:** `backend`
3. **Environment:** Python 3
4. **Build command:** `pip install -r requirements.txt && python manage.py collectstatic --noinput`
5. **Start command:** `gunicorn config.wsgi:application --bind 0.0.0.0:$PORT`
6. Agregar variables de entorno:
   ```
   DJANGO_SETTINGS_MODULE=config.settings.prod
   SECRET_KEY=<generar>
   DATABASE_URL=<postgres URL de Render>
   ALLOWED_HOSTS=<nombre-app>.onrender.com
   CORS_ALLOWED_ORIGINS=https://<frontend>.onrender.com
   ```
7. Agregar addon **PostgreSQL** en Render

### Frontend (Static Site)

1. Conectar repositorio en Render
2. **Root Directory:** `frontend`
3. **Build command:** `npm ci && npm run build`
4. **Publish directory:** `dist`
5. Agregar variable de entorno:
   ```
   VITE_API_URL=https://<backend>.onrender.com/api/v1
   ```

### Ejecutar migraciones en Render

En el dashboard de Render → Shell del backend:
```bash
python manage.py migrate
python manage.py seed_demo
```

---

## Variables de entorno

| Variable | Descripción | Ejemplo |
|---|---|---|
| `SECRET_KEY` | Django secret key | `python -c "import secrets; print(secrets.token_urlsafe(50))"` |
| `DATABASE_URL` | URL PostgreSQL | `postgres://user:pass@host:5432/db` |
| `ALLOWED_HOSTS` | Hosts Django (coma-separado) | `mi-app.onrender.com` |
| `CORS_ALLOWED_ORIGINS` | Origins CORS (coma-separado) | `https://mi-frontend.onrender.com` |
| `DJANGO_SETTINGS_MODULE` | Módulo settings | `config.settings.prod` |
| `VITE_API_URL` | URL del backend API | `https://mi-backend.onrender.com/api/v1` |

---

## Estructura del repositorio

```
ecoe-mvp/
├── backend/
│   ├── config/
│   │   ├── settings/
│   │   │   ├── base.py
│   │   │   ├── dev.py
│   │   │   └── prod.py
│   │   ├── urls.py
│   │   └── api_urls.py
│   ├── apps/
│   │   ├── users/          # Autenticación, roles
│   │   ├── exams/          # ECOE, Estaciones, Pautas, Escalas, Asignaciones
│   │   ├── students/       # Estudiantes, importación XLSX
│   │   ├── evaluations/    # Evaluaciones, puntajes, cálculo
│   │   ├── exports/        # XLSX y PDF
│   │   └── audit/          # Auditoría
│   ├── requirements.txt
│   ├── Dockerfile
│   └── pytest.ini
├── frontend/
│   ├── src/
│   │   ├── api/            # Cliente axios + endpoints
│   │   ├── components/ui/  # Componentes reutilizables
│   │   ├── context/        # AuthContext
│   │   ├── layouts/        # AdminLayout, EvaluatorLayout
│   │   ├── pages/          # Vistas por rol
│   │   └── types/          # TypeScript interfaces
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## Licencia

MIT — Proyecto académico/educativo.
