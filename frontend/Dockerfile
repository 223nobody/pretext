FROM node:22-alpine AS build

WORKDIR /app/frontend
ARG VITE_API_URL=http://localhost:8000/api/v1
ARG VITE_APP_NAME="Pretext Reader"
ARG VITE_DEFAULT_THEME=light
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_APP_NAME=$VITE_APP_NAME
ENV VITE_DEFAULT_THEME=$VITE_DEFAULT_THEME
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ .
COPY shared/ /app/shared/
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
