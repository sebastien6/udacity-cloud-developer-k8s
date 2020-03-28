FROM node:12-alpine
# Create app directory
WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci 
# Bundle app source
COPY . .
RUN npm run tsc

EXPOSE 8080
RUN ls -al
CMD [ "npm", "run", "prod" ]