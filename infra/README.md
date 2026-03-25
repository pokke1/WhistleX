# Infrastructure

Docker assets for running the WhistleX stack locally.

Local dev compose (uses `target: dev` stage in `infra/Dockerfile`):

```sh
cd infra
SUPABASE_URL=... \
SUPABASE_SERVICE_ROLE_KEY=... \
AUTH_JWT_SECRET=change-me \
docker-compose up
```

Production backend image can be built from hardened non-root runtime stage:

```sh
docker build -f infra/Dockerfile --target runtime -t whistlex-backend:secure ..
```
