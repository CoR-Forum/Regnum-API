# Use the official Node.js image
FROM node:23-alpine

# Create and change to the app directory
WORKDIR /usr/src/app

# Copy the package.json and package-lock.json files
COPY package*.json ./

# Install npm dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Expose the application port
EXPOSE 3000

# Define the command to run the application
CMD ["npm", "start"]
