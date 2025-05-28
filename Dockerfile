FROM node:18.12.0-alpine as builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application with OpenSSL legacy provider for compatibility
ENV NODE_OPTIONS="--openssl-legacy-provider"
RUN npm run build

# Create production image
FROM node:18.12.0-alpine

WORKDIR /app

# Copy only the necessary files from the builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Ensure directory exists for default schema
RUN mkdir -p /workdir

# Expose the port
EXPOSE 9002

# Set environment variable for host binding to make it accessible externally
ENV HOST=0.0.0.0

# Set the working directory for file mounting
WORKDIR /workdir

# Set the entrypoint to run the application directly with specific arguments
# Use CMD instead of ENTRYPOINT to make it easier to override
ENTRYPOINT ["node", "/app/dist/index.js", "--port", "9002"]