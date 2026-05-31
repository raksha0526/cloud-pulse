const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();

app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

// ✅ API route
app.get("/", (req, res) => {
  res.send("Backend running 🚀");
});

// ✅ Socket connection
io.on("connection", (socket) => {

  console.log("Client connected");

  // Simulated cloud infrastructure
  const servers = [

    {
      name: "EC2-Frontend",
      region: "us-east-1",
      type: "EC2 Instance",
      status: "Running"
    },

    {
      name: "K8s-API",
      region: "ap-south-1",
      type: "Kubernetes Pod",
      status: "Running"
    },

    {
      name: "Docker-DB",
      region: "eu-west-1",
      type: "Docker Container",
      status: "Running"
    }

  ];

  // Base load for realistic fluctuations
  let baseLoad = 30;

  // Send metrics every 2 sec
  const interval = setInterval(() => {

    const metrics = servers.map(server => ({

      ...server,

      cpu: Math.min(
        100,
        Math.max(
          0,
          baseLoad + (Math.random() * 20 - 10)
        )
      ).toFixed(2),

      ram: Math.min(
        100,
        Math.max(
          0,
          baseLoad + (Math.random() * 20 - 10)
        )
      ).toFixed(2)

    }));

    io.emit("metrics", metrics);

  }, 2000);

  // Cleanup
  socket.on("disconnect", () => {

    clearInterval(interval);

    console.log("Client disconnected");

  });

});

// ✅ Start server
server.listen(5000, () => {

  console.log("Server running on http://localhost:5000");

});