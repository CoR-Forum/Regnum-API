FROM node:23-alpine

LABEL maintainer="Joshua2504 & Knight1"
LABEL org.opencontainers.image.source="https://github.com/sylent-x/sylent-x-api"

WORKDIR /usr/src/app

COPY package*.json ./

RUN apk add --no-cache python3 make g++ \
    && npm install

COPY . .

USER www-data

EXPOSE 3000

CMD ["node", "index.js"]
