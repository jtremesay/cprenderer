FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY ./tsconfig.json ./
COPY public/ ./public/
COPY src/ ./src/
COPY index.html ./
RUN npm run build

from nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html

