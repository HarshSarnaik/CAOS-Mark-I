# CAOS-Mark — Digital Asset Protection System

> **Google Solutions Challenge Submission**  
> Invisible chaotic watermarking · Gemini 1.5 Pro forensics · Cloud Run ready

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        CAOS-Mark System                         │
├──────────────────────────┬──────────────────────────────────────┤
│     Frontend (React)     │         Backend (FastAPI)            │
│  ─────────────────────── │  ──────────────────────────────────  │
│  Protect Page            │  POST /protect                       │
│    Drag-and-drop upload  │    caos_core.embed()                 │
│    Signature label       │    Arnold's Cat Map scrambling       │
│    Download watermarked  │    DCT-QIM coefficient modification  │
│                          │    GCS upload                        │
│  Radar Dashboard         │                                      │
│    Animated radar SVG    │  POST /verify                        │
│    Event cards           │    caos_core.extract()               │
│    Risk badges           │    forensics.analyze() → Gemini      │
│    Verify panel          │    Firestore event log               │
│                          │                                      │
│                          │  GET  /events                        │
│                          │    Firestore query                   │
└──────────────────────────┴──────────────────────────────────────┘
```

---

## Prerequisites

| Requirement | Version |
|-------------|---------|
| Python | 3.11+ |
| Node.js | 18+ |
| GCP Account | (for cloud features) |

---

## 1. GCP Service Account Setup

### 1.1 Create / Select a Project

```bash
gcloud projects create caos-mark-prod --name="CAOS Mark"
gcloud config set project caos-mark-prod
```

### 1.2 Enable Required APIs

```bash
gcloud services enable \
  aiplatform.googleapis.com \
  storage.googleapis.com \
  firestore.googleapis.com \
  run.googleapis.com \
  artifactregistry.googleapis.com
```

### 1.3 Create a Service Account

```bash
gcloud iam service-accounts create caos-mark-sa \
  --display-name="CAOS-Mark Service Account"
```

### 1.4 Grant IAM Roles

```bash
PROJECT_ID=$(gcloud config get-value project)
SA_EMAIL="caos-mark-sa@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/storage.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/datastore.user"
```

### 1.5 Download Key File

```bash
gcloud iam service-accounts keys create \
  ./backend/service-account-key.json \
  --iam-account=$SA_EMAIL
```

### 1.6 Create GCS Bucket

```bash
gsutil mb -l us-central1 gs://caos-mark-vault
gsutil uniformbucketlevelaccess set on gs://caos-mark-vault
```

### 1.7 Create Firestore Database

Go to **Firebase Console → Firestore Database → Create database** (Native mode, `us-central1`).

---

## 2. Environment Variables

```bash
# Backend
cd backend
cp .env.example .env
```

Edit `.env`:

```env
GOOGLE_API_KEY=your-gemini-api-key         # from aistudio.google.com
GOOGLE_CLOUD_PROJECT=caos-mark-prod
GOOGLE_APPLICATION_CREDENTIALS=./service-account-key.json
GCS_BUCKET_NAME=caos-mark-vault
CAOS_ITERATIONS=8
CAOS_STRENGTH=15.0
LOCAL_FALLBACK=false                       # set true for offline dev
FRONTEND_URL=http://localhost:5173
```

---

## 3. Local Development

### 3.1 Backend

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

API docs → http://localhost:8000/docs

> **No GCP account?** Set `LOCAL_FALLBACK=true` — assets save to `./local_store/` and
> events to `./local_store/events.json`.  Only the Gemini key is required.

### 3.2 Frontend

```bash
cd frontend
npm install
npm run dev
```

Dashboard → http://localhost:5173

---

## 4. Quick Test (curl)

```bash
# 1. Protect an asset
curl -X POST http://localhost:8000/protect \
  -F "file=@test.jpg" \
  -F "label=GSC-2024-TEST-001" \
  --output protected.jpg -D -

# 2. Verify the protected image
curl -X POST http://localhost:8000/verify \
  -F "file=@protected.jpg" \
  -F "suspect_url=https://example.com/stolen-image" \
  -F "account_name=suspect_account" \
  -F "sig_len=17"

