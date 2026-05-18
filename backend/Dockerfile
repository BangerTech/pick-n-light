FROM node:22-alpine AS builder
WORKDIR /app

RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm ci

COPY prisma.config.ts ./
COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine
WORKDIR /app

RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY prisma ./prisma
COPY prisma.config.ts ./
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x entrypoint.sh

EXPOSE 3000
CMD ["./entrypoint.sh"]
