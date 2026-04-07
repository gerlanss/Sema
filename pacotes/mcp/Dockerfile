FROM node:22-alpine

WORKDIR /app

# Instala a CLI da Sema a partir do pacote local empacotado
COPY semacode-cli-1.2.17.tgz /tmp/semacode-cli.tgz
RUN npm install -g /tmp/semacode-cli.tgz && rm /tmp/semacode-cli.tgz

# Copia o servidor MCP ja compilado
COPY dist/ ./dist/
COPY package.json ./

# Instala apenas as dependencias de producao do pacote mcp
RUN npm install --omit=dev

EXPOSE 3010

ENV MCP_PORT=3010

CMD ["node", "dist/index.js"]
