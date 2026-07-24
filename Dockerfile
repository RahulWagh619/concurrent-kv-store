# Step 1: Use a lightweight, official Linux image with Node.js pre-installed
FROM node:20-bullseye-slim

# Step 2: Install the GNU C++ Compiler (g++) and build tools inside the Linux environment
RUN apt-get update && apt-get install -y \
    g++ \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Step 3: Create and set the internal working directory
WORKDIR /usr/src/app

# Step 4: Copy package configuration files and install npm dependencies
COPY package*.json ./
RUN npm install --production

# Step 5: Copy the entire project codebase into the container
COPY . .

# Step 6: Compile the C++ storage core into a native high-performance Linux binary
RUN g++ -std=c++17 -O3 src/server.cpp src/KVStore.cpp -o src/server.out -pthread

# Step 7: Open Port 3000 to allow public web traffic to reach the Express gateway
EXPOSE 3000

# Step 8: Define the boot command to run the application
CMD ["node", "--experimental-websocket", "app.js"]