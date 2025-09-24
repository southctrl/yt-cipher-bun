# Use an official Node.js runtime as a parent image
FROM node:20-slim

# Install system dependencies and Deno using the official script
RUN apt-get update && apt-get install -y curl unzip
RUN curl -fsSL https://deno.land/x/install/install.sh | sh

# Add Deno to the PATH
ENV PATH="/root/.deno/bin:${PATH}"

# Verify Deno installation
RUN deno --version

# Set the main working directory
WORKDIR /usr/src/app

COPY . .

RUN npm install

RUN npm run build

EXPOSE 8001

WORKDIR /usr/src/app

RUN mkdir -p player_cache

CMD [ "npm", "start" ]