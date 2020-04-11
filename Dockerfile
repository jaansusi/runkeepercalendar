FROM node:13

WORKDIR /app

COPY . .

RUN npm install

EXPOSE 3000

CMD [ "node", "main.js"]