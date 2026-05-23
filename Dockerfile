FROM node:26-alpine AS build

WORKDIR /application

COPY package*.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

FROM node:26-alpine AS production

WORKDIR /application

COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY --from=build /application/build ./build
COPY --from=build /application/src/web ./src/web
COPY --from=build /application/prisma ./prisma
COPY --from=build /application/prisma.config.ts ./prisma.config.ts

EXPOSE 3000

CMD ["npm", "start"]