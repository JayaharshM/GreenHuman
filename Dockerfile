FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY client/package.json client/package.json
COPY server/package.json server/package.json
RUN npm ci
COPY client client
COPY shared shared
RUN npm run build
RUN npm prune --omit=dev

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/client/dist client/dist
COPY --from=build /app/client/package.json client/package.json
COPY package.json ./
COPY server server
COPY shared shared
RUN mkdir -p /app/.private/uploads && chown -R node:node /app/.private
USER node
EXPOSE 4000
CMD ["node", "server/src/server.js"]
