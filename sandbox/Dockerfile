FROM node:20-bookworm-slim

RUN groupadd -r caduser && useradd -r -g caduser caduser

WORKDIR /sandbox

COPY sandbox-package.json package.json
RUN npm install --omit=dev

COPY compile.js ./
COPY automech-lib.js ./

RUN chown -R caduser:caduser /sandbox

USER caduser

ENTRYPOINT ["node", "compile.js"]
