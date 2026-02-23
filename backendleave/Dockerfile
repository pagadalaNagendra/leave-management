# Use the official Node.js image
FROM node:18
# Set the working directory inside the container
WORKDIR /app
# Copy package.json and package-lock.json first to leverage Docker caching
COPY package*.json ./
# Install dependencies inside the container
RUN npm install
# Copy the rest of the application code
COPY . .
# Ensure proper file permissions
RUN chmod +x node_modules/.bin/nodemon
# Expose the backend ports (HTTP and HTTPS)
EXPOSE 5002
EXPOSE 5443
# Start the server with nodemon
CMD ["npx", "nodemon", "server.js"]


