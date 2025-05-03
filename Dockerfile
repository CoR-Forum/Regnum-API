# Use an official Node.js runtime as a parent image
FROM node:23-slim

# Set the working directory in the container
WORKDIR /app

# Copy application code
COPY . .

# Remove existing node_modules and package-lock.json
RUN rm -rf node_modules package-lock.json

# run npm install
RUN npm install --verbose

# Start the client (Vite development server)
CMD ["nodemon", "index.js"]