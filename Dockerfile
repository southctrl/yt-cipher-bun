FROM denoland/deno:latest

WORKDIR /usr/src/app

COPY . .

RUN mkdir -p player_cache && chown -R deno:deno player_cache

EXPOSE 8001

USER deno

CMD ["run", "--allow-net", "--allow-read", "--allow-write", "--allow-env", "server.ts"]