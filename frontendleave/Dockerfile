# Use the official Node.js image
FROM node:18
# Set the working directory
WORKDIR /app
# Copy package.json and package-lock.json
COPY package*.json ./
# Run npm install with --legacy-peer-deps to resolve dependency conflicts
RUN npm install --legacy-peer-deps \
    && npm install chart.js
# Copy the rest of the application code
COPY . .
# Expose the port for the frontend
EXPOSE 8288
# Start the React development server on port 8288 and bind to 0.0.0.0
CMD ["npx", "react-scripts", "start", "--host", "0.0.0.0", "--port", "8288"]