# This dockerfile specifies the environment the production
# code will be run in, along with what files are needed
# for production

# Use 22 LTS version of Node.js and Debian as the base image and slim for ARM64 compatibility
FROM node:lts-bookworm-slim

# Use a non-interactive frontend for debconf
ENV DEBIAN_FRONTEND=noninteractive

# Set working directory
WORKDIR /app

# Create a user within the container
RUN useradd -m gaslight_backend_user

# Copy the app directory, package.json, package-lock.json and Config directory
COPY dist/app/ ./
COPY package*.json ./
COPY config/ ./config/

# Change the ownership of the copied files to gaslight_backend_user
RUN chown -R gaslight_backend_user:gaslight_backend_user /app

# Switch to user for subsequent commands
USER gaslight_backend_user

# Clean install production dependencies
RUN npm ci --omit=dev

# Expose the port Express.js runs on
EXPOSE 5000

# Command to run the application
CMD ["npm", "start"]
