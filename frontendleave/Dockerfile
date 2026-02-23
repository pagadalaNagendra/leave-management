FROM node:18 AS build
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps && npm install chart.js
COPY . .
# Clean old build output if exists
RUN rm -rf build
RUN npm run build
# Ensure build output exists and index.html is present
RUN if [ ! -f /app/build/index.html ]; then echo "Build failed: index.html missing" && exit 1; fi

FROM nginx:1.25-alpine
COPY --from=build /app/build/ /usr/share/nginx/html/leavemanagement/
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]