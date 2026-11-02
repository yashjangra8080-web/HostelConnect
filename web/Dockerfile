FROM node:20-alpine

WORKDIR /app

# Copy root workspace package files
COPY package*.json ./
COPY server/package*.json ./server/
COPY web/package*.json ./web/

# Install dependencies
RUN npm install

# Copy web source
COPY web/ ./web/

WORKDIR /app/web

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host"]
