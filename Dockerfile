FROM node:13

WORKDIR /app

EXPOSE 3000

CMD cd /app && npm install && node main.js