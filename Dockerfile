# Use an official Node.js runtime as a parent image
# Using Node.js 20 based on Alpine Linux for a smaller image size
FROM node:20-alpine

# Set the working directory inside the container
# All subsequent commands will be executed from this directory
WORKDIR /app

# Copy package.json and package-lock.json (or yarn.lock) to the working directory
# This step is done early to leverage Docker's build cache.
# If only your application code changes, but dependencies don't,
# Docker won't re-run npm install, making builds faster.
COPY package*.json ./

# Install application dependencies
# The --omit=dev flag ensures that only production dependencies are installed,
# resulting in a smaller and more secure final image.
RUN npm install --omit=dev

# Copy the rest of the application code to the working directory
# This includes all your source files, EJS templates, public assets, etc.
COPY . .

# Expose the port your application listens on
# Your Node.js application is configured to run on port 3000 by default.
EXPOSE 3000

# Define the command to run your application when the container starts
# This executes your main server file.
CMD ["node", "app.js"]