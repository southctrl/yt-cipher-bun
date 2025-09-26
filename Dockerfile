FROM oven/bun:1.2.22-alpine

WORKDIR /usr/src/app

# Copy package files first for better caching
COPY package.json bun.lockb* ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Create cache directory and set permissions
RUN mkdir -p player_cache && chown -R bun:bun player_cache

EXPOSE 8001

# Switch to bun user for security
USER bun

# Start the application
CMD ["bun", "run", "server.ts"]