# 3. Fetch events
curl http://localhost:8000/events | python -m json.tool
```

---

## 5. Deployment to Google Cloud Run

### 5.1 Build & Push Docker Image

```bash
cd backend

# Authenticate Docker with GCP
gcloud auth configure-docker us-central1-docker.pkg.dev

# Create Artifact Registry repository
gcloud artifacts repositories create caos-mark \
  --repository-format=docker \
  --location=us-central1

IMAGE="us-central1-docker.pkg.dev/${PROJECT_ID}/caos-mark/backend:latest"

docker build -t $IMAGE .
docker push $IMAGE
```

### 5.2 Deploy to Cloud Run

```bash
gcloud run deploy caos-mark-backend \
  --image=$IMAGE \
  --region=us-central1 \
  --platform=managed \
  --allow-unauthenticated \
  --memory=1Gi \
  --cpu=1 \
  --concurrency=80 \
  --set-env-vars="GOOGLE_API_KEY=YOUR_KEY,GOOGLE_CLOUD_PROJECT=${PROJECT_ID},GCS_BUCKET_NAME=caos-mark-vault,CAOS_ITERATIONS=8,CAOS_STRENGTH=15.0" \
  --service-account=$SA_EMAIL
```

> **Note:** On Cloud Run, skip `GOOGLE_APPLICATION_CREDENTIALS` — the service account
> attached via `--service-account` handles authentication automatically.

### 5.3 Deploy Frontend (Firebase Hosting)

```bash
cd frontend
# Update VITE_API_BASE_URL in .env.production
echo "VITE_API_BASE_URL=https://YOUR-CLOUD-RUN-URL" > .env.production

npm run build

npm install -g firebase-tools
firebase login
firebase init hosting   # choose 'dist' as public directory, SPA=yes
firebase deploy
```

---

## 6. Project Structure

```
GSC/
├── backend/
│   ├── caos_core.py       # Arnold's Cat Map + DCT-QIM engine
│   ├── forensics.py       # Gemini 1.5 Pro analysis module
│   ├── storage.py         # GCS + Firestore (with local fallback)
│   ├── main.py            # FastAPI application
│   ├── requirements.txt   # Python dependencies
│   ├── Dockerfile         # Multi-stage Cloud Run image
│   ├── .dockerignore
│   └── .env.example       # Environment variable template
└── frontend/
    ├── src/
    │   ├── api.js                      # Axios client
    │   ├── App.jsx / main.jsx          # App shell
    │   ├── index.css                   # Global styles
    │   ├── pages/
    │   │   ├── ProtectPage.jsx         # Upload & watermark
    │   │   └── RadarPage.jsx           # Detection radar dashboard
    │   └── components/
    │       ├── Navbar.jsx
    │       ├── RiskBadge.jsx
    │       └── EventCard.jsx
    ├── tailwind.config.js  # Google brand palette
    ├── vite.config.js
    └── package.json
```

---

## 7. How the Watermark Works

```
Text Signature
     │
     ▼
┌─────────────────────┐
│  UTF-8 → bit array  │
└─────────────────────┘
     │
     ▼
┌─────────────────────────────────────┐
│  Arnold's Cat Map (n iterations)    │  ← Secret key
│  Scrambles bit positions in a       │
│  square matrix using the map:       │
│  (i,j) → ((i+j)%n, (i+2j)%n)      │
└─────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────┐
│  DCT-QIM Embedding                  │
│  • Convert image to YCbCr           │
│  • Split Y-channel into 8×8 blocks  │
│  • For each block:                  │
│      D = DCT(block)                 │
│      D[4][4] ±= strength*0.25/0.75  │  ← bit 0 or 1
│      block = IDCT(D)               │
└─────────────────────────────────────┘
     │
     ▼
Watermarked JPEG (visually identical)
```

Extraction reverses the process using the same key (iteration count).

---

## 8. Gemini Forensics Response Schema

```json
{
  "verdict":            "Fair Use | Suspicious | Malicious Piracy",
  "risk_score":         7,
  "reasoning":          "The full-resolution image appears on a commercial platform...",
  "recommended_action": "DMCA Notice | Monitor | Legal Action",
  "confidence":         0.87
}
```

---

## License

MIT — Built for the Google Solutions Challenge 2024.
