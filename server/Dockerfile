FROM node:20-alpine

WORKDIR /app

# Copy root workspace package files
COPY package*.json ./
COPY server/package*.json ./server/
COPY web/package*.json ./web/

# Install dependencies
RUN npm install

# Copy application source
COPY server/ ./server/
COPY scripts/ ./scripts/
COPY db/ ./db/
COPY tests/ ./tests/

WORKDIR /app/server

EXPOSE 3000

CMD ["npm", "run", "dev"]
