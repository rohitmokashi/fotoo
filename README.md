# fotoo

A minimal full-stack photo/video storage app scaffold (React + NestJS + Postgres + S3-compatible storage).

## Development Quickstart (Windows PowerShell)

1. Start Postgres via Docker Compose
	```powershell
	docker compose up -d
	```
2. Copy env templates and edit values
	```powershell
	Copy-Item "fotoo-backend/.env.example" "fotoo-backend/.env"; notepad "fotoo-backend/.env"
	Copy-Item "fotoo-frontend/.env.example" "fotoo-frontend/.env"
	```
3. Install dependencies
	```powershell
	cd "fotoo-backend"; npm install; cd ..; cd "fotoo-frontend"; npm install; cd ..
	```
4. Run backend (NestJS)
	```powershell
	cd "fotoo-backend"; npm run start:dev
	```
5. Run frontend (Vite)
	```powershell
	cd "fotoo-frontend"; npm run dev
	```

### Backend API

- `POST /media/upload-url` => `{ uploadUrl, asset }`
- `GET /media` => list assets
- `GET /media/:id` => asset details
- `GET /media/:id/download-url` => redirects to signed URL
- `DELETE /media/:id` => remove asset and object

### Notes

- Use real AWS credentials in `fotoo-backend/.env` with `S3_BUCKET` set to an existing bucket.
- For S3-compatible storage (e.g., MinIO), set `S3_ENDPOINT` and `S3_FORCE_PATH_STYLE=true`.
- Database schema is auto-loaded from entities; add migrations before production (`synchronize=false`).