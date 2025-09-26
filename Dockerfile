FROM oven/bun:1.2.22

WORKDIR /usr/src/app

# Copy package.json (bun.lockb will be created if it doesn't exist)
COPY package.json ./

# Install dependencies
RUN bun install

# Copy source code
COPY . .

# Create cache directory
RUN mkdir -p player_cache

EXPOSE 8001

CMD ["bun", "server.ts"]
