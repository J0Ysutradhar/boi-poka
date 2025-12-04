# Use Node.js LTS version
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY . .

# Create uploads and covers directories
RUN mkdir -p uploads/covers

# Create books.json with default content
RUN echo '{"books": []}' > uploads/books.json

# Expose port (Coolify will map this)
EXPOSE 3002

# Set environment variables
ENV NODE_ENV=production

# Start the application
CMD ["npm", "start"]
