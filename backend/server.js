const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const os = require("os-utils");

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

app.get("/", (req, res) => {
  res.send("Backend running 🚀");
});

io.on("connection", (socket) => {
  console.log("Client connected");

  const interval = setInterval(() => {
    os.cpuUsage((cpu) => {
      const data = {
        cpu: (cpu * 100).toFixed(2),
        ram: ((1 - os.freememPercentage()) * 100).toFixed(2),
        uptime: os.sysUptime(),
      };
      console.log("Sending:", data);

      socket.emit("metrics", data);
    });
  }, 2000);

  socket.on("disconnect", () => {
    clearInterval(interval);
    console.log("Client disconnected");
  });
});

server.listen(5000, () => {
  console.log("Server running on http://localhost:5000");
});