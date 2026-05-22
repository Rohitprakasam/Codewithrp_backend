FROM node:20-bullseye

# Install OpenJDK for compiling and running Java code
RUN apt-get update && \
    apt-get install -y default-jdk && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Verify Java installation
RUN java -version && javac -version

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
RUN npm install

# Bundle app source
COPY . .

# Build TypeScript to JavaScript
RUN npm run build

# Expose the backend port
EXPOSE 5000

# Start the application
CMD [ "npm", "start" ]
