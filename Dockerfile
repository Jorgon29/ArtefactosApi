FROM node:20-slim AS build

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

FROM node:20-slim AS production

WORKDIR /usr/src/app

COPY --from=build /usr/src/app/package*.json ./
COPY --from=build /usr/src/app/dist ./dist

RUN npm install --omit=dev

COPY ./certs/ca.crt ./certs/ca.crt

EXPOSE 3000

CMD [ "node", "dist/main" ]