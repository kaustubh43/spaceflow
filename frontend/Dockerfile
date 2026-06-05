FROM node:24-slim

WORKDIR /app

# install deps first for better layer caching
COPY package.json ./
RUN npm install

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev"]
