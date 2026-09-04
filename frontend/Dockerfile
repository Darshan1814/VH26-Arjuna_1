FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm install

# Copy application code
COPY . .

EXPOSE 3000

# Use Next.js dev server for hot-reload
CMD ["npm", "run", "dev"]
